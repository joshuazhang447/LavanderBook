-- The admin panel's Reviews tab: read, edit, delete.
--
-- Reviews are the only user-generated content in LavenderBook and so the only
-- thing that can be abusive. Until now the panel could ban the account that
-- wrote one but could not touch the words themselves, which is half a
-- moderation tool: the ban stops the next review and leaves the current one up.
--
-- Four functions, all security definer and all opening with the is_admin()
-- check, because rendering the tab is a client-side decision and the client can
-- be made to decide anything.
--
-- On editing someone else's review. It is a real power and it is worth being
-- uncomfortable about: the words stay published under their author's name. The
-- honest answer is not to refuse it - a moderator sometimes has to redact a
-- phone number out of otherwise useful prose - but to record it, which is what
-- admin_edited_at and admin_edited_by below are for. Note what an admin still
-- CANNOT do: change who wrote a review, move it to another venue, or alter a
-- stored answer to a tag question. Those are the reviewer's, not ours.


-- ---------------------------------------------------------------------------
-- Recording an admin edit
-- ---------------------------------------------------------------------------

alter table public.reviews
  add column if not exists admin_edited_at timestamptz,
  -- set null rather than cascade: if the admin's own account is deleted the
  -- fact that an edit happened must survive losing the name of who did it.
  add column if not exists admin_edited_by uuid references public.profiles (id) on delete set null;

comment on column public.reviews.admin_edited_at is
  'When an administrator last edited this review through the panel. Readable by everyone, like banned_at: reviews_set_updated_at bumps updated_at on an admin edit exactly as it does on the author''s own, so without this column an edit by someone else is indistinguishable from the author editing their own words.';


