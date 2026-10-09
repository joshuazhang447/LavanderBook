-- Per-place names: a different public name on every review.
--
-- A generated display name hides who someone is, but not that two reviews are
-- by the same person. One name across every review lets anyone line them up -
-- the bar on Friday, the clinic near work, the cafe by home - and enough places
-- in one name narrow it to a household. Nobody needs the account to do that;
-- the public review list is enough.
--
-- So each review can carry a name of its own, reviews.alias, drawn when the
-- review is first posted and shown wherever the review is shown, in place of
-- the account's display name. profiles.per_place_names is the account's
-- switch, on by default. Admins still see the account behind every alias: the
-- panel's functions run as definer and read author_id as they always have.
--
-- The rules, and why:
--
--   * One alias per review, for the life of the review. An edit keeps it. A
--     new name on every save would add nothing - the review id is public, so
--     the old and new names are linked the moment they are seen - and it would
--     make a review look like it changed hands. Deleting and posting again is
--     a new review and draws a new name.
--   * The switch only ever adds protection to what is already published.
--     Turning it on names every review of the caller's that still shows the
--     account name. Turning it off changes only reviews posted afterwards; it
--     never puts the account name back on a review that has its own, because
--     doing that would link every one of them at once.
--   * One namespace. An alias is never an account's display name and never
--     another review's alias, or a reader would link two people who are not
--     the same, or one person to someone else's reviews. Aliases look exactly
--     like display names, so a single review does not say which it carries.
--   * Unpredictable. Names are drawn from gen_random_uuid(), which reads the
--     operating system's CSPRNG, rather than random(), a fast generator whose
--     next output follows from its state.
--   * Renaming is not editing. reviews_set_updated_at now fires only for the
--     columns a person writes. Before this it stamped every update, and the
--     toggle renames all of an account's reviews in one transaction: every one
--     of them would have carried the same updated_at, to the microsecond, and
--     been linked more reliably than a shared name ever linked them.
--   * Clients write only what an author writes. INSERT and UPDATE on reviews
--     become column grants, so a client cannot set an alias - its own, or
--     someone else's display name to impersonate them. (The same allowlist
--     also stops a client moving its review to another venue, backdating it,
--     or clearing the admin-edit stamp on it, all of which it could until now.)
--
-- What this cannot do. Re-aliasing old reviews hides their link from whoever
-- looks from now on; it cannot unpublish it for anyone who already looked. The
-- rename also reaches realtime subscribers as one burst of UPDATE events, alias
-- stripped (it is not granted), which says what the shared name already said.
-- And a name is only one thread: what someone writes, when, and how often can
-- still connect reviews. The account tab says so.
--
-- Compatibility. venue_reviews keeps its author_name column and
-- venue_answer_summary its display_name key; both now carry the alias when
-- there is one. Every client already installed shows the protected name with
-- no update, which is the point - protection that waits for an app update is
-- not protection for the people who have not updated.


-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column per_place_names boolean not null default true;

comment on column public.profiles.per_place_names is
  'When true, every review this account posts is shown under its own generated name (reviews.alias) rather than display_name, and turning it on names the account''s existing reviews too. Readable only by the account itself, like the rest of the row. Changed through set_per_place_names(), never directly.';

alter table public.reviews
  add column alias text,
  -- The same bounds as profiles.display_name: it is the same kind of name.
  add constraint reviews_alias_length
    check (alias is null or char_length(alias) between 3 and 40),
  -- Two reviews sharing an alias would read as one person. Null is "shown
  -- under the account name", and any number of reviews can be that.
  add constraint reviews_alias_key unique (alias);

-- Deliberately not added to the column grant from 20261008090000: the public
-- reads the name a review is shown under through venue_reviews(), and whether a
-- review has an alias of its own is nobody else's business.
comment on column public.reviews.alias is
  'The name this review is shown under in place of its author''s display name. Null means it is shown under the display name. Set once, server-side, when the review is first posted (reviews_assign_alias) or when its author turns per-place names on; an edit keeps it. Not granted to anon or authenticated: venue_reviews() and venue_answer_summary() show it, admin_list_reviews() shows it beside the account.';


-- ---------------------------------------------------------------------------
-- Names: unpredictable, and one namespace
-- ---------------------------------------------------------------------------

