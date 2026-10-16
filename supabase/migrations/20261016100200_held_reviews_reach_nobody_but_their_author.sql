-- Held reviews reach nobody but their author.
--
-- A review that uses a hold-tier word (20261016100100) waits for a person
-- before anyone else can read it. Not refused: the same word is how somebody
-- says what was said to them, and that review is the warning. A person reads
-- it and publishes it, or rejects it with a reason its author is shown.
--
-- reviews.moderation is the whole of it: published, held or rejected.
--
--   * submit_review screens the body and every free-text answer BEFORE it
--     writes, and writes the status in the same statement as the words. A
--     review that has to wait is never, even inside its own transaction, a
--     visible row: realtime sends every review event to every open map, and
--     may judge visibility on the row as it was written.
--   * The reviews read policy becomes published-only - for everyone, the
--     author included - so venue_ratings, the map's counts and averages and
--     every realtime event are the same for all readers. The author sees their
--     own held or rejected review through my_reviews() and their own row of
--     venue_reviews(), both definer functions, which is where the app looks.
--   * Every security definer reader filters for published itself; definer
--     functions do not see policies.
--   * An author's save can only move a review towards held. Only the admin
--     functions (20261016100400) move it back.
--
-- Reports. A reader can report a published review. A report never hides
-- anything: it lands in the queue for a person to read. Reports are a weapon
-- in the wrong hands - a venue whose staff were the problem, or a group,
-- reporting the honest reviews to bury them - so the count of reports decides
-- nothing, and a report on words a person has already read and kept goes to
-- the low-priority list.
--
-- The queue. moderation_cases holds one open item per review (or per held
-- place name, 20261016100300) and gathers everything that happened to it -
-- held, watched, reported, edited - so a person decides once. Closed items are
-- the history: who decided, when and why. If the author deletes a review, its
-- item is closed and keeps who wrote it and which terms it matched, never the
-- words.
--
-- Shadow mode (moderation_settings.enforced = false, the starting state):
-- nothing is held or masked; what would have been held is recorded as a
-- low-priority item, so the list can be tuned on real reviews first.
--
-- Hidden dates. No time column is added to reviews, review_answers or venues,
-- and public lists keep their order. Case and report times are admin-only.
-- Bookkeeping - screening, cases, reports - is kept off reviews, which is the
-- only table realtime publishes, so none of it is ever an event.


-- ---------------------------------------------------------------------------
-- The status
-- ---------------------------------------------------------------------------

-- Added with 'published', which only changes the catalogue: every existing
-- review is published, no row is rewritten, and realtime sends nothing.
alter table public.reviews
  add column moderation text not null default 'published'
  constraint reviews_moderation_valid check (moderation in ('published', 'held', 'rejected'));

-- Then held, so a future writer that forgets to decide fails closed: its
-- reviews wait for a person instead of skipping the list.
alter table public.reviews alter column moderation set default 'held';

comment on column public.reviews.moderation is
  'published: readable by everyone. held: waiting for a person, readable only by its author through my_reviews and venue_reviews. rejected: a person decided it cannot be shown; its author sees why. Written in the same statement as the words (submit_review), and moved back towards published only by admin functions. Not granted to anon or authenticated.';

-- Readers fetch published reviews of one venue at a time.
create index reviews_published_venue_idx
  on public.reviews (venue_id)
  where moderation = 'published';


-- ---------------------------------------------------------------------------
-- Who may read what
-- ---------------------------------------------------------------------------

-- An answer is readable when its review is: published, or the caller's own.
-- Security definer because the caller cannot read author_id or moderation.
create or replace function public.review_is_readable(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reviews r
    where r.id = p_review_id
      and (r.moderation = 'published' or r.author_id = (select auth.uid()))
  );
$$;

comment on function public.review_is_readable(uuid) is
  'Whether the caller may read a review''s answers: it is published, or it is theirs. Used by the review_answers policy, so granted to anon as well (20260911200000) - it can only ever answer about published reviews and the caller''s own.';

drop policy "Reviews are readable by everyone" on public.reviews;
create policy "Published reviews are readable by everyone"
  on public.reviews for select
  using (moderation = 'published');

-- The author included: fetchMyAnswers reads this table directly, and must
-- still find the answers to a held review being edited, or submit_review's
-- delete-and-reinsert would quietly lose them.
drop policy "Review answers are readable by everyone" on public.review_answers;
create policy "Answers are readable with their review"
  on public.review_answers for select
  using (public.review_is_readable(review_id));

comment on view public.venue_ratings is
  'Counts are kept per answer rather than as a single percentage so the UI can distinguish "nobody knows" from "people say no" - they mean very different things. Runs as the caller, so it counts published reviews only, the same for every reader; a security definer function reading it sees every review.';


-- ---------------------------------------------------------------------------
-- Reasons
-- ---------------------------------------------------------------------------