-- ---------------------------------------------------------------------------
-- admin_list_reviews
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_reviews(
  p_search text default null,
  -- The two link-throughs: Places -> "1 review", Users -> posted count.
  p_venue_id uuid default null,
  p_author_id uuid default null,
  p_min_stars integer default null,
  p_max_stars integer default null,
  -- 'any' | 'with' | 'without'. A rating with no words is legitimate - and is
  -- also the shape bulk ratings take, which is why it is worth filtering on.
  p_body text default 'any',
  -- The only yes/no/unsure column on a review. There is no lgbtq_friendly
  -- filter because there is no such column: 20260905134743 dropped it once the
  -- stars themselves became the friendliness rating (1 hostile, 5 welcoming).
  p_bathroom public.answer default null,
  p_tag_id uuid default null,
  -- 'any' | 'active' | 'banned'. Answers "what did the account I just banned
  -- leave behind", which is the first question after any ban.
  p_author_status text default 'any',
  p_posted_after timestamptz default null,
  -- 'created_at' | 'updated_at' | 'stars' | 'venue_name' | 'author_name'
  p_sort text default 'created_at',
  p_desc boolean default true,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  venue_id uuid,
  venue_name text,
  venue_address text,
  author_id uuid,
  author_name text,
  author_banned_at timestamptz,
  author_is_admin boolean,
  stars smallint,
  trans_bathroom public.answer,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  admin_edited_at timestamptz,
  answer_count bigint,
  venue_tags jsonb,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
  -- RETURNS TABLE names share a namespace with column names; this makes the
  -- ambiguous case resolve to the column rather than to the output variable.
  #variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select
      r.id              as id,
      r.venue_id        as venue_id,
      v.name            as venue_name,
      v.address         as venue_address,
      r.author_id       as author_id,
      p.display_name    as author_name,
      p.banned_at       as author_banned_at,
      (ad.user_id is not null) as author_is_admin,
      r.stars           as stars,
      r.trans_bathroom  as trans_bathroom,
      r.body            as body,
      r.created_at      as created_at,
      r.updated_at      as updated_at,
      r.admin_edited_at as admin_edited_at,
      (select count(*) from public.review_answers ra where ra.review_id = r.id) as answer_count,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'slug', t.slug, 'label', t.label,
                 'color', t.color, 'text_color', t.text_color)
               order by t.sort_order, t.label)
        from public.venue_tags vt
        join public.tags t on t.id = vt.tag_id
        where vt.venue_id = v.id
      ), '[]'::jsonb) as venue_tags
    from public.reviews r
    join public.venues v on v.id = r.venue_id
    join public.profiles p on p.id = r.author_id
    left join public.admins ad on ad.user_id = p.id
    where (
        p_search is null or p_search = ''
        -- % and _ reach ilike as wildcards. This is an admin-only box and that
        -- is useful more often than it is surprising.
        or r.body ilike '%' || p_search || '%'
        or v.name ilike '%' || p_search || '%'
        or p.display_name ilike '%' || p_search || '%'
        -- Any of the three ids, so a uuid copied from anywhere in the panel
        -- finds what it names.
        or r.id::text        like lower(p_search) || '%'
        or r.venue_id::text  like lower(p_search) || '%'
        or r.author_id::text like lower(p_search) || '%'
      )
      and (p_venue_id  is null or r.venue_id  = p_venue_id)
      and (p_author_id is null or r.author_id = p_author_id)
      and (p_min_stars is null or r.stars >= p_min_stars)
      and (p_max_stars is null or r.stars <= p_max_stars)
      and (
        p_body is null or p_body = 'any'
        -- Whitespace-only prose is not prose. Matching the panel's "Rating
        -- only" to what a person would call empty costs one btrim.
        or (p_body = 'with'    and r.body is not null and btrim(r.body) <> '')
        or (p_body = 'without' and (r.body is null or btrim(r.body) = ''))
      )
      and (p_bathroom is null or r.trans_bathroom = p_bathroom)
      and (
        p_author_status is null or p_author_status = 'any'
        or (p_author_status = 'banned' and p.banned_at is not null)
        or (p_author_status = 'active' and p.banned_at is null)
      )
      and (p_posted_after is null or r.created_at >= p_posted_after)
      and (
        p_tag_id is null
        or exists (
          select 1 from public.venue_tags vt
          where vt.venue_id = r.venue_id and vt.tag_id = p_tag_id
        )
      )
  )
  select
    f.id,
    f.venue_id,
    f.venue_name,
    f.venue_address,
    f.author_id,
    f.author_name,
    f.author_banned_at,
    f.author_is_admin,
    f.stars,
    f.trans_bathroom,
    f.body,
    f.created_at,
    f.updated_at,
    f.admin_edited_at,
    f.answer_count,
    f.venue_tags,
    -- The size of the whole filtered set, carried on every row, so the
    -- paginator costs no second round trip.
    count(*) over () as total_count
  from filtered f
  -- p_sort is matched, never interpolated: a sort column arriving from the
  -- client is a string, and a string spliced into SQL is an injection.
  order by
    case when p_sort = 'created_at'  and not p_desc then f.created_at end asc,
    case when p_sort = 'created_at'  and p_desc     then f.created_at end desc,
    case when p_sort = 'updated_at'  and not p_desc then f.updated_at end asc,
    case when p_sort = 'updated_at'  and p_desc     then f.updated_at end desc,
    case when p_sort = 'stars'       and not p_desc then f.stars end asc,
    case when p_sort = 'stars'       and p_desc     then f.stars end desc,
    case when p_sort = 'venue_name'  and not p_desc then f.venue_name end asc,
    case when p_sort = 'venue_name'  and p_desc     then f.venue_name end desc,
    case when p_sort = 'author_name' and not p_desc then f.author_name end asc,
    case when p_sort = 'author_name' and p_desc     then f.author_name end desc,
    -- Breaks ties, so a row cannot land on two pages or on neither. Sorting by
    -- stars without this would reshuffle five-star reviews on every request.
    f.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
) is 'One page of the admin reviews list, with each review''s venue, author, answer count and the size of the whole filtered set. Admin only.';


-- ---------------------------------------------------------------------------
-- admin_review_answers
-- ---------------------------------------------------------------------------