-- A uniform integer in [0, p_n). 24 bits of a v4 uuid - the first three bytes
-- are all random - so the bias from the modulo is under 0.006% for any n here.
create or replace function public.secure_random_below(p_n integer)
returns integer
language sql
volatile
set search_path = ''
as $$
  select ((get_byte(s.b, 0) << 16) | (get_byte(s.b, 1) << 8) | get_byte(s.b, 2)) % p_n
  from (select uuid_send(gen_random_uuid()) as b) s;
$$;

comment on function public.secure_random_below(integer) is
  'A uniform integer from 0 to p_n - 1, drawn from gen_random_uuid() (the operating system''s CSPRNG) rather than random(). For names, where a predictable draw would let someone work out which names were issued next.';

-- Same word lists, so an alias is indistinguishable from an account name. What
-- changes is where the randomness comes from, and that a candidate now has to
-- be free in both places a name can be shown.
create or replace function public.generate_display_name()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  adjectives text[] := array[
    'Quiet','Brave','Gentle','Bright','Kind','Swift','Calm','Bold',
    'Lucky','Sunny','Wild','Clever','Merry','Noble','Warm','Keen'
  ];
  nouns text[] := array[
    'Heron','Fox','Willow','Otter','Sparrow','Cedar','Robin','Lynx',
    'Maple','Finch','Badger','Hazel','Wren','Poppy','Marten','Aspen'
  ];
  candidate text;
  attempts int := 0;
begin
  loop
    candidate :=
      adjectives[1 + public.secure_random_below(array_length(adjectives, 1))] ||
      nouns[1 + public.secure_random_below(array_length(nouns, 1))] ||
      (100 + public.secure_random_below(900))::text;

    exit when not exists (
      select 1 from public.profiles p where p.display_name = candidate
    ) and not exists (
      select 1 from public.reviews r where r.alias = candidate
    );

    -- 16 x 16 x 900 is about 230k combinations, shared now between accounts
    -- and reviews, so collisions are rare - but never let a signup or a post
    -- spin forever if the space fills up.
    attempts := attempts + 1;
    if attempts > 20 then
      candidate := left('Guest' || replace(gen_random_uuid()::text, '-', ''), 24);
      exit;
    end if;
  end loop;

  return candidate;
end;
$$;

comment on function public.generate_display_name() is
  'A fresh generated name, unused by any account (profiles.display_name) and any review (reviews.alias). Used for both, so the two are indistinguishable. Drawn with secure_random_below().';


-- ---------------------------------------------------------------------------
-- updated_at: content only
-- ---------------------------------------------------------------------------

-- UPDATE OF fires when a listed column is in the SET list, changed or not. That
-- keeps "saving clears the new-questions nudge" (my_new_question_count): an
-- author who re-saves an unchanged review still moves updated_at. Both writers
-- name all three - submit_review's upsert and admin_update_review - and a
-- direct client update can only name these three now (see Write grants).
--
-- Not listed: alias. A rename must not stamp the time; see the header.
drop trigger reviews_set_updated_at on public.reviews;

create trigger reviews_set_updated_at
  before update of stars, trans_bathroom, body on public.reviews
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- reviews_assign_alias - the name is decided here, not by the caller
-- ---------------------------------------------------------------------------

-- A trigger rather than a line in submit_review, so every route that creates a
-- review gets the same treatment, including a direct insert. It overwrites
-- whatever alias arrived: the author's switch decides, nobody's argument.
--
-- It also fires on submit_review's upsert when the review already exists; the
-- name it draws is then discarded, because the DO UPDATE does not set alias.
-- That wasted draw is deliberate. Skipping it when a review "already exists"
-- would race the author deleting that review, and let the new one in unnamed.
--
-- Security definer: generate_display_name is not executable by the posting
-- role, and the switch is read regardless of RLS on profiles.
create or replace function public.reviews_assign_alias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per_place boolean;
begin
  -- FOR SHARE so this and set_per_place_names() cannot interleave. The toggle
  -- updates the profile row before it names the account's reviews; holding a
  -- share lock on that row here means either the toggle waits for this review
  -- to commit (and then names it), or this waits for the toggle (and then
  -- reads its new value). Without it, a review posted while the switch was
  -- being turned on could land after the sweep and still show the account name.
  select p.per_place_names into v_per_place
  from public.profiles p
  where p.id = new.author_id
  for share;

  -- No profile means the foreign key is about to refuse the row anyway. If it
  -- somehow did not, the protective answer is the right default.
  new.alias := case
    when coalesce(v_per_place, true) then public.generate_display_name()
  end;

  return new;
end;
$$;

comment on function public.reviews_assign_alias() is
  'BEFORE INSERT on reviews: draws the review''s alias when its author has per-place names on, and clears any alias the caller supplied otherwise.';

