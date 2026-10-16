-- Moderators decide in the queue.
--
-- The panel's side of 20261016100100-20261016100300: the queue, the decisions,
-- the word list and its switch. Every function opens with the is_admin()
-- check, because rendering the panel is a client-side decision (Admin area,
-- rule 1), and none of the moderation tables has a policy or a grant: these
-- functions are the only way to them.
--
-- A decision writes reviews.moderation and nothing else on the review - not
-- updated_at, not admin_edited_at. Publishing or keeping a review also records
-- the terms a person has now read on it (review_screening.cleared), so the
-- same words do not hold it again when its author edits a typo.
--
-- Decisions carry what the moderator was looking at (p_seen_status,
-- p_seen_updated_at). Two moderators, or a moderator and an author editing,
-- can otherwise overwrite each other without either knowing.
--
-- One function writes to many of one author's reviews at once:
-- admin_take_down_author_reviews. Hidden dates, rule 4, says never to - rows
-- that change together read as one person. It is allowed for an account
-- already banned, whose reviews are coming down because of who wrote them, and
-- nowhere else.


-- ---------------------------------------------------------------------------
-- The queue
-- ---------------------------------------------------------------------------

create or replace function public.admin_moderation_counts()
returns table (decide bigint, look bigint, enforced boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where c.queue = 'decide'),
    count(*) filter (where c.queue = 'look'),
    public.moderation_enforced()
  from public.moderation_cases c
  where c.state = 'open';
end;
$$;

comment on function public.admin_moderation_counts() is
  'How many open items are in each list (decide is the panel''s badge), and whether the word list is enforcing. Admin only.';

create or replace function public.admin_list_cases(
  -- 'decide' | 'look' (open items) | 'decided' (closed ones, newest first)
  p_queue  text default 'decide',
  -- 'any' | 'review' | 'venue_name' | 'reported'
  p_kind   text default 'any',
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id                uuid,
  kind              text,
  state             text,
  queue             text,
  priority          integer,
  signals           text[],
  report_count      integer,
  -- [{reason, count}]
  report_reasons    jsonb,
  opened_at         timestamptz,
  updated_at        timestamptz,
  decision          text,
  reason            text,
  note              text,
  decided_at        timestamptz,
  decided_by_name   text,
  -- [{id, term, tier, category}]: what matched
  terms             jsonb,
  review_id         uuid,
  moderation        text,
  venue_id          uuid,
  venue_name        text,
  venue_address     text,
  google_place_id   text,
  pending_name      text,
  -- [{text, hit}], venue_name items only
  name_segments     jsonb,
  author_id         uuid,
  author_name       text,
  alias             text,
  author_banned_at  timestamptz,
  author_is_admin   boolean,
  stars             smallint,
  trans_bathroom    public.answer,
  body              text,
  -- [{text, hit}]
  body_segments     jsonb,
  -- [{question_id, prompt, segments}] for the free-text answers that matched
  answer_segments   jsonb,
  review_created_at timestamptz,
  review_updated_at timestamptz,
  admin_edited_at   timestamptz,
  hide_date         boolean,
  posted_period     text,
  answer_count      bigint,
  venue_tags        jsonb,
  total_count       bigint
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
  with picked as (
    select c.*
    from public.moderation_cases c
    where (
        (p_queue = 'decided' and c.state = 'closed')
        or (p_queue in ('decide', 'look') and c.state = 'open' and c.queue = p_queue)
      )
      and (
        p_kind is null or p_kind = 'any'
        or (p_kind = 'review'     and c.kind = 'review')
        or (p_kind = 'venue_name' and c.kind = 'venue_name')
        or (p_kind = 'reported'   and c.report_count > 0)
      )
  )
  select
    c.id,
    c.kind,
    c.state,
    c.queue,
    c.priority,
    c.signals,
    c.report_count,
    coalesce((
      select jsonb_agg(jsonb_build_object('reason', x.reason, 'count', x.n) order by x.n desc, x.reason)
      from (
        select rr.reason, count(*) as n
        from public.review_reports rr
        where rr.case_id = c.id
        group by rr.reason
      ) x
    ), '[]'::jsonb),
    c.opened_at,
    c.updated_at,
    c.decision,
    c.reason,
    c.note,
    c.decided_at,
    dp.display_name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'term', t.term, 'tier', t.tier, 'category', t.category)
             order by t.tier, lower(t.term))
      from public.moderation_terms t
      where t.id = any(c.term_ids)
    ), '[]'::jsonb),
    c.review_id,
    r.moderation,
    v.id,
    v.name,
    v.address,
    v.google_place_id,
    v.pending_name,
    case when c.kind = 'venue_name'
      then public.moderation_segments(coalesce(v.pending_name, v.name), c.term_ids)
    end,
    coalesce(r.author_id, c.author_id),
    ap.display_name,
    r.alias,
    ap.banned_at,
    (ad.user_id is not null),
    r.stars,
    r.trans_bathroom,
    r.body,
    case when r.id is not null
      then public.moderation_segments(r.body, coalesce(s.hits, c.term_ids))
    end,
    case when r.id is not null then coalesce((
      select jsonb_agg(jsonb_build_object(
               'question_id', x.question_id, 'prompt', x.prompt, 'segments', x.segments)
             order by lower(x.prompt))
      from (
        select q.id as question_id, q.prompt,
               public.moderation_segments(ra.value_text, coalesce(s.hits, c.term_ids)) as segments
        from public.review_answers ra
        join public.questions q on q.id = ra.question_id
        where ra.review_id = r.id
          and q.kind in ('short_text', 'long_text')
          and ra.value_text is not null
      ) x
      where jsonb_path_exists(x.segments, '$[*] ? (@.hit == true)')
    ), '[]'::jsonb) end,
    r.created_at,
    r.updated_at,
    r.admin_edited_at,
    r.hide_date,
    case when r.id is not null then public.posting_period(r.created_at) end,
    case when r.id is not null
      then (select count(*) from public.review_answers ra2 where ra2.review_id = r.id)
    end,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'slug', t.slug, 'label', t.label,
               'color', t.color, 'text_color', t.text_color)
             order by t.sort_order, t.label)
      from public.venue_tags vt
      join public.tags t on t.id = vt.tag_id
      where vt.venue_id = v.id
    ), '[]'::jsonb),
    count(*) over ()
  from picked c
  left join public.reviews r on r.id = c.review_id
  left join public.review_screening s on s.review_id = r.id
  left join public.venues v on v.id = coalesce(r.venue_id, c.venue_id)
  left join public.profiles ap on ap.id = coalesce(r.author_id, c.author_id)
  left join public.admins ad on ad.user_id = ap.id
  left join public.profiles dp on dp.id = c.decided_by
  -- Open lists: most urgent first, then oldest. Decided: newest decision first.
  order by
    case when p_queue <> 'decided' then c.priority end desc,
    case when p_queue <> 'decided' then c.opened_at end asc,
    case when p_queue = 'decided' then c.decided_at end desc,
    c.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.admin_list_cases(text, text, integer, integer) is
  'One page of the queue: open items needing a decision or worth a look, or decided ones. Each carries the review (or place name) as it stands now, with matched words marked, its author with both names, the signals that put it there and a count of reports by reason. Admin only.';