-- Fetched when a row is expanded rather than carried on every row of the list:
-- most reviews are read as a line, and the answers are several rows each.
create or replace function public.admin_review_answers(p_review_id uuid)
returns table (
  question_id uuid,
  prompt text,
  help_text text,
  kind public.question_kind,
  config jsonb,
  archived boolean,
  -- One column per storage shape, mirroring the map documented on
  -- public.review_answers: value_bool is yes_no, value_answer is yes_no_unsure,
  -- value_option_ids is single/multi_select, value_number covers number, scale,
  -- rating, currency and duration, and value_text carries the rest including
  -- the ISO-8601 time and date kinds. Passed through rather than flattened to a
  -- string here, because only the client knows a rating is stars and a currency
  -- needs its code from config.
  value_text text,
  value_number numeric,
  value_bool boolean,
  value_answer public.answer,
  option_labels text[],
  answered_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
  #variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    q.id,
    -- The wording it was ANSWERED under, which is the entire reason an answered
    -- question is archived and superseded rather than edited in place. Joining
    -- questions directly is what preserves that; following supersedes_id to the
    -- current wording would quietly reattribute an answer to a question the
    -- person was never asked.
    q.prompt,
    q.help_text,
    q.kind,
    q.config,
    (q.archived_at is not null) as archived,
    ra.value_text,
    ra.value_number,
    ra.value_bool,
    ra.value_answer,
    case
      when ra.value_option_ids is null then null
      else (
        select array_agg(
                 -- An option deleted since answering leaves an id pointing at
                 -- nothing. Saying so beats dropping it silently and making a
                 -- three-choice answer look like a two-choice one.
                 coalesce(qo.label, '(removed option)')
                 order by coalesce(qo.sort_order, 2147483647), coalesce(qo.label, '')
               )
        from unnest(ra.value_option_ids) as chosen(option_id)
        left join public.question_options qo on qo.id = chosen.option_id
      )
    end as option_labels,
    ra.answered_at
  from public.review_answers ra
  join public.questions q on q.id = ra.question_id
  join public.reviews r on r.id = ra.review_id
  where ra.review_id = p_review_id
  -- Questionnaire order, reconstructed: the venue's tags in their own order,
  -- then the question's position within whichever of them asks it first.
  -- sort_order lives on question_tags, not on the question, because a shared
  -- question sits in a different place in each tag.
  order by (
    select min(t.sort_order * 100000 + qt.sort_order)
    from public.question_tags qt
    join public.tags t on t.id = qt.tag_id
    join public.venue_tags vt on vt.tag_id = qt.tag_id and vt.venue_id = r.venue_id
    where qt.question_id = q.id
  ) nulls last,  -- a question unassigned since is still shown, just last
  q.prompt;
end;
$$;

comment on function public.admin_review_answers(uuid) is
  'Every stored answer on one review, in the wording the reviewer was actually asked, ordered as the questionnaire presented them. Admin only.';


-- ---------------------------------------------------------------------------
-- admin_update_review
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_review(
  p_id uuid,
  p_stars integer,
  p_bathroom public.answer,
  p_body text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  -- Checked here rather than left to reviews_stars_check and
  -- reviews_body_length, because a raw constraint violation reaches the panel
  -- as 'new row for relation "reviews" violates check constraint ...', which
  -- tells a person nothing they can act on. P0001 so describe() passes the
  -- message through instead of rewriting it as a permission refusal.
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'A rating must be between 1 and 5 stars.' using errcode = 'P0001';
  end if;

  if char_length(v_body) > 2000 then
    raise exception 'A review can be at most 2000 characters.' using errcode = 'P0001';
  end if;

  update public.reviews
  set stars           = p_stars,
      trans_bathroom  = coalesce(p_bathroom, trans_bathroom),
      body            = v_body,
      admin_edited_at = now(),
      admin_edited_by = (select auth.uid())
  where id = p_id;

  if not found then
    raise exception 'no such review' using errcode = 'P0002';
  end if;
end;
$$;

-- Note the columns it does NOT touch: author_id, venue_id, created_at. An edit
-- can change what a review says; it cannot change whose it is or where it is.
comment on function public.admin_update_review(uuid, integer, public.answer, text) is
  'Edits the five columns of a review a moderator may legitimately change, and stamps admin_edited_at/by. Cannot reassign a review to another author or venue, and cannot alter a stored answer to a tag question. Admin only.';


-- ---------------------------------------------------------------------------
-- admin_delete_review
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_review(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  -- review_answers cascades from reviews, so the answers go with it.
  -- venue_ratings is a view, so the venue's count and average recompute
  -- themselves - there is no denormalised total to keep in step.
  delete from public.reviews where id = p_id;

  if not found then
    -- Two admins on the same row, or a row deleted by its author while the
    -- panel held it. Either way the list is stale and should be refetched.
    raise exception 'no such review' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_delete_review(uuid) is
  'Deletes one review and, by cascade, its answers. Not reversible. Admin only.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon.
revoke execute on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
) from public;
revoke execute on function public.admin_review_answers(uuid) from public;
revoke execute on function public.admin_update_review(uuid, integer, public.answer, text) from public;
revoke execute on function public.admin_delete_review(uuid) from public;

-- Granted to every signed-in user because a grant is not finer-grained than a
-- role. The is_admin() check at the top of each function is what refuses.
grant execute on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
) to authenticated;
grant execute on function public.admin_review_answers(uuid) to authenticated;
grant execute on function public.admin_update_review(uuid, integer, public.answer, text) to authenticated;
grant execute on function public.admin_delete_review(uuid) to authenticated;