create trigger reviews_assign_alias
  before insert on public.reviews
  for each row execute function public.reviews_assign_alias();


-- ---------------------------------------------------------------------------
-- Write grants - what an author writes, and nothing else
-- ---------------------------------------------------------------------------

-- revoke-then-grant, as with SELECT in 20261008090000: a table-level grant
-- covers every column, so a column grant beneath it would change nothing.
-- The app writes through submit_review and delete_my_review, which run as
-- definer and are untouched by this; these are the direct routes the reviews
-- policies still allow. DELETE stays table-level - it names no columns.
revoke insert, update on public.reviews from authenticated;

grant insert (venue_id, author_id, stars, trans_bathroom, body)
  on public.reviews to authenticated;
grant update (stars, trans_bathroom, body)
  on public.reviews to authenticated;


-- ---------------------------------------------------------------------------
-- set_per_place_names - the account tab's switch
-- ---------------------------------------------------------------------------

-- A function rather than an UPDATE grant on profiles, for the reason
-- admin_set_banned is one: a policy would grant the whole row, and turning the
-- switch on has to do more than write it.
--
-- Not gated on a ban. A banned account cannot post, so "off" changes nothing
-- for it; and "on" only takes the account name off what is already published,
-- which a ban has no reason to prevent. The panel still sees the account.
create or replace function public.set_per_place_names(p_enabled boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_review_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to change this.' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Choose on or off.' using errcode = '22023';
  end if;

  -- First, so the row lock it takes orders this against any review being
  -- posted right now; see reviews_assign_alias.
  update public.profiles p
  set per_place_names = p_enabled
  where p.id = v_uid;

  if not found then
    raise exception 'no such profile' using errcode = 'P0002';
  end if;

  -- On: everything of theirs still under the account name gets a name of its
  -- own. One statement per review, so each draw sees the names drawn before
  -- it and the unique constraint is never the thing that catches a collision.
  -- Off: nothing here. The next review simply draws no name.
  if p_enabled then
    for v_review_id in
      select r.id from public.reviews r
      where r.author_id = v_uid and r.alias is null
    loop
      update public.reviews r
      set alias = public.generate_display_name()
      where r.id = v_review_id;
    end loop;
  end if;

  return p_enabled;
end;
$$;

comment on function public.set_per_place_names(boolean) is
  'Turns the caller''s per-place names on or off, and returns the new setting. On also gives each of their reviews still shown under the account name a name of its own; off affects only reviews posted afterwards and never removes a name. Does not touch updated_at.';


-- ---------------------------------------------------------------------------
-- What the public sees
-- ---------------------------------------------------------------------------

-- Unchanged but for the name. author_name keeps its name so installed clients
-- pick the alias up without an update; it says nothing about whether the name
-- is an alias, which is the point.
create or replace function public.venue_reviews(p_venue_id uuid)
returns table (
  id          uuid,
  stars       smallint,
  body        text,
  author_name text,
  is_mine     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.stars,
    r.body,
    coalesce(r.alias, p.display_name),
    -- auth.uid() is null for a signed-out caller, and false is the honest
    -- answer to "is this yours" there.
    coalesce(r.author_id = (select auth.uid()), false)
  from public.reviews r
  left join public.profiles p on p.id = r.author_id
  where r.venue_id = p_venue_id
  order by r.created_at desc, r.id desc;
$$;

comment on function public.venue_reviews(uuid) is
  'Every review of one venue, newest first, with the name it is shown under - its alias, or else the author''s display name - and whether it is the caller''s own. In place of author_id, which is not public.';

comment on column public.reviews.author_id is
  'Not granted to anon or authenticated. The caller''s own reviews come from my_reviews(); everyone else''s from venue_reviews(), which carries the name the review is shown under and an is_mine flag instead of this id.';

-- The free-text quotes carried the author's display name beside each answer,
-- which would have undone every alias on the same page. Now the review's name:
-- the same one shown on the review itself, so a quote and its review still
-- read as one person. The key stays display_name for installed clients.
create or replace function public.venue_answer_summary(p_venue_id uuid)
returns table (
  question_id      uuid,
  prompt           text,
  help_text        text,
  kind             public.question_kind,
  config           jsonb,
  options          jsonb,
  archived         boolean,
  tag_id           uuid,
  tag_slug         text,
  tag_label        text,
  tag_color        text,
  tag_text_color   text,
  respondents      integer,
  answered_reviews integer,
  summary          jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with answered as (
    select ra.*, r.author_id, r.alias
    from public.review_answers ra
    join public.reviews r on r.id = ra.review_id
    where r.venue_id = p_venue_id
  ),
  per_question as (
    select a.question_id, count(*)::integer as n
    from answered a
    group by a.question_id
  ),
  coverage as (
    select count(distinct a.review_id)::integer as answered_reviews
    from answered a
  )
  select
    q.id,
    q.prompt,
    q.help_text,
    q.kind,
    q.config,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                       order by o.sort_order, o.label)
      from public.question_options o
      where o.question_id = q.id
    ), '[]'::jsonb),
    q.archived_at is not null,
    tg.id,
    tg.slug,
    tg.label,
    tg.color,
    tg.text_color,
    pq.n,
    coverage.answered_reviews,
    case
      when q.kind = 'yes_no' then (
        select jsonb_build_object(
          'yes', count(*) filter (where a.value_bool),
          'no',  count(*) filter (where not a.value_bool))
        from answered a where a.question_id = q.id)

      when q.kind = 'yes_no_unsure' then (
        select jsonb_build_object(
          'yes',    count(*) filter (where a.value_answer = 'yes'),
          'no',     count(*) filter (where a.value_answer = 'no'),
          'unsure', count(*) filter (where a.value_answer = 'unsure'))
        from answered a where a.question_id = q.id)

      -- Every option, including the ones nobody picked: a zero is information.
      when q.kind in ('single_select', 'multi_select') then (
        select jsonb_build_object('options', coalesce(jsonb_agg(
          jsonb_build_object(
            'option_id', o.id,
            'label',     o.label,
            'count',     (select count(*) from answered a
                          where a.question_id = q.id and o.id = any(a.value_option_ids)))
          order by o.sort_order, o.label), '[]'::jsonb))
        from public.question_options o where o.question_id = q.id)

      when q.kind = 'scale' then (
        select jsonb_build_object(
          'avg', round(avg(a.value_number), 2),
          'min', min(a.value_number),
          'max', max(a.value_number),
          'distribution', (
            select jsonb_agg(jsonb_build_object(
              'value', s,
              'count', (select count(*) from answered a2
                        where a2.question_id = q.id and a2.value_number = s))
              order by s)
            from generate_series((q.config ->> 'min')::numeric::integer,
                                 (q.config ->> 'max')::numeric::integer) s))
        from answered a where a.question_id = q.id)

      when q.kind = 'rating' then (
        select jsonb_build_object('avg', round(avg(a.value_number), 2))
        from answered a where a.question_id = q.id)

      -- Median rather than mean for the headline: one person typing 1200 beds
      -- should not move "about 12" to "about 250".
      when q.kind in ('number', 'currency', 'duration') then (
        select jsonb_build_object(
          'median', round((percentile_cont(0.5) within group (order by a.value_number))::numeric, 2),
          'min',    min(a.value_number),
          'max',    max(a.value_number),
          'avg',    round(avg(a.value_number), 2))
        from answered a where a.question_id = q.id)

      when q.kind in ('time_of_day', 'time_range', 'date') then jsonb_build_object(
        'mode', (
          select jsonb_build_object('value', a.value_text, 'count', count(*))
          from answered a where a.question_id = q.id
          group by a.value_text
          order by count(*) desc, a.value_text
          limit 1),
        'distinct', coalesce((
          select jsonb_agg(d.x)
          from (
            select jsonb_build_object('value', a.value_text, 'count', count(*)) as x
            from answered a where a.question_id = q.id
            group by a.value_text
            order by count(*) desc, a.value_text
            limit 5) d), '[]'::jsonb))

      -- Free text is shown, not counted. The latest few, with the name their
      -- review is shown under, exactly as a review body is.
      when q.kind in ('short_text', 'long_text') then jsonb_build_object(
        'recent', coalesce((
          select jsonb_agg(jsonb_build_object(
            'text', x.value_text,
            'display_name', coalesce(x.alias, p.display_name),
            'answered_at', x.answered_at)
            order by x.answered_at desc)
          from (
            select a.value_text, a.answered_at, a.author_id, a.alias
            from answered a where a.question_id = q.id
            order by a.answered_at desc
            limit 5) x
          join public.profiles p on p.id = x.author_id), '[]'::jsonb))
    end
  from per_question pq
  join public.questions q on q.id = pq.question_id
  cross join coverage
  -- The first of the venue's current live tags that asks this question. Null
  -- means nothing here asks it any more - the tag was removed or the question
  -- unassigned - and the sheet says so rather than hiding the answers.
  left join lateral (
    select t.id, t.slug, t.label, t.color, t.text_color,
           t.sort_order as tag_sort, qt.sort_order as question_sort
    from public.venue_tags vt
    join public.tags t on t.id = vt.tag_id and t.archived_at is null
    join public.question_tags qt on qt.tag_id = t.id and qt.question_id = q.id
    where vt.venue_id = p_venue_id
    order by t.sort_order, t.label
    limit 1
  ) tg on true
  order by tg.tag_sort nulls last, tg.label nulls last, tg.question_sort, lower(q.prompt);