create or replace function public.admin_case_reports(p_case_id uuid)
returns table (
  id                    uuid,
  reporter_id           uuid,
  reporter_name         text,
  reporter_joined_at    timestamptz,
  reporter_banned_at    timestamptz,
  reporter_review_count bigint,
  reports_sent          bigint,
  reports_upheld        bigint,
  reports_dismissed     bigint,
  reason                text,
  note                  text,
  created_at            timestamptz,
  outcome               text
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
    rr.id,
    rr.reporter_id,
    p.display_name,
    p.created_at,
    p.banned_at,
    (select count(*) from public.reviews r where r.author_id = rr.reporter_id),
    (select count(*) from public.review_reports x where x.reporter_id = rr.reporter_id),
    (select count(*) from public.review_reports x where x.reporter_id = rr.reporter_id and x.outcome = 'upheld'),
    (select count(*) from public.review_reports x where x.reporter_id = rr.reporter_id and x.outcome = 'dismissed'),
    rr.reason,
    rr.note,
    rr.created_at,
    rr.outcome
  from public.review_reports rr
  join public.profiles p on p.id = rr.reporter_id
  where rr.case_id = p_case_id
  order by rr.created_at, rr.id;
end;
$$;

-- An account that has only ever reported, with nothing upheld, joined last
-- week, reporting the same place as four others: that is what this is for.
comment on function public.admin_case_reports(uuid) is
  'The reports behind one queue item, each with its reporter, how old their account is, what they have posted, and how many of their reports were upheld or dismissed. Admin only.';


-- ---------------------------------------------------------------------------
-- Deciding
-- ---------------------------------------------------------------------------

create or replace function public.admin_decide_review(
  p_review_id       uuid,
  -- 'publish' (a held or rejected review) | 'keep' (a published one) | 'reject'
  p_decision        text,
  p_reason          text default null,
  p_note            text default null,
  -- What the moderator was looking at. Stale: refused, so nobody decides on
  -- words that changed under them or overrides a decision they have not seen.
  p_seen_status     text default null,
  p_seen_updated_at timestamptz default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_author   uuid;
  v_status   text;
  v_updated  timestamptz;
  v_next     text;
  v_decision text;
  v_hits     uuid[];
  v_case     uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select r.author_id, r.moderation, r.updated_at
    into v_author, v_status, v_updated
  from public.reviews r
  where r.id = p_review_id
  for update;

  if not found then
    raise exception 'That review has been deleted.' using errcode = 'P0002';
  end if;
  if p_seen_status is not null and p_seen_status <> v_status then
    raise exception 'Someone has already decided this one. Refresh to see what they did.'
      using errcode = 'P0001';
  end if;
  if p_seen_updated_at is not null and p_seen_updated_at <> v_updated then
    raise exception 'The author changed this review while you were looking. Read it again before deciding.'
      using errcode = 'P0001';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = 'P0001';
  end if;

  case p_decision
    when 'publish' then
      if v_status not in ('held', 'rejected') then
        raise exception 'This review is already published.' using errcode = 'P0001';
      end if;
      v_next := 'published';
      v_decision := 'published';
    when 'keep' then
      if v_status <> 'published' then
        raise exception 'Only a published review can be kept up.' using errcode = 'P0001';
      end if;
      v_next := 'published';
      v_decision := 'kept';
    when 'reject' then
      if v_status = 'rejected' then
        raise exception 'This review is already rejected.' using errcode = 'P0001';
      end if;
      if p_reason is null or not public.moderation_reason_valid(p_reason) then
        raise exception 'Pick a reason for the author.' using errcode = 'P0001';
      end if;
      v_next := 'rejected';
      v_decision := 'rejected';
    else
      raise exception 'Unknown decision.' using errcode = 'P0001';
  end case;

  -- moderation only: reviews_set_updated_at fires on stars, trans_bathroom and
  -- body, so the review's own times do not move.
  if v_next <> v_status then
    update public.reviews r set moderation = v_next where r.id = p_review_id;
  end if;

  select s.hits into v_hits from public.review_screening s where s.review_id = p_review_id;
  v_hits := coalesce(v_hits, '{}');

  -- A person has read these words and let them stand.
  if v_decision in ('published', 'kept') then
    insert into public.review_screening as s (review_id, hits, cleared, scanned_at)
    values (p_review_id, v_hits, v_hits, now())
    on conflict (review_id) do update
      set cleared = array(select distinct x from unnest(s.cleared || excluded.hits) as x);
  end if;

  update public.moderation_cases c
  set state      = 'closed',
      decision   = v_decision,
      reason     = case when v_decision = 'rejected' then p_reason end,
      note       = v_note,
      decided_by = v_uid,
      decided_at = now(),
      updated_at = now()
  where c.review_id = p_review_id
    and c.kind = 'review'
    and c.state = 'open'
  returning c.id into v_case;

  -- Decided from the Reviews section with nothing open: still recorded, so the
  -- history is complete and my_reviews can tell the author why.
  if v_case is null then
    insert into public.moderation_cases
      (kind, review_id, author_id, state, queue, priority, signals, term_ids,
       decision, reason, note, decided_by, decided_at)
    values
      ('review', p_review_id, v_author, 'closed', 'decide', 0, array['direct'], v_hits,
       v_decision, case when v_decision = 'rejected' then p_reason end, v_note, v_uid, now());
  end if;

  update public.review_reports rr
  set outcome = case when v_decision = 'rejected' then 'upheld' else 'dismissed' end
  where rr.review_id = p_review_id
    and rr.outcome is null;

  return v_next;
end;
$$;

comment on function public.admin_decide_review(uuid, text, text, text, text, timestamptz) is
  'Publishes a held or rejected review, keeps a published one up, or rejects either with a reason (and an optional note) its author is shown. Writes only reviews.moderation, records the terms now read on it, closes its queue item and settles its reports. Refuses when the review changed since the moderator saw it. Admin only.';

create or replace function public.admin_decide_venue_name(
  p_venue_id uuid,
  -- 'publish' (the held name) | 'rename' | 'keep' (a watched name, as it is)
  p_decision text,
  p_name     text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_pending  text;
  v_name     text;
  v_decision text;
  v_case     uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select v.pending_name into v_pending
  from public.venues v
  where v.id = p_venue_id
  for update;

  if not found then
    raise exception 'That place has been deleted.' using errcode = 'P0002';
  end if;

  case p_decision
    when 'publish' then
      if v_pending is not null then
        update public.venues v set name = v_pending, pending_name = null where v.id = p_venue_id;
      end if;
      v_decision := 'published';
    when 'rename' then
      v_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
      if char_length(v_name) not between 1 and 200 then
        raise exception 'Give the place a name of 1 to 200 characters.' using errcode = 'P0001';
      end if;
      update public.venues v set name = v_name, pending_name = null where v.id = p_venue_id;
      v_decision := 'renamed';
    when 'keep' then
      if v_pending is not null then
        raise exception 'This name is still waiting. Publish it or rename the place.' using errcode = 'P0001';
      end if;
      v_decision := 'kept';
    else
      raise exception 'Unknown decision.' using errcode = 'P0001';
  end case;

  update public.moderation_cases c
  set state      = 'closed',
      decision   = v_decision,
      decided_by = v_uid,
      decided_at = now(),
      updated_at = now()
  where c.venue_id = p_venue_id
    and c.kind = 'venue_name'
    and c.state = 'open'
  returning c.id into v_case;

  if v_case is null then
    insert into public.moderation_cases
      (kind, venue_id, state, queue, priority, signals, decision, decided_by, decided_at)
    values
      ('venue_name', p_venue_id, 'closed', 'decide', 0, array['direct'], v_decision, v_uid, now());
  end if;

  return v_decision;
end;
$$;

comment on function public.admin_decide_venue_name(uuid, text, text) is
  'Publishes a held place name, gives the place a new one, or keeps a watched name as it is, and closes its queue item. Admin only.';

create or replace function public.admin_take_down_author_reviews(
  p_user   uuid,
  p_reason text,
  p_note   text default null
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_review uuid;
  v_case   uuid;
  v_count  integer := 0;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user and p.banned_at is not null) then
    raise exception 'Ban the account first. Taking down every review at once links them to one another, so it is kept for accounts that have been banned.'
      using errcode = 'P0001';
  end if;
  if p_reason is null or not public.moderation_reason_valid(p_reason) then
    raise exception 'Pick a reason for the author.' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = 'P0001';
  end if;

  -- The documented exception to Hidden dates, rule 4: every review of one
  -- account changes at once. They are coming down because of who wrote them,
  -- so linking them says nothing a reader could use against their author.
  for v_review in
    select r.id
    from public.reviews r
    where r.author_id = p_user
      and r.moderation <> 'rejected'
    order by r.id
    for update
  loop
    update public.reviews r set moderation = 'rejected' where r.id = v_review;

    v_case := null;
    update public.moderation_cases c
    set state      = 'closed',
        decision   = 'rejected',
        reason     = p_reason,
        note       = v_note,
        decided_by = v_uid,
        decided_at = now(),
        updated_at = now()
    where c.review_id = v_review
      and c.kind = 'review'
      and c.state = 'open'
    returning c.id into v_case;

    if v_case is null then
      insert into public.moderation_cases
        (kind, review_id, author_id, state, queue, priority, signals, term_ids,
         decision, reason, note, decided_by, decided_at)
      values
        ('review', v_review, p_user, 'closed', 'decide', 0, array['take_down'],
         coalesce((select s.hits from public.review_screening s where s.review_id = v_review), '{}'),
         'rejected', p_reason, v_note, v_uid, now());
    end if;

    update public.review_reports rr
    set outcome = 'upheld'
    where rr.review_id = v_review
      and rr.outcome is null;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.admin_take_down_author_reviews(uuid, text, text) is
  'Rejects every review a banned account has up, with one reason and note, and records each decision. The one function that changes many of one author''s reviews at once (Hidden dates, rule 4); refused unless the account is already banned. Returns how many were taken down. Admin only.';


-- ---------------------------------------------------------------------------
-- The word list
-- ---------------------------------------------------------------------------

-- What is wrong with a term, in words for the panel, or null. Shared by the
-- dialog's save and the import's preview, so both refuse the same things.
create or replace function public.moderation_term_problem(
  p_term       text,
  p_tier       text,
  p_category   text,
  p_match_mode text,
  p_language   text,
  p_allow      text[],
  p_note       text
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_term    text := btrim(regexp_replace(coalesce(p_term, ''), '\s+', ' ', 'g'));
  v_folded  text;
  v_pattern text;
  v_allow   text;
begin
  if v_term = '' then
    return 'Write the word.';
  end if;
  if char_length(v_term) > 100 then
    return 'Keep the word under 100 characters.';
  end if;
  if p_tier is null or p_tier not in ('hold', 'watch') then
    return 'Tier must be hold or watch.';
  end if;
  if p_category is null or p_category not in ('transphobic', 'homophobic', 'racist', 'ableist', 'misogynist') then
    return 'Category must be transphobic, homophobic, racist, ableist or misogynist.';
  end if;
  if p_match_mode is null or p_match_mode not in ('word', 'prefix', 'anywhere') then
    return 'Match must be word, prefix or anywhere.';
  end if;
  if p_language is not null and p_language !~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$' then
    return 'Language must be a code like en, zh or pt-BR.';
  end if;
  if coalesce(cardinality(p_allow), 0) > 50 then
    return 'At most 50 allowed phrases.';
  end if;
  if char_length(p_note) > 500 then
    return 'Keep the note under 500 characters.';
  end if;

  v_folded := btrim(regexp_replace(public.moderation_fold(v_term), '\s+', ' ', 'g'));
  if v_folded = '' then
    return 'That word is empty once accents and spacing are taken out.';
  end if;
  if p_match_mode = 'anywhere' and v_folded ~ '^[a-z0-9 ]{1,3}$' then
    return 'A word this short would match inside other words. Use whole word or prefix.';
  end if;

  begin
    v_pattern := public.moderation_compile(v_folded, p_match_mode);
    perform '' collate "pg_c_utf8" ~ v_pattern;
    v_allow := public.moderation_compile_allow(p_allow);
    if v_allow is not null then
      perform '' collate "pg_c_utf8" ~ v_allow;
    end if;
  exception when others then
    return 'That word could not be turned into a pattern.';
  end;

  return null;
end;
$$;

comment on function public.moderation_term_problem(text, text, text, text, text, text[], text) is
  'Why a term cannot be saved, in words for the panel, or null when it can. Internal.';

create or replace function public.admin_list_terms(p_include_archived boolean default true)
returns table (
  id              uuid,
  term            text,
  language        text,
  tier            text,
  category        text,
  match_mode      text,
  allow           text[],
  note            text,
  archived_at     timestamptz,
  created_at      timestamptz,
  created_by_name text,
  updated_at      timestamptz,
  -- Reviews it matched at their last scan, and how many of those are held now.
  review_count    bigint,
  held_count      bigint
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
    t.id,
    t.term,
    t.language,
    t.tier,
    t.category,
    t.match_mode,
    t.allow,
    t.note,
    t.archived_at,
    t.created_at,
    cp.display_name,
    t.updated_at,
    (select count(*) from public.review_screening s where t.id = any(s.hits)),
    (select count(*)
       from public.review_screening s
       join public.reviews r on r.id = s.review_id
      where t.id = any(s.hits) and r.moderation = 'held')
  from public.moderation_terms t
  left join public.profiles cp on cp.id = t.created_by
  where coalesce(p_include_archived, true) or t.archived_at is null
  order by t.archived_at nulls first, t.tier, lower(t.term), t.id;
end;
$$;

comment on function public.admin_list_terms(boolean) is
  'The word list with how many reviews each term matched and how many of those are held. Admin only.';

create or replace function public.admin_create_term(
  p_term       text,
  p_tier       text,
  p_category   text,
  p_match_mode text default 'word',
  p_language   text default null,
  p_allow      text[] default null,
  p_note       text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_problem text;
  v_id      uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  v_problem := public.moderation_term_problem(p_term, p_tier, p_category, p_match_mode,
                                              nullif(btrim(coalesce(p_language, '')), ''), p_allow, p_note);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = 'P0001';
  end if;

  begin
    insert into public.moderation_terms
      (term, language, tier, category, match_mode, allow, note, created_by, updated_by)
    values
      (p_term, nullif(btrim(coalesce(p_language, '')), ''), p_tier, p_category, p_match_mode,
       coalesce(p_allow, '{}'), nullif(btrim(coalesce(p_note, '')), ''), v_uid, v_uid)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'That word is already on the list with the same match.' using errcode = '23505';
  end;

  return v_id;
end;
$$;

comment on function public.admin_create_term(text, text, text, text, text, text[], text) is
  'Adds a term to the word list and returns its id. It takes effect on the next review saved; admin_rescreen_reviews applies it to reviews already posted. Admin only.';

create or replace function public.admin_update_term(
  p_id         uuid,
  p_term       text,
  p_tier       text,
  p_category   text,
  p_match_mode text,
  p_language   text,
  p_allow      text[],
  p_note       text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_problem text;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  v_problem := public.moderation_term_problem(p_term, p_tier, p_category, p_match_mode,
                                              nullif(btrim(coalesce(p_language, '')), ''), p_allow, p_note);
  if v_problem is not null then
    raise exception '%', v_problem using errcode = 'P0001';
  end if;

  begin
    update public.moderation_terms t
    set term       = p_term,
        language   = nullif(btrim(coalesce(p_language, '')), ''),
        tier       = p_tier,
        category   = p_category,
        match_mode = p_match_mode,
        allow      = coalesce(p_allow, '{}'),
        note       = nullif(btrim(coalesce(p_note, '')), ''),
        updated_at = now(),
        updated_by = (select auth.uid())
    where t.id = p_id;
  exception when unique_violation then
    raise exception 'That word is already on the list with the same match.' using errcode = '23505';
  end;

  if not found then
    raise exception 'no such word' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_update_term(uuid, text, text, text, text, text, text[], text) is
  'Changes a term. Reviews already scanned keep their hits until the next rescan. Admin only.';

create or replace function public.admin_set_term_archived(p_id uuid, p_archived boolean)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_archived_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  begin
    update public.moderation_terms t
    set archived_at = case when p_archived then coalesce(t.archived_at, now()) else null end,
        updated_at  = now(),
        updated_by  = (select auth.uid())
    where t.id = p_id
    returning t.archived_at into v_archived_at;
  exception when unique_violation then
    raise exception 'A live entry with the same spelling and match already exists. Archive that one first.'
      using errcode = '23505';
  end;

  if not found then
    raise exception 'no such word' using errcode = 'P0002';
  end if;

  return v_archived_at;
end;
$$;

comment on function public.admin_set_term_archived(uuid, boolean) is
  'Archives a term (it stops matching, and stays for the history of the reviews it matched) or restores it. Returns archived_at. Admin only.';

create or replace function public.admin_delete_term(p_id uuid)
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

  if exists (select 1 from public.review_screening s where p_id = any(s.hits) or p_id = any(s.cleared))
     or exists (select 1 from public.moderation_cases c where p_id = any(c.term_ids)) then
    raise exception 'This word has matched reviews. Archive it instead, so their history still makes sense.'
      using errcode = '23503';
  end if;

  delete from public.moderation_terms t where t.id = p_id;

  if not found then
    raise exception 'no such word' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_delete_term(uuid) is
  'Deletes a term that has never matched anything - a typo caught in time. Anything that has matched is archived instead. Admin only.';

/*
 * Imports the reviewers' workbook, pasted from the panel.
 *
 * p_rows is a JSON array of {line, term, tier, category, match?, language?,
 * allow?, note?}; allow is a list, or one string separated by semicolons.
 * Every row comes back with what happens to it: add, update (same spelling and
 * match, something else changed), same, duplicate (earlier in this paste) or
 * invalid, with the problem. Nothing is written unless p_apply.
 *
 * Language, allow and note left empty in the paste keep what an existing entry
 * has, so a workbook that does not carry them cannot wipe them.
 */
create or replace function public.admin_import_terms(p_rows jsonb, p_apply boolean default false)
returns table (
  line       integer,
  term       text,
  language   text,
  tier       text,
  category   text,
  match_mode text,
  action     text,
  problem    text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
  #variable_conflict use_column
declare
  v_uid      uuid := (select auth.uid());
  v_row      jsonb;
  v_ord      bigint;
  v_term     text;
  v_language text;
  v_tier     text;
  v_category text;
  v_mode     text;
  v_allow    text[];
  v_note     text;
  v_folded   text;
  v_key      text;
  v_seen     text[] := '{}';
  v_problem  text;
  v_action   text;
  v_existing record;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Nothing to import.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import at most 2000 rows at a time.' using errcode = 'P0001';
  end if;

  for v_row, v_ord in
    select x.e, x.o from jsonb_array_elements(p_rows) with ordinality as x(e, o)
  loop
    v_problem := null;
    v_action := null;

    if jsonb_typeof(v_row) <> 'object' then
      line := v_ord::integer;
      term := null; language := null; tier := null; category := null; match_mode := null;
      action := 'invalid';
      problem := 'Not a row.';
      return next;
      continue;
    end if;

    v_term := btrim(regexp_replace(coalesce(v_row ->> 'term', ''), '\s+', ' ', 'g'));
    v_language := nullif(lower(btrim(coalesce(v_row ->> 'language', ''))), '');
    v_tier := lower(btrim(coalesce(v_row ->> 'tier', '')));
    v_category := lower(btrim(coalesce(v_row ->> 'category', '')));
    v_mode := coalesce(nullif(lower(btrim(coalesce(v_row ->> 'match', ''))), ''), 'word');
    v_note := nullif(btrim(coalesce(v_row ->> 'note', '')), '');
    v_allow := case jsonb_typeof(v_row -> 'allow')
      when 'array' then array(
        select btrim(a) from jsonb_array_elements_text(v_row -> 'allow') as a where btrim(a) <> '')
      when 'string' then array(
        select btrim(a) from unnest(string_to_array(v_row ->> 'allow', ';')) as a where btrim(a) <> '')
      else '{}'::text[]
    end;

    line := case when (v_row ->> 'line') ~ '^[0-9]{1,9}$' then (v_row ->> 'line')::integer else v_ord::integer end;
    term := v_term;
    language := v_language;
    tier := v_tier;
    category := v_category;
    match_mode := v_mode;

    v_problem := public.moderation_term_problem(v_term, v_tier, v_category, v_mode, v_language, v_allow, v_note);
    if v_problem is not null then
      action := 'invalid';
      problem := v_problem;
      return next;
      continue;
    end if;

    v_folded := btrim(regexp_replace(public.moderation_fold(v_term), '\s+', ' ', 'g'));
    v_key := v_mode || ':' || v_folded;
    if v_key = any(v_seen) then
      action := 'duplicate';
      problem := 'Already earlier in this paste.';
      return next;
      continue;
    end if;
    v_seen := v_seen || v_key;

    select t.id, t.tier, t.category, t.language, t.allow, t.note
      into v_existing
    from public.moderation_terms t
    where t.folded = v_folded
      and t.match_mode = v_mode
      and t.archived_at is null;

    if not found then
      v_action := 'add';
    elsif v_existing.tier = v_tier
      and v_existing.category = v_category
      and (v_language is null or v_existing.language is not distinct from v_language)
      and (cardinality(v_allow) = 0
           or array(select distinct x from unnest(v_allow) as x order by x)
              = array(select x from unnest(v_existing.allow) as x order by x))
      and (v_note is null or v_existing.note is not distinct from v_note) then
      v_action := 'same';
    else
      v_action := 'update';
    end if;

    if p_apply and v_action in ('add', 'update') then
      begin
        if v_action = 'add' then
          insert into public.moderation_terms
            (term, language, tier, category, match_mode, allow, note, created_by, updated_by)
          values
            (v_term, v_language, v_tier, v_category, v_mode, v_allow, v_note, v_uid, v_uid);
        else
          update public.moderation_terms t
          set term       = v_term,
              language   = coalesce(v_language, t.language),
              tier       = v_tier,
              category   = v_category,
              allow      = case when cardinality(v_allow) = 0 then t.allow else v_allow end,
              note       = coalesce(v_note, t.note),
              updated_at = now(),
              updated_by = v_uid
          where t.id = v_existing.id;
        end if;
      exception when others then
        action := 'invalid';
        problem := 'Could not be saved: ' || sqlerrm;
        return next;
        continue;
      end;
    end if;

    action := v_action;
    problem := null;
    return next;
  end loop;
end;
$$;

comment on function public.admin_import_terms(jsonb, boolean) is
  'Previews (p_apply false) or applies a pasted import of the word list, row by row: add, update, same, duplicate or invalid, with the problem. Empty language, allow and note keep an existing entry''s. Admin only.';

create or replace function public.admin_moderation_try(p_text text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hits uuid[];
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if char_length(p_text) > 2000 then
    raise exception 'Try at most 2000 characters.' using errcode = 'P0001';
  end if;

  v_hits := public.moderation_screen(array[p_text]);

  -- Masked as readers would see it while enforcing, whatever the mode now.
  return jsonb_build_object(
    'folded',   public.moderation_fold(p_text),
    'terms',    coalesce((
                  select jsonb_agg(jsonb_build_object(
                           'id', t.id, 'term', t.term, 'tier', t.tier, 'category', t.category)
                         order by t.tier, lower(t.term))
                  from public.moderation_terms t
                  where t.id = any(v_hits)
                ), '[]'::jsonb),
    'held',     exists (select 1 from public.moderation_terms t where t.id = any(v_hits) and t.tier = 'hold'),
    'masked',   public.moderation_apply_mask(p_text, v_hits),
    'segments', public.moderation_segments(p_text, v_hits)
  );
end;
$$;

comment on function public.admin_moderation_try(text) is
  'What the word list makes of a piece of text: its folded form, the terms it matches, whether a review saying it would be held, and how readers would see it once a person published it. Admin only.';


-- ---------------------------------------------------------------------------
-- The switch, and catching up
-- ---------------------------------------------------------------------------

create or replace function public.admin_moderation_settings()
returns table (
  enforced         boolean,
  updated_at       timestamptz,
  updated_by_name  text,
  -- Reviews waiting for a person right now.
  held_now         bigint,
  -- Items shadow mode opened in the last seven days: what enforcing would have held.
  shadow_last_week bigint
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
    ms.enforced,
    ms.updated_at,
    p.display_name,
    (select count(*) from public.reviews r where r.moderation = 'held'),
    (select count(*) from public.moderation_cases c
      where 'shadow_hold' = any(c.signals) and c.opened_at > now() - interval '7 days')
  from public.moderation_settings ms
  left join public.profiles p on p.id = ms.updated_by
  where ms.id;
end;
$$;

comment on function public.admin_moderation_settings() is
  'Whether the word list is enforcing, who last changed that and when, how many reviews are held now, and how many shadow-mode items the last week opened. Admin only.';

create or replace function public.admin_set_moderation_enforced(p_enforced boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_enforced is null then
    raise exception 'Choose on or off.' using errcode = 'P0001';
  end if;

  -- Holding is never retroactive, in either direction: switching on holds
  -- nothing already published, and switching off publishes nothing already
  -- held. Masking is: switching on masks hold words in published reviews -
  -- including ones posted during shadow mode, which no person has read - and
  -- switching off unmasks them.
  update public.moderation_settings ms
  set enforced   = p_enforced,
      updated_at = now(),
      updated_by = (select auth.uid())
  where ms.id;

  return p_enforced;
end;
$$;

comment on function public.admin_set_moderation_enforced(boolean) is
  'Turns enforcing on (hold-tier words hold reviews and are masked once published) or off (shadow mode: recorded only). Changes nothing already decided. Admin only.';

/*
 * Scans reviews already posted against the list as it is now - after an
 * import, or a term added. One batch per call, in id order: PostgREST stops a
 * statement after a few seconds, so the panel calls again with next_after
 * until it comes back null.
 *
 * It never writes reviews, so it is never a realtime event and never holds
 * anything. A published review with a hit nobody has read yet becomes an item
 * in "Worth a look".
 */
create or replace function public.admin_rescreen_reviews(
  p_after uuid default null,
  p_limit integer default 200
)
returns table (scanned integer, changed integer, opened integer, next_after uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit   integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_review  record;
  v_hits    uuid[];
  v_old     uuid[];
  v_cleared uuid[];
  v_new     uuid[];
  v_last    uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  scanned := 0;
  changed := 0;
  opened := 0;
  next_after := null;

  for v_review in
    select r.id, r.author_id, r.body, r.moderation
    from public.reviews r
    where p_after is null or r.id > p_after
    order by r.id
    limit v_limit
  loop
    scanned := scanned + 1;
    v_last := v_review.id;

    begin
      v_hits := public.moderation_screen(
        array[v_review.body]
        || array(
             select ra.value_text
             from public.review_answers ra
             join public.questions q on q.id = ra.question_id
             where ra.review_id = v_review.id
               and q.kind in ('short_text', 'long_text')
               and ra.value_text is not null
           )
      );
    exception when others then
      continue;
    end;

    v_old := null;
    v_cleared := null;
    select s.hits, s.cleared into v_old, v_cleared
    from public.review_screening s
    where s.review_id = v_review.id;

    if v_old is distinct from v_hits then
      changed := changed + 1;
    end if;

    insert into public.review_screening as s (review_id, hits, scanned_at)
    values (v_review.id, v_hits, now())
    on conflict (review_id) do update
      set hits       = excluded.hits,
          scanned_at = excluded.scanned_at;

    -- Hits that are new since the last scan, and that nobody has read.
    v_new := array(
      select h from unnest(v_hits) as h
      where not (h = any(coalesce(v_old, '{}')))
        and not (h = any(coalesce(v_cleared, '{}')))
    );

    if v_review.moderation = 'published' and cardinality(v_new) > 0 then
      perform public.moderation_note_case('review', v_review.id, null, v_review.author_id,
                                          'rescan', 'look', 15, v_hits);
      opened := opened + 1;
    end if;
  end loop;

  if scanned = v_limit then
    next_after := v_last;
  end if;

  return next;
end;
$$;

comment on function public.admin_rescreen_reviews(uuid, integer) is
  'Scans one batch of existing reviews against the current list, in id order, and records what each matches. Never changes a review. Published reviews with new, unread hits become items in Worth a look. Call again with next_after until it is null. Admin only.';


-- ---------------------------------------------------------------------------
-- The Reviews section learns the status
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced: a new parameter and two new columns.
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
  p_offset integer default 0,
  -- 'any' | 'published' | 'held' | 'rejected'
  p_moderation text default 'any'
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
  -- Readers see posted_period instead of the date when this is true.
  hide_date boolean,
  posted_period text,
  answer_count bigint,
  venue_tags jsonb,
  -- published | held | rejected
  moderation text,
  -- The review's open queue item, if it has one.
  open_case_id uuid,
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
      r.hide_date       as hide_date,
      public.posting_period(r.created_at) as posted_period,
      (select count(*) from public.review_answers ra where ra.review_id = r.id) as answer_count,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'slug', t.slug, 'label', t.label,
                 'color', t.color, 'text_color', t.text_color)
               order by t.sort_order, t.label)
        from public.venue_tags vt
        join public.tags t on t.id = vt.tag_id
        where vt.venue_id = v.id
      ), '[]'::jsonb) as venue_tags,
      r.moderation      as moderation,
      (select c.id from public.moderation_cases c
        where c.review_id = r.id and c.kind = 'review' and c.state = 'open') as open_case_id
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
      and (p_moderation is null or p_moderation = 'any' or r.moderation = p_moderation)
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
    f.hide_date,
    f.posted_period,
    f.answer_count,
    f.venue_tags,
    f.moderation,
    f.open_case_id,
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
  text, timestamptz, text, boolean, integer, integer, text
) is 'One page of the admin reviews list, with each review''s venue, author account, the alias readers see instead (if any), its exact times, whether readers see its date or only its posting period, its moderation status and open queue item, answer count and the size of the whole filtered set. Search matches aliases too. Admin only.';

-- Same signature. After the edit it rescans the review, and records what it
-- matches as read: an admin wrote these words.
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
  v_hits uuid[];
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

  begin
    v_hits := public.moderation_screen(
      array[v_body]
      || array(
           select ra.value_text
           from public.review_answers ra
           join public.questions q on q.id = ra.question_id
           where ra.review_id = p_id
             and q.kind in ('short_text', 'long_text')
             and ra.value_text is not null
         )
    );
  exception when others then
    return;
  end;

  insert into public.review_screening as s (review_id, hits, cleared, scanned_at)
  values (p_id, v_hits, v_hits, now())
  on conflict (review_id) do update
    set hits       = excluded.hits,
        cleared    = array(select distinct x from unnest(s.cleared || excluded.hits) as x),
        scanned_at = excluded.scanned_at;

  update public.moderation_cases c
  set term_ids   = v_hits,
      signals    = array(select distinct x from unnest(c.signals || array['admin_edited']) as x order by x),
      updated_at = now()
  where c.review_id = p_id
    and c.kind = 'review'
    and c.state = 'open';
end;
$$;

-- Note the columns it does NOT touch: author_id, venue_id, created_at,
-- moderation. An edit can change what a review says; it cannot change whose it
-- is, where it is, or whether it is shown - that is admin_decide_review.
comment on function public.admin_update_review(uuid, integer, public.answer, text) is
  'Edits the columns of a review a moderator may legitimately change, and stamps admin_edited_at/by. Rescans it and records its matches as read, since an admin wrote them. Cannot reassign a review, alter a stored answer to a tag question, or change whether it is shown. Admin only.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.moderation_term_problem(text, text, text, text, text, text[], text)
  from public, anon, authenticated;

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon.
revoke execute on function public.admin_moderation_counts()                                    from public, anon;
revoke execute on function public.admin_list_cases(text, text, integer, integer)                from public, anon;
revoke execute on function public.admin_case_reports(uuid)                                      from public, anon;
revoke execute on function public.admin_decide_review(uuid, text, text, text, text, timestamptz) from public, anon;
revoke execute on function public.admin_decide_venue_name(uuid, text, text)                     from public, anon;
revoke execute on function public.admin_take_down_author_reviews(uuid, text, text)              from public, anon;
revoke execute on function public.admin_list_terms(boolean)                                     from public, anon;
revoke execute on function public.admin_create_term(text, text, text, text, text, text[], text) from public, anon;
revoke execute on function public.admin_update_term(uuid, text, text, text, text, text, text[], text) from public, anon;
revoke execute on function public.admin_set_term_archived(uuid, boolean)                        from public, anon;
revoke execute on function public.admin_delete_term(uuid)                                       from public, anon;
revoke execute on function public.admin_import_terms(jsonb, boolean)                            from public, anon;
revoke execute on function public.admin_moderation_try(text)                                    from public, anon;
revoke execute on function public.admin_moderation_settings()                                   from public, anon;
revoke execute on function public.admin_set_moderation_enforced(boolean)                        from public, anon;
revoke execute on function public.admin_rescreen_reviews(uuid, integer)                         from public, anon;
revoke execute on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer, text
) from public, anon;

-- Granted to every signed-in user because a grant is not finer-grained than a
-- role. The is_admin() check at the top of each function is what refuses.
grant execute on function public.admin_moderation_counts()                                    to authenticated;
grant execute on function public.admin_list_cases(text, text, integer, integer)                to authenticated;
grant execute on function public.admin_case_reports(uuid)                                      to authenticated;
grant execute on function public.admin_decide_review(uuid, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_decide_venue_name(uuid, text, text)                     to authenticated;
grant execute on function public.admin_take_down_author_reviews(uuid, text, text)              to authenticated;
grant execute on function public.admin_list_terms(boolean)                                     to authenticated;
grant execute on function public.admin_create_term(text, text, text, text, text, text[], text) to authenticated;
grant execute on function public.admin_update_term(uuid, text, text, text, text, text, text[], text) to authenticated;
grant execute on function public.admin_set_term_archived(uuid, boolean)                        to authenticated;
grant execute on function public.admin_delete_term(uuid)                                       to authenticated;
grant execute on function public.admin_import_terms(jsonb, boolean)                            to authenticated;
grant execute on function public.admin_moderation_try(text)                                    to authenticated;
grant execute on function public.admin_moderation_settings()                                   to authenticated;
grant execute on function public.admin_set_moderation_enforced(boolean)                        to authenticated;
grant execute on function public.admin_rescreen_reviews(uuid, integer)                         to authenticated;
grant execute on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer, text
) to authenticated;