-- One vocabulary for why a reader reports a review and why a person rejects
-- one. A function rather than an enum, as question_config_valid is: a new
-- value is a one-line change, not a migration of its own.
create or replace function public.moderation_reason_valid(p_reason text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_reason in ('hate', 'harassment', 'private_info', 'spam', 'not_genuine', 'other');
$$;

comment on function public.moderation_reason_valid(text) is
  'Whether a report or rejection reason is one of hate | harassment | private_info | spam | not_genuine | other. The wording for each lives in src/lib/moderation-text.ts.';


-- ---------------------------------------------------------------------------
-- The queue
-- ---------------------------------------------------------------------------

create table public.moderation_cases (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null
               constraint moderation_cases_kind_valid check (kind in ('review', 'venue_name')),
  -- set null, so the decision outlives a review its author deletes.
  review_id    uuid references public.reviews (id) on delete set null,
  venue_id     uuid references public.venues (id) on delete cascade,
  -- Who wrote the review, or who added the place.
  author_id    uuid references public.profiles (id) on delete set null,
  state        text not null default 'open'
               constraint moderation_cases_state_valid check (state in ('open', 'closed')),
  -- decide: "Needs a decision", counted on the panel's badge. look: "Worth a look".
  queue        text not null
               constraint moderation_cases_queue_valid check (queue in ('decide', 'look')),
  priority     integer not null default 0,
  -- What happened: held, resubmitted, screen_failed, shadow_hold, watch,
  -- edited_after_clear, edited, report, report_after_keep, rescan, venue_name, direct.
  signals      text[] not null default '{}',
  term_ids     uuid[] not null default '{}',
  report_count integer not null default 0,
  opened_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  decision     text
               constraint moderation_cases_decision_valid
               check (decision in ('published', 'kept', 'rejected', 'renamed', 'deleted_by_author', 'deleted_by_admin')),
  reason       text
               constraint moderation_cases_reason_valid
               check (reason is null or public.moderation_reason_valid(reason)),
  -- Shown to the author when the review is rejected.
  note         text
               constraint moderation_cases_note_length check (note is null or char_length(note) <= 500),
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz,
  constraint moderation_cases_decided check ((state = 'open') = (decision is null)),
  constraint moderation_cases_target check (
    (kind = 'review' and venue_id is null)
    or (kind = 'venue_name' and venue_id is not null and review_id is null)
  )
);

create unique index moderation_cases_one_open_review
  on public.moderation_cases (review_id)
  where state = 'open' and kind = 'review';

create unique index moderation_cases_one_open_venue
  on public.moderation_cases (venue_id)
  where state = 'open' and kind = 'venue_name';

create index moderation_cases_open_queue
  on public.moderation_cases (queue, priority desc, opened_at)
  where state = 'open';

create index moderation_cases_decided_idx
  on public.moderation_cases (decided_at desc)
  where state = 'closed';

create index moderation_cases_review_idx on public.moderation_cases (review_id);

comment on table public.moderation_cases is
  'The admin queue: one open item per review or held place name, gathering every signal about it, and the closed items as the record of who decided what, when and why. Times here are exact and admin-only. Readable by nobody but the definer functions.';

alter table public.moderation_cases enable row level security;
revoke all on public.moderation_cases from anon, authenticated;

create table public.review_reports (
  id          uuid primary key default gen_random_uuid(),
  -- set null, so a reporter's history survives the review.
  review_id   uuid references public.reviews (id) on delete set null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  case_id     uuid references public.moderation_cases (id) on delete set null,
  reason      text not null
              constraint review_reports_reason_valid check (public.moderation_reason_valid(reason)),
  note        text
              constraint review_reports_note_length check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  -- Set when a person decides: upheld (taken down) or dismissed (kept).
  outcome     text
              constraint review_reports_outcome_valid check (outcome in ('upheld', 'dismissed')),
  constraint review_reports_once unique (review_id, reporter_id)
);

create index review_reports_reporter_idx on public.review_reports (reporter_id, created_at desc);
create index review_reports_case_idx on public.review_reports (case_id);

comment on table public.review_reports is
  'Readers'' reports. Who reported is visible to admins only, with how many of their reports were upheld, which is how a group reporting honest reviews shows up. A report never changes a review by itself. Readable by nobody but the definer functions.';

alter table public.review_reports enable row level security;
revoke all on public.review_reports from anon, authenticated;


-- ---------------------------------------------------------------------------
-- Moving a review
-- ---------------------------------------------------------------------------

-- What an author's save leaves a review as. Never towards published: a held
-- review stays held, a rejected one goes back to the queue, and a new hit only
-- holds while enforcing.
create or replace function public.moderation_next_status(
  p_current  text,
  p_new_hold boolean,
  p_enforced boolean
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_current in ('held', 'rejected') then 'held'
    when coalesce(p_new_hold, false) and coalesce(p_enforced, false) then 'held'
    else 'published'
  end;
$$;

comment on function public.moderation_next_status(text, boolean, boolean) is
  'The status an author''s save leaves a review in: held and rejected reviews go (back) to held, a new hold-tier hit holds while enforcing, anything else is published. Only admin functions move a review back to published. Internal.';

-- Opens the item for a review or place name, or adds a signal to the one
-- already open: the queue only ever goes up (look to decide), the priority to
-- the higher, the signals accumulate. p_term_ids null keeps the matched terms
-- as they were.
create or replace function public.moderation_note_case(
  p_kind      text,
  p_review_id uuid,
  p_venue_id  uuid,
  p_author_id uuid,
  p_signal    text,
  p_queue     text,
  p_priority  integer,
  p_term_ids  uuid[]
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_kind = 'review' then
    insert into public.moderation_cases as c
      (kind, review_id, author_id, queue, priority, signals, term_ids)
    values
      ('review', p_review_id, p_author_id, p_queue, p_priority, array[p_signal], coalesce(p_term_ids, '{}'))
    on conflict (review_id) where state = 'open' and kind = 'review' do update
      set queue      = case when c.queue = 'decide' or excluded.queue = 'decide' then 'decide' else 'look' end,
          priority   = greatest(c.priority, excluded.priority),
          signals    = array(select distinct s from unnest(c.signals || excluded.signals) as s order by s),
          term_ids   = case when p_term_ids is null then c.term_ids else excluded.term_ids end,
          author_id  = coalesce(c.author_id, excluded.author_id),
          updated_at = now()
    returning c.id into v_id;
  else
    insert into public.moderation_cases as c
      (kind, venue_id, author_id, queue, priority, signals, term_ids)
    values
      ('venue_name', p_venue_id, p_author_id, p_queue, p_priority, array[p_signal], coalesce(p_term_ids, '{}'))
    on conflict (venue_id) where state = 'open' and kind = 'venue_name' do update
      set queue      = case when c.queue = 'decide' or excluded.queue = 'decide' then 'decide' else 'look' end,
          priority   = greatest(c.priority, excluded.priority),
          signals    = array(select distinct s from unnest(c.signals || excluded.signals) as s order by s),
          term_ids   = case when p_term_ids is null then c.term_ids else excluded.term_ids end,
          author_id  = coalesce(c.author_id, excluded.author_id),
          updated_at = now()
    returning c.id into v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.moderation_note_case(text, uuid, uuid, uuid, text, text, integer, uuid[]) is
  'Opens the queue item for a review or place name, or adds a signal to the open one. Internal.';


-- ---------------------------------------------------------------------------
-- submit_review - screened before it writes
-- ---------------------------------------------------------------------------

create or replace function public.submit_review(
  p_venue_id       uuid,
  p_stars          integer,
  p_trans_bathroom public.answer,
  p_body           text  default null,
  p_answers        jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_body         text := nullif(btrim(coalesce(p_body, '')), '');
  v_review_id    uuid;
  v_current      uuid[];
  v_lineage      uuid[];
  v_item         jsonb;
  v_val          jsonb;
  v_qid          uuid;
  v_q            public.questions%rowtype;
  v_text         text;
  v_num          numeric;
  v_bool         boolean;
  v_ans          public.answer;
  v_ids          uuid[];
  v_lo           numeric;
  v_hi           numeric;
  v_missing      text;
  v_prev_id      uuid;
  v_prev_status  text;
  v_prev_body    text;
  v_cleared      uuid[] := '{}';
  v_texts        text[];
  v_hits         uuid[] := '{}';
  v_failed       boolean := false;
  v_enforced     boolean;
  v_new_hold     uuid[];
  v_new_watch    uuid[];
  v_cleared_hold boolean;
  v_hold         boolean;
  v_status       text;
begin
  -- The two policy predicates, restated because definer bypasses them.
  if v_uid is null then
    raise exception 'Sign in to post a review.' using errcode = '42501';
  end if;
  if public.is_banned(v_uid) then
    raise exception 'This account cannot post reviews.' using errcode = '42501';
  end if;

  -- Friendlier than the CHECK constraints' own messages, which the sheet would
  -- otherwise show verbatim.
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'Pick a rating from 1 to 5.' using errcode = '22023';
  end if;
  if p_trans_bathroom is null then
    raise exception 'Answer the bathroom question.' using errcode = '22023';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'Keep the review under 2000 characters.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.venues v where v.id = p_venue_id) then
    raise exception 'That place is not in the directory.' using errcode = 'P0002';
  end if;
  if p_answers is not null and jsonb_typeof(p_answers) <> 'array' then
    raise exception 'answers must be a list' using errcode = '22023';
  end if;

  -- What the form could have shown: live questions on the venue's live tags.
  -- distinct, because a question shared by two of the tags is listed twice by
  -- venue_questionnaire and must be judged once here. Worked out before the
  -- write now, because the screening below needs it; it never depended on the
  -- review.
  v_current := array(
    select distinct q.id
    from public.venue_tags vt
    join public.tags t          on t.id = vt.tag_id and t.archived_at is null
    join public.question_tags qt on qt.tag_id = t.id
    join public.questions q     on q.id = qt.question_id and q.archived_at is null
    where vt.venue_id = p_venue_id
  );

  -- ...plus everything those questions replaced, however many rewordings back.
  v_lineage := array(
    with recursive lineage as (
      select q.id, q.supersedes_id
      from public.questions q
      where q.id = any(v_current)
      union all
      select q.id, q.supersedes_id
      from public.questions q
      join lineage l on q.id = l.supersedes_id
    )
    select id from lineage
  );

  -- The review as it stands, if there is one, and the terms a person has
  -- already read on it. Locked, so two saves of the same review cannot both
  -- decide from the same starting point.
  select r.id, r.moderation, r.body, coalesce(s.cleared, '{}')
    into v_prev_id, v_prev_status, v_prev_body, v_cleared
  from public.reviews r
  left join public.review_screening s on s.review_id = r.id
  where r.venue_id = p_venue_id
    and r.author_id = v_uid
  for update of r;

  v_cleared := coalesce(v_cleared, '{}');

  -- Everything readers would see once this save is done: the body, the
  -- free-text answers in the payload, and free-text answers to questions this
  -- save leaves alone (they survive it).
  v_texts := array[v_body]
    || array(
         select e ->> 'value'
         from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as e
         where jsonb_typeof(e) = 'object'
           and jsonb_typeof(e -> 'value') = 'string'
           -- Compared as uuids, never as text: the insert below casts the id,
           -- so an id spelt in capitals or without hyphens is saved too, and
           -- must not slip past the list. A malformed one is refused there.
           and case
                 when pg_input_is_valid(e ->> 'question_id', 'uuid') then exists (
                   select 1
                   from public.questions q
                   where q.id = (e ->> 'question_id')::uuid
                     and q.id = any(v_current)
                     and q.kind in ('short_text', 'long_text')
                 )
                 else false
               end
       )
    || array(
         select ra.value_text
         from public.review_answers ra
         join public.questions q on q.id = ra.question_id
         where ra.review_id = v_prev_id
           and not (ra.question_id = any(v_lineage))
           and q.kind in ('short_text', 'long_text')
           and ra.value_text is not null
       );

  -- A broken list must never stop somebody posting. While enforcing, the
  -- review waits for a person instead; either way the queue hears about it.
  begin
    v_hits := public.moderation_screen(v_texts);
  exception when others then
    v_hits := '{}';
    v_failed := true;
  end;

  v_enforced := public.moderation_enforced();

  -- Hits a person has not already read on this review, by tier.
  select coalesce(array_agg(t.id) filter (where t.tier = 'hold'), '{}'),
         coalesce(array_agg(t.id) filter (where t.tier = 'watch'), '{}')
    into v_new_hold, v_new_watch
  from public.moderation_terms t
  where t.id = any(v_hits)
    and not (t.id = any(v_cleared));

  v_cleared_hold := exists (
    select 1 from public.moderation_terms t
    where t.id = any(v_hits) and t.id = any(v_cleared) and t.tier = 'hold'
  );

  v_hold := v_failed or cardinality(v_new_hold) > 0;

  -- The status goes in the same statement as the words.
  insert into public.reviews as r (venue_id, author_id, stars, trans_bathroom, body, moderation)
  values (
    p_venue_id, v_uid, p_stars, p_trans_bathroom, v_body,
    public.moderation_next_status(null, v_hold, v_enforced)
  )
  on conflict (venue_id, author_id) do update
    set stars          = excluded.stars,
        trans_bathroom = excluded.trans_bathroom,
        body           = excluded.body,
        moderation     = public.moderation_next_status(r.moderation, v_hold, v_enforced)
  returning r.id, r.moderation into v_review_id, v_status;

  delete from public.review_answers ra
  where ra.review_id = v_review_id
    and ra.question_id = any(v_lineage);

  for v_item in select e from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as e loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'malformed answer' using errcode = '22023';
    end if;
    begin
      v_qid := (v_item ->> 'question_id')::uuid;
    exception when others then
      raise exception 'malformed answer' using errcode = '22023';
    end;

    v_val := v_item -> 'value';
    -- Not answered. Never an error: leaving an optional question blank is the
    -- form working as intended.
    if v_val is null or jsonb_typeof(v_val) = 'null' then
      continue;
    end if;
    -- Not asked here (any more, or yet): a question added or archived while the
    -- form was open, or one the client made up. Dropped, not refused - design
    -- doc §8.
    if not (v_qid = any(v_current)) then
      continue;
    end if;

    -- The question's own kind decides the column. The client's opinion of what
    -- kind it is answering is never consulted.
    select * into v_q from public.questions q where q.id = v_qid;
    v_text := null; v_num := null; v_bool := null; v_ans := null; v_ids := null;

    case v_q.kind
      when 'yes_no' then
        if jsonb_typeof(v_val) <> 'boolean' then
          raise exception 'Check "%" - answer yes or no.', v_q.prompt using errcode = '22023';
        end if;
        v_bool := (v_val #>> '{}')::boolean;

      when 'yes_no_unsure' then
        if jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') not in ('yes', 'no', 'unsure') then
          raise exception 'Check "%" - answer yes, no or not sure.', v_q.prompt using errcode = '22023';
        end if;
        v_ans := (v_val #>> '{}')::public.answer;

      when 'single_select' then
        if jsonb_typeof(v_val) <> 'string' or not exists (
          select 1 from public.question_options o
          where o.question_id = v_qid and o.id::text = (v_val #>> '{}')
        ) then
          raise exception 'Check "%" - pick one of the listed options.', v_q.prompt using errcode = '22023';
        end if;
        v_ids := array[(v_val #>> '{}')::uuid];

      when 'multi_select' then
        if jsonb_typeof(v_val) <> 'array' then
          raise exception 'Check "%" - pick from the listed options.', v_q.prompt using errcode = '22023';
        end if;
        begin
          v_ids := array(
            select distinct (e #>> '{}')::uuid
            from jsonb_array_elements(v_val) e
            where jsonb_typeof(e) = 'string'
          );
        exception when others then
          raise exception 'Check "%" - pick from the listed options.', v_q.prompt using errcode = '22023';
        end;
        -- Nothing ticked is not an answer.
        if cardinality(v_ids) = 0 then
          continue;
        end if;
        if (select count(*) from public.question_options o
            where o.question_id = v_qid and o.id = any(v_ids)) <> cardinality(v_ids) then
          raise exception 'Check "%" - pick from the listed options.', v_q.prompt using errcode = '22023';
        end if;
        v_lo := (v_q.config ->> 'min_choices')::numeric;
        v_hi := (v_q.config ->> 'max_choices')::numeric;
        if v_lo is not null and cardinality(v_ids) < v_lo then
          raise exception 'Check "%" - pick at least %.', v_q.prompt, v_lo::int using errcode = '22023';
        end if;
        if v_hi is not null and cardinality(v_ids) > v_hi then
          raise exception 'Check "%" - pick at most %.', v_q.prompt, v_hi::int using errcode = '22023';
        end if;

      when 'scale' then
        if jsonb_typeof(v_val) <> 'number' then
          raise exception 'Check "%" - pick a point on the scale.', v_q.prompt using errcode = '22023';
        end if;
        v_num := (v_val #>> '{}')::numeric;
        v_lo := (v_q.config ->> 'min')::numeric;
        v_hi := (v_q.config ->> 'max')::numeric;
        if v_num <> trunc(v_num) or v_num < v_lo or v_num > v_hi then
          raise exception 'Check "%" - pick a point on the scale.', v_q.prompt using errcode = '22023';
        end if;

      when 'rating' then
        v_hi := coalesce((v_q.config ->> 'max')::numeric, 5);
        if jsonb_typeof(v_val) <> 'number' then
          raise exception 'Check "%" - pick 1 to % stars.', v_q.prompt, v_hi::int using errcode = '22023';
        end if;
        v_num := (v_val #>> '{}')::numeric;
        if v_num <> trunc(v_num) or v_num < 1 or v_num > v_hi then
          raise exception 'Check "%" - pick 1 to % stars.', v_q.prompt, v_hi::int using errcode = '22023';
        end if;

      when 'number' then
        if jsonb_typeof(v_val) <> 'number' then
          raise exception 'Check "%" - enter a number.', v_q.prompt using errcode = '22023';
        end if;
        v_num := (v_val #>> '{}')::numeric;
        v_lo := (v_q.config ->> 'min')::numeric;
        v_hi := (v_q.config ->> 'max')::numeric;
        if (v_lo is not null and v_num < v_lo) or (v_hi is not null and v_num > v_hi) then
          raise exception 'Check "%" - enter a number between % and %.',
            v_q.prompt, coalesce(v_lo::text, 'anything'), coalesce(v_hi::text, 'anything')
            using errcode = '22023';
        end if;

      when 'currency', 'duration' then
        if jsonb_typeof(v_val) <> 'number' then
          raise exception 'Check "%" - enter an amount.', v_q.prompt using errcode = '22023';
        end if;
        v_num := (v_val #>> '{}')::numeric;
        if v_num < 0 then
          raise exception 'Check "%" - the amount cannot be negative.', v_q.prompt using errcode = '22023';
        end if;

      when 'time_of_day' then
        if jsonb_typeof(v_val) <> 'string'
           or (v_val #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
          raise exception 'Check "%" - use 24-hour time, like 23:00.', v_q.prompt using errcode = '22023';
        end if;
        v_text := v_val #>> '{}';

      when 'time_range' then
        -- Start after end is allowed: 22:00-06:00 is an overnight window, and
        -- for a shelter that is the common case rather than a typo.
        if jsonb_typeof(v_val) <> 'string'
           or (v_val #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$' then
          raise exception 'Check "%" - use two 24-hour times, like 09:00-17:00.', v_q.prompt using errcode = '22023';
        end if;
        v_text := v_val #>> '{}';

      when 'date' then
        if jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
          raise exception 'Check "%" - use a date like 2026-09-12.', v_q.prompt using errcode = '22023';
        end if;
        -- The regex passes 2026-02-30; the cast does not.
        begin
          perform (v_val #>> '{}')::date;
        exception when others then
          raise exception 'Check "%" - that is not a real date.', v_q.prompt using errcode = '22023';
        end;
        v_text := v_val #>> '{}';

      when 'short_text', 'long_text' then
        if jsonb_typeof(v_val) <> 'string' then
          raise exception 'Check "%" - write something or leave it blank.', v_q.prompt using errcode = '22023';
        end if;
        v_text := nullif(btrim(v_val #>> '{}'), '');
        -- Whitespace is not an answer.
        if v_text is null then
          continue;
        end if;
        v_hi := coalesce(
          (v_q.config ->> 'max_length')::numeric,
          case v_q.kind when 'short_text' then 200 else 2000 end
        );
        if char_length(v_text) > v_hi then
          raise exception 'Check "%" - keep it under % characters.', v_q.prompt, v_hi::int using errcode = '22023';
        end if;
    end case;

    -- The same question twice in one payload: the first occurrence wins.
    insert into public.review_answers
      (review_id, question_id, value_text, value_number, value_bool, value_answer, value_option_ids)
    values
      (v_review_id, v_qid, v_text, v_num, v_bool, v_ans, v_ids)
    on conflict (review_id, question_id) do nothing;
  end loop;

  -- Required is judged against what is asked NOW, on the final state - so an
  -- author editing a review from before the question existed is asked it, and
  -- nobody who never comes back is.
  select q.prompt into v_missing
  from public.questions q
  where q.id = any(v_current)
    and q.required
    and not exists (
      select 1 from public.review_answers ra
      where ra.review_id = v_review_id and ra.question_id = q.id
    )
  order by lower(q.prompt)
  limit 1;

  if v_missing is not null then
    raise exception 'Answer "%" to post.', v_missing using errcode = '23514';
  end if;

  -- Bookkeeping, kept off reviews so none of it is a realtime event. A scan
  -- that failed found nothing, which is not the same as nothing being there:
  -- the last good hits stay, or a let-stand word would lose its mask.
  insert into public.review_screening as s (review_id, hits, scanned_at)
  values (v_review_id, v_hits, now())
  on conflict (review_id) do update
    set hits       = case when v_failed then s.hits else excluded.hits end,
        scanned_at = case when v_failed then s.scanned_at else excluded.scanned_at end;

  if v_status = 'held' then
    perform public.moderation_note_case('review', v_review_id, null, v_uid,
      case
        when v_prev_status = 'rejected' then 'resubmitted'
        when v_failed then 'screen_failed'
        else 'held'
      end,
      'decide', 100, v_hits);
  elsif v_failed then
    perform public.moderation_note_case('review', v_review_id, null, v_uid, 'screen_failed', 'look', 10, v_hits);
  elsif cardinality(v_new_hold) > 0 then
    -- Shadow mode: what enforcing would have held.
    perform public.moderation_note_case('review', v_review_id, null, v_uid, 'shadow_hold', 'look', 10, v_hits);
  elsif cardinality(v_new_watch) > 0 then
    perform public.moderation_note_case('review', v_review_id, null, v_uid, 'watch', 'look', 20, v_hits);
  elsif v_prev_status = 'published' and v_cleared_hold and v_body is distinct from v_prev_body then
    -- A word a person let stand, in words that have since changed around it.
    perform public.moderation_note_case('review', v_review_id, null, v_uid, 'edited_after_clear', 'look', 10, v_hits);
  elsif v_prev_id is not null and v_body is distinct from v_prev_body then
    -- Nothing new to flag, but an item already open (a report) should show
    -- the words as they are now.
    update public.moderation_cases c
    set term_ids   = v_hits,
        signals    = array(select distinct s from unnest(c.signals || array['edited']) as s order by s),
        updated_at = now()
    where c.review_id = v_review_id
      and c.kind = 'review'
      and c.state = 'open';
  end if;

  return v_review_id;
end;
$$;

comment on function public.submit_review(uuid, integer, public.answer, text, jsonb) is
  'A review and its tag-question answers, in one transaction. Screens the body and every free-text answer against the word list before writing, and writes the moderation status in the same statement as the words. The only writer of review_answers, and the only way an author writes a review. Security definer because neither table has an insert grant; it restates the sign-in and ban checks itself.';


-- ---------------------------------------------------------------------------
-- A deleted review closes its item
-- ---------------------------------------------------------------------------

create or replace function public.reviews_close_cases()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_decision text;
begin
  -- An admin deleting somebody else's review is a decision; anything else -
  -- the author, or their account going - is the author's.
  v_decision := case
    when v_uid is not null and v_uid is distinct from old.author_id and public.is_admin()
      then 'deleted_by_admin'
    else 'deleted_by_author'
  end;

  update public.moderation_cases c
  set state      = 'closed',
      decision   = v_decision,
      decided_by = v_uid,
      decided_at = now(),
      updated_at = now()
  where c.review_id = old.id
    and c.kind = 'review'
    and c.state = 'open';

  if v_decision = 'deleted_by_admin' then
    update public.review_reports rr
    set outcome = 'upheld'
    where rr.review_id = old.id
      and rr.outcome is null;
  end if;

  return old;
end;
$$;

comment on function public.reviews_close_cases() is
  'BEFORE DELETE on reviews: closes the review''s open queue item as deleted by its author or by an admin, whichever route the delete took. The item keeps who wrote the review and which terms it matched, and never held the words.';

create trigger reviews_close_cases
  before delete on public.reviews
  for each row execute function public.reviews_close_cases();


-- ---------------------------------------------------------------------------
-- What readers see
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced: three new columns change the return type.
drop function if exists public.venue_reviews(uuid);

create function public.venue_reviews(p_venue_id uuid)
returns table (
  id             uuid,
  stars          smallint,
  -- Masked where it quotes a hold-tier word a person has let stand.
  body           text,
  author_name    text,
  is_mine        boolean,
  -- recent | weeks | months | half_year | year. Always set.
  posted_period  text,
  -- The UTC day it was posted, when its author shows dates. Null otherwise.
  posted_on      date,
  -- published | held | rejected, on the caller's own review only.
  status         text,
  -- The words as written, when body has something masked. Null otherwise.
  unmasked_body  text,
  reported_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.stars,
    case when mine.yes then r.body else masked.body end,
    coalesce(r.alias, p.display_name),
    mine.yes,
    public.posting_period(r.created_at),
    case when not r.hide_date then (r.created_at at time zone 'UTC')::date end,
    case when mine.yes then r.moderation end,
    case when not mine.yes and masked.body is distinct from r.body then r.body end,
    (select auth.uid()) is not null and exists (
      select 1 from public.review_reports rr
      where rr.review_id = r.id and rr.reporter_id = (select auth.uid())
    )
  from public.reviews r
  left join public.profiles p on p.id = r.author_id
  left join public.review_screening s on s.review_id = r.id
  -- auth.uid() is null for a signed-out caller, and false is the honest
  -- answer to "is this yours" there.
  cross join lateral (select coalesce(r.author_id = (select auth.uid()), false) as yes) as mine
  cross join lateral (select public.moderation_mask(r.body, s.hits) as body) as masked
  where r.venue_id = p_venue_id
    -- Everyone's published reviews, and the caller's own whatever its status.
    and (r.moderation = 'published' or mine.yes)
  -- The week, then the id, which is random: within a week the order says
  -- nothing about who posted first. See 20261009180000.
  order by public.posting_week(r.created_at) desc, r.id;
$$;

comment on function public.venue_reviews(uuid) is
  'The published reviews of one venue, plus the caller''s own whatever its status (with status set on that row only), newest week first and in no meaningful order within a week. Hold-tier words a person has let stand come masked in body, with the original in unmasked_body. Never an exact time.';

-- Published reviews only, quotes masked, with the original alongside. Same
-- signature and return type, so a replace.
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
    select ra.*, r.author_id, r.alias, s.hits
    from public.review_answers ra
    join public.reviews r on r.id = ra.review_id
    left join public.review_screening s on s.review_id = r.id
    where r.venue_id = p_venue_id
      and r.moderation = 'published'
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

      -- Free text is shown, not counted: the latest few, with the name their
      -- review is shown under. "Latest" by week, then by review id, which is
      -- random - the same order venue_reviews uses, for the same reason. A
      -- hold-tier word a person let stand is masked in text, with the original
      -- in unmasked.
      when q.kind in ('short_text', 'long_text') then jsonb_build_object(
        'recent', coalesce((
          select jsonb_agg(jsonb_build_object(
            'text', x.masked,
            'unmasked', case when x.masked is distinct from x.value_text then x.value_text end,
            'display_name', coalesce(x.alias, p.display_name))
            order by x.week desc, x.review_id)
          from (
            select a.value_text, a.author_id, a.alias, a.review_id,
                   public.moderation_mask(a.value_text, a.hits) as masked,
                   public.posting_week(a.answered_at) as week
            from answered a where a.question_id = q.id
            order by public.posting_week(a.answered_at) desc, a.review_id
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
  'Aggregated tag-question answers from one venue''s published reviews, one row per answered question. Every count is out of the people who answered that question, never the review count. Free-text quotes carry the name their review is shown under (in the display_name key), come masked where they quote a hold-tier word (original in unmasked), are chosen by posting week rather than exact time, and carry no time. Security definer only so that a superseded question''s wording can still be read; exposes nothing beyond questions answered in published reviews at this venue.';

-- The map marker's quote: published reviews only, and always masked - a marker
-- is a picture on Android, with nothing to tap.
create or replace function public.venue_latest_review_body(p_venue_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.moderation_mask(r.body, s.hits)
  from public.reviews r
  left join public.review_screening s on s.review_id = r.id
  where r.venue_id = p_venue_id
    and r.moderation = 'published'
  order by public.posting_week(r.created_at) desc, r.id
  limit 1;
$$;

comment on function public.venue_latest_review_body(uuid) is
  'The body of one published review from the venue''s most recent posting week (null if that review has no words, or the venue no published reviews), masked where it quotes a hold-tier word. For the map marker''s quote. Chosen within the week by review id, so it does not single out the newest review.';

-- Dropped rather than replaced: three new columns change the return type.
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
  hide_date             boolean,
  posted_period         text,
  posted_on             date,
  venue_name            text,
  venue_lat             double precision,
  venue_lng             double precision,
  venue_google_place_id text,
  -- published | held | rejected
  moderation            text,
  -- Why a person rejected it, and what they wrote to the author. Null unless
  -- the review is rejected.
  moderation_reason     text,
  moderation_note       text
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
    r.hide_date,
    public.posting_period(r.created_at),
    case when not r.hide_date then (r.created_at at time zone 'UTC')::date end,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id,
    r.moderation,
    case when r.moderation = 'rejected' then d.reason end,
    case when r.moderation = 'rejected' then d.note end
  from public.reviews r
  join public.venues v on v.id = r.venue_id
  left join lateral (
    select c.reason, c.note
    from public.moderation_cases c
    where c.review_id = r.id
      and c.kind = 'review'
      and c.decision = 'rejected'
    order by c.decided_at desc
    limit 1
  ) d on true
  where r.author_id = (select auth.uid())
  order by r.updated_at desc, r.id desc;
$$;

comment on function public.my_reviews() is
  'The caller''s own reviews with the venue each is about, the alias each is shown under (null: their display name), the date readers see - the posting period, plus the UTC day when the date is not hidden - and its moderation status, with the reason and note when a person rejected it. Most recently saved first. Empty for a caller with no reviews; not callable signed out.';

-- The panel's "on the map" has to agree with what the map shows.
create or replace function public.venue_is_on_map(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.venues v
    where v.id = p_venue_id
      and v.lat is not null
      and v.lng is not null
      and (
        exists (select 1 from public.reviews r where r.venue_id = v.id and r.moderation = 'published')
        or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
      )
  );
$$;

comment on function public.venue_is_on_map(uuid) is
  'Whether a venue passes the same test venues_near applies: it has coordinates, and it either has a published review or is tagged. Kept in one place so the admin panel and the map cannot disagree.';

-- Same signature and return type. Only on_map changes: inside a definer
-- function venue_ratings counts every review, held ones included, so the
-- published count is asked for directly. review_count stays every review -
-- the panel wants to know what a delete would destroy.
create or replace function public.admin_list_venues(
  p_search     text default null,
  p_tag_id     uuid default null,
  -- 'any' | 'tagged' | 'untagged'
  p_tag_state  text default 'any',
  -- 'any' | 'with' | 'without'
  p_notes      text default 'any',
  p_reviews    text default 'any',
  -- 'any' | 'on' | 'off'
  p_visibility text default 'any',
  -- 'name' | 'created_at' | 'review_count' | 'note_count'
  p_sort       text default 'created_at',
  p_desc       boolean default true,
  p_limit      integer default 25,
  p_offset     integer default 0
)
returns table (
  id              uuid,
  name            text,
  address         text,
  lat             double precision,
  lng             double precision,
  google_place_id text,
  created_at      timestamptz,
  review_count    bigint,
  avg_stars       numeric,
  note_count      bigint,
  tags            jsonb,
  on_map          boolean,
  total_count     bigint
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
  with counted as (
    select
      v.id,
      v.name,
      v.address,
      v.lat,
      v.lng,
      v.google_place_id,
      v.created_at,
      vr.review_count,
      vr.avg_stars,
      (select count(*) from public.venue_notes n where n.venue_id = v.id) as note_count,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'slug', t.slug, 'label', t.label,
                 'color', t.color, 'text_color', t.text_color)
               order by t.sort_order, t.label)
        from public.venue_tags vt
        join public.tags t on t.id = vt.tag_id
        where vt.venue_id = v.id
      ), '[]'::jsonb) as tags,
      -- Inlined rather than calling venue_is_on_map per row: same predicate,
      -- one pass. The function stays the readable definition of the rule.
      (
        v.lat is not null and v.lng is not null
        and (
          exists (select 1 from public.reviews r where r.venue_id = v.id and r.moderation = 'published')
          or exists (select 1 from public.venue_tags vt2 where vt2.venue_id = v.id)
        )
      ) as on_map
    from public.venues v
    join public.venue_ratings vr on vr.venue_id = v.id
  ),
  filtered as (
    select c.*
    from counted c
    where (
        p_search is null or p_search = ''
        or c.name ilike '%' || p_search || '%'
        or c.address ilike '%' || p_search || '%'
      )
      and (p_tag_id is null or exists (
        select 1 from public.venue_tags vt
        where vt.venue_id = c.id and vt.tag_id = p_tag_id
      ))
      and (
        p_tag_state is null or p_tag_state = 'any'
        or (p_tag_state = 'tagged'   and jsonb_array_length(c.tags) > 0)
        or (p_tag_state = 'untagged' and jsonb_array_length(c.tags) = 0)
      )
      and (
        p_notes is null or p_notes = 'any'
        or (p_notes = 'with'    and c.note_count > 0)
        or (p_notes = 'without' and c.note_count = 0)
      )
      and (
        p_reviews is null or p_reviews = 'any'
        or (p_reviews = 'with'    and c.review_count > 0)
        or (p_reviews = 'without' and c.review_count = 0)
      )
      and (
        p_visibility is null or p_visibility = 'any'
        or (p_visibility = 'on'  and c.on_map)
        or (p_visibility = 'off' and not c.on_map)
      )
  )
  select
    f.id, f.name, f.address, f.lat, f.lng, f.google_place_id, f.created_at,
    f.review_count, f.avg_stars, f.note_count, f.tags, f.on_map,
    count(*) over () as total_count
  from filtered f
  -- Matched, never interpolated: a sort column arriving from the client is a
  -- string, and a string spliced into SQL is an injection.
  order by
    case when p_sort = 'name'         and not p_desc then lower(f.name) end asc,
    case when p_sort = 'name'         and p_desc     then lower(f.name) end desc,
    case when p_sort = 'created_at'   and not p_desc then f.created_at end asc,
    case when p_sort = 'created_at'   and p_desc     then f.created_at end desc,
    case when p_sort = 'review_count' and not p_desc then f.review_count end asc,
    case when p_sort = 'review_count' and p_desc     then f.review_count end desc,
    case when p_sort = 'note_count'   and not p_desc then f.note_count end asc,
    case when p_sort = 'note_count'   and p_desc     then f.note_count end desc,
    f.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;


-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------

create or replace function public.report_review(
  p_review_id uuid,
  p_reason    text,
  p_note      text default null
)
returns boolean
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
  v_kept     boolean;
  v_signal   text;
  v_queue    text;
  v_priority integer;
  v_case     uuid;
  v_inserted integer;
begin
  if v_uid is null then
    raise exception 'Sign in to report a review.' using errcode = '42501';
  end if;
  if public.is_banned(v_uid) then
    raise exception 'This account cannot send reports.' using errcode = '42501';
  end if;
  if p_reason is null or not public.moderation_reason_valid(p_reason) then
    raise exception 'Pick a reason.' using errcode = '22023';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;

  select r.author_id, r.moderation, r.updated_at
    into v_author, v_status, v_updated
  from public.reviews r
  where r.id = p_review_id;

  if not found or v_status <> 'published' then
    raise exception 'That review is not up any more.' using errcode = 'P0002';
  end if;
  if v_author = v_uid then
    raise exception 'This is your own review. Edit or delete it instead.' using errcode = '22023';
  end if;

  -- Once per account per review. Not an error: the button may simply have
  -- been pressed twice.
  if exists (
    select 1 from public.review_reports rr
    where rr.review_id = p_review_id and rr.reporter_id = v_uid
  ) then
    return false;
  end if;

  if (
    select count(*) from public.review_reports rr
    where rr.reporter_id = v_uid
      and rr.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'You have sent a lot of reports today. Thank you - try again tomorrow.'
      using errcode = 'P0001';
  end if;

  -- A person has already read these exact words and kept them up. More reports
  -- go to the low-priority list, so a group cannot keep pushing a review a
  -- person has kept back into "Needs a decision". Private details are the
  -- exception: an address or a phone number is always worth a second look.
  v_kept := exists (
    select 1 from public.moderation_cases c
    where c.review_id = p_review_id
      and c.kind = 'review'
      and c.state = 'closed'
      and c.decision in ('kept', 'published')
      -- >=, because now() is the transaction's start: a decision is never in
      -- the same transaction as an edit, but the dry run is one transaction.
      and c.decided_at >= v_updated
  );

  if v_kept and p_reason <> 'private_info' then
    v_signal := 'report_after_keep';
    v_queue := 'look';
    v_priority := 5;
  else
    v_signal := 'report';
    v_queue := 'decide';
    v_priority := case p_reason
      when 'private_info' then 90
      when 'hate'         then 70
      when 'harassment'   then 70
      else 40
    end;
  end if;

  v_case := public.moderation_note_case('review', p_review_id, null, v_author,
                                        v_signal, v_queue, v_priority, null);

  insert into public.review_reports (review_id, reporter_id, case_id, reason, note)
  values (p_review_id, v_uid, v_case, p_reason, v_note)
  on conflict (review_id, reporter_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.moderation_cases c
    set report_count = c.report_count + 1,
        updated_at   = now()
    where c.id = v_case;
  end if;

  return v_inserted > 0;
end;
$$;

comment on function public.report_review(uuid, text, text) is
  'A reader''s report of a published review, with a reason and an optional note. Puts the review in front of a person; never hides it. Once per account per review (false when already reported), ten a day, not on your own review. Reporters are visible to admins only.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Internal.
revoke execute on function public.moderation_reason_valid(text)                    from public, anon, authenticated;
revoke execute on function public.moderation_next_status(text, boolean, boolean)   from public, anon, authenticated;
revoke execute on function public.moderation_note_case(
  text, uuid, uuid, uuid, text, text, integer, uuid[]
) from public, anon, authenticated;
revoke execute on function public.reviews_close_cases()                            from public, anon, authenticated;

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon. The
-- drops above took the old grants with them, so every dropped function is
-- granted again as well as revoked again.
revoke execute on function public.review_is_readable(uuid)                         from public;
revoke execute on function public.venue_reviews(uuid)                              from public;
revoke execute on function public.my_reviews()                                     from public, anon;
revoke execute on function public.report_review(uuid, text, text)                  from public, anon;

-- The answers policy calls it, and a policy has to be evaluable by everyone
-- it applies to.
grant execute on function public.review_is_readable(uuid)                          to anon, authenticated;
grant execute on function public.venue_reviews(uuid)                               to anon, authenticated;
grant execute on function public.my_reviews()                                      to authenticated;
grant execute on function public.report_review(uuid, text, text)                   to authenticated;