$$;

comment on function public.venue_answer_summary(uuid) is
  'Aggregated tag-question answers for one venue, one row per answered question. Every count is out of the people who answered that question, never the review count. Free-text quotes carry the name their review is shown under (in the display_name key). Security definer only so that a superseded question''s wording can still be read; exposes nothing beyond questions answered at this venue.';


-- ---------------------------------------------------------------------------
-- my_reviews - now saying what each review is shown as
-- ---------------------------------------------------------------------------

-- The account tab and the review sheet show the author which name each review
-- carries, because once there are several, nobody can be expected to remember
-- them - and a review you cannot recognise as yours is one you cannot vouch for.
--
-- Dropped rather than replaced: create or replace cannot change a function's
-- return type, and this adds a column to it.
drop function if exists public.my_reviews();

create function public.my_reviews()
returns table (
  id                    uuid,
  venue_id              uuid,
  stars                 smallint,
  trans_bathroom        public.answer,
  body                  text,
  updated_at            timestamptz,
  alias                 text,
  venue_name            text,
  venue_lat             double precision,
  venue_lng             double precision,
  venue_google_place_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.venue_id,
    r.stars,
    r.trans_bathroom,
    r.body,
    r.updated_at,
    r.alias,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id
  from public.reviews r
  join public.venues v on v.id = r.venue_id
  where r.author_id = (select auth.uid())
  order by r.updated_at desc, r.id desc;
$$;

comment on function public.my_reviews() is
  'The caller''s own reviews with the venue each is about and the alias each is shown under (null: their display name), most recently saved first. Empty for a caller with no reviews; not callable signed out.';


-- ---------------------------------------------------------------------------
-- admin_list_reviews - the alias beside the account
-- ---------------------------------------------------------------------------

-- An alias hides the account from readers, never from moderators. Each row now
-- carries both, and the search box finds a review by the name a reader saw -
-- which is what a report about a review will quote.
--
-- Dropped rather than replaced, for the return type.
drop function if exists public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
);

