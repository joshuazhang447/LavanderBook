-- Reviewers answer tag questions; the venue sheet shows what they said.
--
-- Three functions. The first is the only writer review_answers will ever have.
--
--   submit_review           the review and its answers, in one transaction
--   my_new_question_count   how many questions this venue has asked since the
--                           caller last saved their review here
--   venue_answer_summary    every answered question at a venue, aggregated
--
-- SECURITY DEFINER, where the design doc (§8) said invoker. The doc was wrong
-- in a way that could not have worked: authenticated has no insert grant on
-- review_answers, and must not get one, because a direct PostgREST insert would
-- skip every check below - kind matching column, option ids belonging to the
-- question, config bounds, required. The table stays RPC-only. The price is
-- that this function restates, itself, the two things the reviews policies
-- check: that there is a caller, and that they are not banned.
--
-- WHAT A SAVE REWRITES. Not everything. The answers deleted and re-inserted
-- are those to the questions the form could have shown - the venue's current
-- questionnaire - plus whatever those questions superseded. Absence from the
-- payload means "cleared" for those and nothing else: an answer to a question
-- on a tag the venue has since lost is not the author's to lose by editing
-- their star rating. The lineage is included so that answering the successor
-- of a reworded question retires the author's answer to the old wording; one
-- person, one count.
--
-- THE OLD-REVIEWS QUESTION (design doc §11, decision 4). Nothing records what a
-- review was offered when it was written, so "this review answered 3 of 7" is
-- a number nobody can honestly compute. The rules that follow from that:
--
--   * a review written before a question existed is never "incomplete";
--   * every tally on the venue sheet is out of the people who answered THAT
--     question, never out of the review count;
--   * required binds only at write time, against what is asked now - so an
--     author editing an old review is asked the new questions, and nobody else
--     is bothered;
--   * "new to you" means added after you last saved: my_new_question_count
--     compares question_tags.assigned_at and venue_tags.added_at against
--     reviews.updated_at, so skipping an optional question is never nagged.


-- ---------------------------------------------------------------------------
-- submit_review
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
  v_uid       uuid := (select auth.uid());
  v_body      text := nullif(btrim(coalesce(p_body, '')), '');
  v_review_id uuid;
  v_current   uuid[];
  v_lineage   uuid[];
  v_item      jsonb;
  v_val       jsonb;
  v_qid       uuid;
  v_q         public.questions%rowtype;
  v_text      text;
  v_num       numeric;
  v_bool      boolean;
  v_ans       public.answer;
  v_ids       uuid[];
  v_lo        numeric;
  v_hi        numeric;
  v_missing   text;
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

  insert into public.reviews (venue_id, author_id, stars, trans_bathroom, body)
  values (p_venue_id, v_uid, p_stars, p_trans_bathroom, v_body)
  on conflict (venue_id, author_id) do update
    set stars          = excluded.stars,
        trans_bathroom = excluded.trans_bathroom,
        body           = excluded.body
  returning id into v_review_id;

  -- What the form could have shown: live questions on the venue's live tags.
  -- distinct, because a question shared by two of the tags is listed twice by
  -- venue_questionnaire and must be judged once here.
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

  return v_review_id;
end;
$$;

comment on function public.submit_review(uuid, integer, public.answer, text, jsonb) is
  'A review and its tag-question answers, in one transaction. The only writer of review_answers. Security definer because that table has no insert grant on purpose; it restates the two reviews-policy checks itself. Rewrites answers only to the venue''s current questionnaire and its supersedes lineage.';

revoke execute on function public.submit_review(uuid, integer, public.answer, text, jsonb) from public;
grant  execute on function public.submit_review(uuid, integer, public.answer, text, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- my_new_question_count
-- ---------------------------------------------------------------------------

create or replace function public.my_new_question_count(p_venue_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(distinct q.id)::integer
  from public.reviews r
  join public.venue_tags vt    on vt.venue_id = r.venue_id
  join public.tags t           on t.id = vt.tag_id and t.archived_at is null
  join public.question_tags qt on qt.tag_id = t.id
  join public.questions q      on q.id = qt.question_id and q.archived_at is null
  where r.venue_id = p_venue_id
    and r.author_id = (select auth.uid())
    -- Offered after the review was last saved, whichever way it arrived: the
    -- question joined the tag, or the tag joined the venue.
    and greatest(qt.assigned_at, vt.added_at) > r.updated_at
    and not exists (
      select 1 from public.review_answers ra
      where ra.review_id = r.id and ra.question_id = q.id
    );
$$;

comment on function public.my_new_question_count(uuid) is
  'How many of a venue''s questions the caller has never been shown: added to the venue after their review was last saved, and unanswered. Saving clears it whether or not they answer - skipping an optional question is not something to nag about.';

revoke execute on function public.my_new_question_count(uuid) from public;
grant  execute on function public.my_new_question_count(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- venue_answer_summary
-- ---------------------------------------------------------------------------

-- Definer, narrowly: the questions policy hides archived rows from everyone
-- but admins, and a superseded question is archived - yet its answers must be
-- shown under the wording they were given (design doc §5.4), not silently
-- re-attributed to the new one. This reads that wording. It exposes only
-- questions with at least one answer at the venue asked about, which is
-- nothing a reader of the public review_answers rows could not already infer.
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
    select ra.*, r.author_id
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

      -- Free text is shown, not counted. The latest few, with the handle they
      -- were posted under, exactly as a review body is.
      when q.kind in ('short_text', 'long_text') then jsonb_build_object(
        'recent', coalesce((
          select jsonb_agg(jsonb_build_object(
            'text', x.value_text,
            'display_name', p.display_name,
            'answered_at', x.answered_at)
            order by x.answered_at desc)
          from (
            select a.value_text, a.answered_at, a.author_id
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
  'Aggregated tag-question answers for one venue, one row per answered question. Every count is out of the people who answered that question, never the review count. Security definer only so that a superseded question''s wording can still be read; exposes nothing beyond questions answered at this venue.';

revoke execute on function public.venue_answer_summary(uuid) from public;
grant  execute on function public.venue_answer_summary(uuid) to anon, authenticated;