create function public.admin_list_reviews(
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
  -- The name readers see. Null: they see author_name.
  alias text,
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
      r.alias           as alias,
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
        or r.alias ilike '%' || p_search || '%'
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
    f.alias,
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
) is 'One page of the admin reviews list, with each review''s venue, author account, the alias readers see instead (if any), answer count and the size of the whole filtered set. Search matches aliases too. Admin only.';


-- ---------------------------------------------------------------------------
-- admin_list_profiles - found by any of their aliases
-- ---------------------------------------------------------------------------

-- "Who is BraveOtter456?" asked in Users should find the account, not nothing.
-- Same signature and return type, so a replace; only the search clause moves.
create or replace function public.admin_list_profiles(
  p_search text default null,
  -- 'all' | 'active' | 'banned' | 'admin'
  p_status text default 'all',
  p_min_reviews integer default null,
  p_max_reviews integer default null,
  p_joined_after timestamptz default null,
  -- 'id' | 'display_name' | 'created_at' | 'review_count'
  p_sort text default 'created_at',
  p_desc boolean default true,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  created_at timestamptz,
  banned_at timestamptz,
  review_count bigint,
  is_admin boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
  -- RETURNS TABLE names share a namespace with column names. Everything below is
  -- qualified anyway; this makes the ambiguous case resolve to the column rather
  -- than silently to the output variable. The output column called is_admin
  -- does not shadow public.is_admin() - a call is not a reference - but every
  -- call to it below stays schema-qualified regardless.
  #variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  -- One grouped pass over reviews rather than a subquery per row, so filtering
  -- and sorting on the count are correct rather than only cosmetic. Served by
  -- reviews_author_id_idx.
  with counted as (
    select r.author_id, count(*) as n
    from public.reviews r
    group by r.author_id
  ),
  filtered as (
    select
      p.id             as id,
      p.display_name   as display_name,
      p.created_at     as created_at,
      p.banned_at      as banned_at,
      coalesce(c.n, 0) as review_count,
      (ad.user_id is not null) as is_admin
    from public.profiles p
    left join counted c on c.author_id = p.id
    -- A join rather than an exists() per row: the table is tiny, and this way
    -- the same fact also filters (p_status = 'admin') without a second lookup.
    left join public.admins ad on ad.user_id = p.id
    where (
        p_search is null or p_search = ''
        -- % and _ reach ilike as wildcards. This is an admin-only box and that
        -- is useful more often than it is surprising.
        or p.display_name ilike '%' || p_search || '%'
        -- Pasting a whole uuid should find exactly one row, and typing the first
        -- few characters of one should narrow to it.
        or p.id::text like lower(p_search) || '%'
        -- The name on one of their reviews, which is the only name a reader
        -- reporting a review will have.
        or exists (
          select 1 from public.reviews r
          where r.author_id = p.id and r.alias ilike '%' || p_search || '%'
        )
      )
      and (
        p_status is null or p_status = 'all'
        or (p_status = 'banned' and p.banned_at is not null)
        or (p_status = 'active' and p.banned_at is null)
        or (p_status = 'admin'  and ad.user_id is not null)
      )
      and (p_min_reviews is null or coalesce(c.n, 0) >= p_min_reviews)
      and (p_max_reviews is null or coalesce(c.n, 0) <= p_max_reviews)
      and (p_joined_after is null or p.created_at >= p_joined_after)
  )
  select
    f.id,
    f.display_name,
    f.created_at,
    f.banned_at,
    f.review_count,
    f.is_admin,
    -- The size of the whole filtered set, carried on every row, so the paginator
    -- costs no second round trip.
    count(*) over () as total_count
  from filtered f
  -- p_sort is matched, never interpolated: a sort column arriving from the
  -- client is a string, and a string spliced into SQL is an injection. The cost
  -- is that no index can serve this, so it is always a sort - which at any
  -- profile count this app will plausibly reach is a couple of milliseconds.
  order by
    case when p_sort = 'display_name' and not p_desc then f.display_name end asc,
    case when p_sort = 'display_name' and p_desc     then f.display_name end desc,
    case when p_sort = 'created_at'   and not p_desc then f.created_at end asc,
    case when p_sort = 'created_at'   and p_desc     then f.created_at end desc,
    case when p_sort = 'review_count' and not p_desc then f.review_count end asc,
    case when p_sort = 'review_count' and p_desc     then f.review_count end desc,
    case when p_sort = 'id'           and not p_desc then f.id end asc,
    case when p_sort = 'id'           and p_desc     then f.id end desc,
    -- Breaks ties, so a row cannot land on two pages or on neither.
    f.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.admin_list_profiles(
  text, text, integer, integer, timestamptz, text, boolean, integer, integer
) is 'One page of the admin users list, with each profile''s review count, whether it is an administrator, and the size of the whole filtered set. Search matches a display name, a uuid prefix, or the alias on any of the account''s reviews. Admin only.';


-- ---------------------------------------------------------------------------
-- Existing reviews
-- ---------------------------------------------------------------------------

-- Every account starts with the switch on, so every review already posted gets
-- its name now - the same thing turning the switch on does for one account.
-- Leaving them under the account name would show "on" beside reviews that are
-- still linked to each other.
--
-- Row by row for the reason set_per_place_names is: each draw sees the ones
-- before it. After the trigger change above, so updated_at is left alone.
do $$
declare
  v_review_id uuid;
begin
  for v_review_id in select r.id from public.reviews r where r.alias is null loop
    update public.reviews r
    set alias = public.generate_display_name()
    where r.id = v_review_id;
  end loop;
end
$$;


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Helpers reached only from definer code, like generate_display_name itself.
revoke execute on function public.secure_random_below(integer) from public, anon, authenticated;
revoke execute on function public.reviews_assign_alias()       from public, anon, authenticated;

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon. The
-- drops above took my_reviews' and admin_list_reviews' grants with them, so
-- both are granted again as well as revoked again.
revoke execute on function public.set_per_place_names(boolean) from public, anon;
revoke execute on function public.my_reviews()                  from public, anon;
revoke execute on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
) from public, anon;

grant execute on function public.set_per_place_names(boolean) to authenticated;
grant execute on function public.my_reviews()                  to authenticated;
-- Granted to every signed-in user because a grant is not finer-grained than a
-- role. The is_admin() check at the top of the function is what refuses.
grant execute on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
) to authenticated;
