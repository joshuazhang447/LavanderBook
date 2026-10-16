-- Dry run of the moderation migrations (20261016100000 to 20261016100400).
--
-- LOCAL ONLY. Run it against a local Supabase database after a reset, never
-- against the hosted project. Everything happens inside one transaction that
-- is rolled back at the end, so it leaves nothing behind:
--
--   npx supabase start
--   npx supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/scripts/moderation_dry_run.sql
--
-- It stops at the first failed check and names it.
--
-- The words are placeholders made up for this file - glorp, snarfle, plokk,
-- vexbit, wibblet, quimbo - and one harmless Chinese word (cake) for the
-- anywhere mode. No real term belongs here, or anywhere else in git.
--
-- Not in supabase/tests: `supabase test db` would run that folder as pgTAP.

\set ON_ERROR_STOP on
begin;

\echo '== Collation'
do $$
begin
  assert exists (select 1 from pg_catalog.pg_collation where collname = 'pg_c_utf8'),
    'the pg_c_utf8 collation is missing';
end
$$;


\echo '== Fixtures'
create schema dryrun;
grant usage on schema dryrun to anon, authenticated;

-- Runs a statement and checks it failed with the given SQLSTATE.
create function dryrun.expect_error(p_sql text, p_state text)
returns void
language plpgsql
as $$
declare
  v_state text;
  v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state <> p_state then
      raise exception 'expected % from [%], got %: %', p_state, p_sql, v_state, v_message;
    end if;
    return;
  end;
  raise exception 'expected % from [%], but it succeeded', p_state, p_sql;
end;
$$;
grant execute on function dryrun.expect_error(text, text) to anon, authenticated;

-- The terms a text matches, by name.
create function dryrun.hits(p_text text)
returns text[]
language sql
as $$
  select coalesce(array_agg(t.term order by t.term), '{}')
  from public.moderation_terms t
  where t.id = any(public.moderation_screen(array[p_text]));
$$;

-- The text as readers would see it once enforcing.
create function dryrun.mask(p_text text)
returns text
language sql
as $$
  select public.moderation_apply_mask(p_text, public.moderation_screen(array[p_text]));
$$;

-- Records every row image written to reviews, as realtime would see it.
create function dryrun.log_review()
returns trigger
language plpgsql
as $$
begin
  perform set_config('dryrun.log',
    coalesce(current_setting('dryrun.log', true), '') || tg_op || ':' || new.moderation || ';', true);
  return null;
end;
$$;

create trigger zz_dryrun_log
  after insert or update on public.reviews
  for each row execute function dryrun.log_review();

-- a1 admin, a2 and a3 authors, a4 and a5 readers.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'a1@dryrun.test', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'a2@dryrun.test', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'a3@dryrun.test', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'a4@dryrun.test', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a5', 'authenticated', 'authenticated', 'a5@dryrun.test', '{}', '{}', now(), now());

insert into public.admins (user_id, note) values ('00000000-0000-4000-8000-0000000000a1', 'dry run');

insert into public.venues (id, name, lat, lng)
values ('00000000-0000-4000-8000-0000000000b1', 'Dry Run Cafe', 51.5, -0.12);

-- A tag on the venue, and a free-text question on the tag, so answers are
-- screened too.
insert into public.venue_tags (venue_id, tag_id)
select '00000000-0000-4000-8000-0000000000b1', t.id
from public.tags t
where t.archived_at is null
order by t.sort_order, t.id
limit 1;

insert into public.questions (id, prompt, kind)
values ('00000000-0000-4000-8000-0000000000c1', 'Anything else to add?', 'long_text');

insert into public.question_tags (question_id, tag_id, sort_order)
select '00000000-0000-4000-8000-0000000000c1', vt.tag_id, 99
from public.venue_tags vt
where vt.venue_id = '00000000-0000-4000-8000-0000000000b1';


\echo '== The list, through the panel'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select public.admin_create_term('glorp', 'hold', 'transphobic', 'word', 'en', array['glorp lane'], 'placeholder');
select public.admin_create_term('snarfle', 'hold', 'homophobic', 'prefix', 'en', null, null);
select public.admin_create_term('plokk', 'hold', 'racist', 'word', 'en', null, null);
select public.admin_create_term('vexbit', 'watch', 'misogynist', 'word', 'en', null, null);
select public.admin_create_term(U&'\86CB\7CD5', 'hold', 'ableist', 'anywhere', 'zh', null, null);

select dryrun.expect_error($q$select public.admin_create_term('GLORP', 'hold', 'racist', 'word', null, null, null)$q$, '23505');
select dryrun.expect_error($q$select public.admin_create_term('ab', 'hold', 'racist', 'anywhere', null, null, null)$q$, 'P0001');
select dryrun.expect_error($q$select public.admin_create_term('blorf', 'maybe', 'racist', 'word', null, null, null)$q$, 'P0001');

do $$
declare
  v_actions text[];
begin
  select array_agg(i.action order by i.line) into v_actions
  from public.admin_import_terms(
    '[{"line":1,"term":"wibblet","tier":"watch","category":"ableist"},
      {"line":2,"term":"glorp","tier":"hold","category":"transphobic"},
      {"line":3,"term":"Wibblet","tier":"watch","category":"ableist"},
      {"line":4,"term":"","tier":"hold","category":"racist"}]'::jsonb, false) as i;
  assert v_actions = array['add', 'same', 'duplicate', 'invalid'], format('import preview: %s', v_actions);
  assert not exists (select 1 from public.admin_list_terms() t where t.term = 'wibblet'), 'a preview wrote to the list';

  perform public.admin_import_terms('[{"line":1,"term":"wibblet","tier":"watch","category":"ableist"}]'::jsonb, true);
  assert exists (select 1 from public.admin_list_terms() t where t.term = 'wibblet'), 'an import did not write';

  assert (public.admin_moderation_try('a glorp here') ->> 'held')::boolean, 'try: a hold word';
  assert not (public.admin_moderation_try('a vexbit here') ->> 'held')::boolean, 'try: a watch word';
end
$$;

reset role;
select set_config('request.jwt.claims', '', true);


\echo '== Matching'
do $$
begin
  assert dryrun.hits('a glorp here') = array['glorp'], 'plain';
  assert dryrun.hits('GLORP!') = array['glorp'], 'capitals and punctuation';
  assert dryrun.hits('gl0rp') = array['glorp'], 'a digit for a letter';
  assert dryrun.hits('g|orp') = array['glorp'], 'a symbol for a letter';
  assert dryrun.hits('glooooorp') = array['glorp'], 'stretched';
  assert dryrun.hits('g l o r p') = array['glorp'], 'spaced out';
  assert dryrun.hits('g.l.o.r.p') = array['glorp'], 'dotted';
  assert dryrun.hits('gl' || chr(8203) || 'orp') = array['glorp'], 'a zero-width space inside';
  assert dryrun.hits('gl' || chr(1086) || 'rp') = array['glorp'], 'a Cyrillic letter';
  assert dryrun.hits(U&'\FF47\FF4C\FF4F\FF52\FF50') = array['glorp'], 'fullwidth letters';
  assert dryrun.hits(U&'gl\00F3rp') = array['glorp'], 'an accent';
  assert dryrun.hits('snarfles everywhere') = array['snarfle'], 'prefix mode';
  assert dryrun.hits('plokkk') = array['plokk'], 'a doubled letter, stretched';
  assert dryrun.hits('plok') = '{}', 'the single-letter twin of a doubled letter';
  assert dryrun.hits('englorpment') = '{}', 'inside another word';
  assert dryrun.hits('glor p') = '{}', 'spaced only once';
  assert dryrun.hits('Glorp Lane') = '{}', 'the allowlist';
  assert dryrun.hits('Glorp Lane, and a glorp') = array['glorp'], 'the allowlist next to a real hit';
  assert dryrun.hits('a vexbit') = array['vexbit'], 'a watch word';
  assert dryrun.hits(U&'\6211\559C\6B22\86CB\7CD5\5E97') = array[U&'\86CB\7CD5'], 'anywhere mode inside a token';
end
$$;


\echo '== Masking'
do $$
declare
  b text := U&'\2022';
begin
  assert dryrun.mask('They called me a glorp, twice.') = 'They called me a g' || repeat(b, 4) || ', twice.',
    dryrun.mask('They called me a glorp, twice.');
  assert dryrun.mask('g l o r p!') = 'g ' || b || ' ' || b || ' ' || b || ' ' || b || '!',
    dryrun.mask('g l o r p!');
  assert dryrun.mask('a gl' || chr(8203) || 'orp') = 'a g' || repeat(b, 5),
    dryrun.mask('a gl' || chr(8203) || 'orp');
  assert dryrun.mask(U&'\+01F642 glorp \+01F642') = U&'\+01F642 g' || repeat(b, 4) || U&' \+01F642',
    'emoji around a mask';
  assert dryrun.mask(U&'\0645\0631\062D\0628\0627 glorp') = U&'\0645\0631\062D\0628\0627 g' || repeat(b, 4),
    'right-to-left text around a mask';
  assert dryrun.mask(U&'\6211\559C\6B22\86CB\7CD5\5E97') = U&'\6211\559C\6B22\86CB' || b || U&'\5E97',
    'anywhere mode masks only the match';
  assert dryrun.mask('a vexbit') = 'a vexbit', 'watch words are never masked';
  assert dryrun.mask('Nothing to see.') = 'Nothing to see.', 'no hits';
  assert (select string_agg(m.seg_text, '' order by m.seg_ord)
          from public.moderation_marks('  Two  glorp  spaces  ', public.moderation_screen(array['glorp']), false) m)
         = '  Two  glorp  spaces  ', 'segments give the text back exactly';
end
$$;


\echo '== Shadow mode: recorded, not held'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select set_config('dryrun.log', '', true);
select public.submit_review('00000000-0000-4000-8000-0000000000b1', 2, 'no',
                            'One of the staff called me a glorp when I ordered.', '[]');
reset role;
select set_config('request.jwt.claims', '', true);

do $$
declare
  v_id uuid := (select r.id from public.reviews r
                where r.venue_id = '00000000-0000-4000-8000-0000000000b1'
                  and r.author_id = '00000000-0000-4000-8000-0000000000a2');
begin
  assert current_setting('dryrun.log') = 'INSERT:published;', current_setting('dryrun.log');
  assert exists (select 1 from public.moderation_cases c
                 where c.review_id = v_id and c.state = 'open' and c.queue = 'look'
                   and 'shadow_hold' = any(c.signals)), 'no shadow item';
  assert (select v.body from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v where v.id = v_id)
         like '%glorp%', 'shadow mode masked something';
end
$$;


\echo '== Enforcing: a hold is written held, in one statement'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select public.admin_set_moderation_enforced(true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
select set_config('dryrun.log', '', true);
select public.submit_review('00000000-0000-4000-8000-0000000000b1', 1, 'no', 'The manager said gl0rp at me.',
                            '[{"question_id":"00000000-0000-4000-8000-0000000000c1","value":"Nothing more."}]');
reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  assert current_setting('dryrun.log') = 'INSERT:held;', current_setting('dryrun.log');
  assert exists (select 1 from public.moderation_cases c
                 join public.reviews r on r.id = c.review_id
                 where r.author_id = '00000000-0000-4000-8000-0000000000a3'
                   and c.state = 'open' and c.queue = 'decide' and 'held' = any(c.signals)), 'no item to decide';
end
$$;


\echo '== Visibility: anon'
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  -- Also proves the published-only policy needs no column grant on moderation.
  assert not exists (select 1 from public.reviews r where r.body like '%gl0rp%'), 'anon reads a held review';
  assert not exists (select 1 from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v
                     where v.body like '%gl0rp%'), 'venue_reviews shows anon a held review';
  assert (select count(*) from public.review_answers ra
          where ra.question_id = '00000000-0000-4000-8000-0000000000c1') = 0, 'anon reads a held review''s answers';
  assert (select vr.review_count from public.venue_ratings vr
          where vr.venue_id = '00000000-0000-4000-8000-0000000000b1') = 1, 'a held review is counted';
  assert public.venue_latest_review_body('00000000-0000-4000-8000-0000000000b1') not like '%gl0rp%',
    'the marker quotes a held review';
end
$$;


\echo '== Visibility: another reader'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
do $$
begin
  assert not exists (select 1 from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v
                     where v.body like '%gl0rp%'), 'another reader sees a held review';
  assert not exists (select 1 from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v
                     where v.status is not null), 'status leaks onto other people''s reviews';
end
$$;


\echo '== Visibility: the author'
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
do $$
begin
  assert (select v.status from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v where v.is_mine) = 'held',
    'the author does not see their held review';
  assert (select m.moderation from public.my_reviews() m
          where m.venue_id = '00000000-0000-4000-8000-0000000000b1') = 'held', 'my_reviews has no status';
  assert (select count(*) from public.review_answers ra
          where ra.question_id = '00000000-0000-4000-8000-0000000000c1') = 1, 'the author cannot load their answers';
  assert not exists (select 1 from public.reviews r where r.body like '%gl0rp%'),
    'table reads are not published-only for the author';
  assert (select vr.review_count from public.venue_ratings vr
          where vr.venue_id = '00000000-0000-4000-8000-0000000000b1') = 1, 'the author''s aggregates differ';
  perform dryrun.expect_error(
    $q$insert into public.reviews (venue_id, author_id, stars, trans_bathroom)
       values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a3', 5, 'yes')$q$,
    '42501');
end
$$;


\echo '== Deciding: publish, edits, reject, resubmit'
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare
  v_case record;
begin
  assert (select c.decide from public.admin_moderation_counts() c) >= 1, 'the badge count';

  select c.review_id, c.review_updated_at into v_case
  from public.admin_list_cases('decide', 'review') c
  where c.author_id = '00000000-0000-4000-8000-0000000000a3';

  assert v_case.review_id is not null, 'the held review is not in the queue';

  perform dryrun.expect_error(
    format('select public.admin_decide_review(%L, %L, null, null, %L, null)', v_case.review_id, 'publish', 'published'),
    'P0001');
  assert public.admin_decide_review(v_case.review_id, 'publish', null, null, 'held', v_case.review_updated_at) = 'published',
    'publish';
end
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare
  v_row record;
begin
  select v.body, v.unmasked_body into v_row
  from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v
  where v.unmasked_body like '%gl0rp%';
  assert v_row.body = 'The manager said g' || repeat(U&'\2022', 4) || ' at me.', coalesce(v_row.body, 'no masked row');
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
select set_config('dryrun.log', '', true);
select public.submit_review('00000000-0000-4000-8000-0000000000b1', 1, 'no', 'The manager said gl0rp at me, loudly.', '[]');
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  assert current_setting('dryrun.log') = 'UPDATE:published;', 'a cleared word held the review again: ' || current_setting('dryrun.log');
  assert exists (select 1 from public.moderation_cases c
                 join public.reviews r on r.id = c.review_id
                 where r.author_id = '00000000-0000-4000-8000-0000000000a3'
                   and c.state = 'open' and c.queue = 'look' and 'edited_after_clear' = any(c.signals)), 'no edited_after_clear item';
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
select set_config('dryrun.log', '', true);
select public.submit_review('00000000-0000-4000-8000-0000000000b1', 1, 'no', 'The manager said gl0rp at me, and snarfles.', '[]');
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  assert current_setting('dryrun.log') = 'UPDATE:held;', 'a new word did not hold the review: ' || current_setting('dryrun.log');
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare
  v_id uuid := (select c.review_id from public.admin_list_cases('decide', 'review') c
                where c.author_id = '00000000-0000-4000-8000-0000000000a3');
begin
  perform dryrun.expect_error(format('select public.admin_decide_review(%L, %L)', v_id, 'reject'), 'P0001');
  assert public.admin_decide_review(v_id, 'reject', 'hate', 'Please quote it another way.') = 'rejected', 'reject';
end
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
do $$
declare
  v_mine record;
begin
  select m.moderation, m.moderation_reason, m.moderation_note into v_mine
  from public.my_reviews() m
  where m.venue_id = '00000000-0000-4000-8000-0000000000b1';
  assert v_mine.moderation = 'rejected' and v_mine.moderation_reason = 'hate'
         and v_mine.moderation_note = 'Please quote it another way.', 'the author is not told why';
  perform public.submit_review('00000000-0000-4000-8000-0000000000b1', 1, 'no', 'The manager was rude to me.', '[]');
  assert (select m.moderation from public.my_reviews() m
          where m.venue_id = '00000000-0000-4000-8000-0000000000b1') = 'held', 'an edit after a reject was published';
end
$$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  assert exists (select 1 from public.moderation_cases c
                 join public.reviews r on r.id = c.review_id
                 where r.author_id = '00000000-0000-4000-8000-0000000000a3'
                   and c.state = 'open' and 'resubmitted' = any(c.signals)), 'no resubmitted item';
end
$$;


\echo '== Reports'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
do $$
declare
  v_published uuid := (select v.id from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v
                       where v.author_name is not null and v.body like '%staff%');
  v_held      uuid;
begin
  assert v_published is not null, 'no published review to report';
  assert public.report_review(v_published, 'hate', 'Quotes a slur.'), 'a first report';
  assert not public.report_review(v_published, 'hate', null), 'a second report from the same account';
  assert (select v.reported_by_me from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v
          where v.id = v_published), 'reported_by_me';
  perform dryrun.expect_error(format('select public.report_review(%L, %L)', v_published, 'nonsense'), '22023');
end
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
do $$
declare
  v_own uuid := (select v.id from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v where v.is_mine);
begin
  perform dryrun.expect_error(format('select public.report_review(%L, %L)', v_own, 'spam'), '22023');
end
$$;

reset role;
select set_config('request.jwt.claims', '', true);
-- Ten reports in the last day from a5, against reviews long gone.
insert into public.review_reports (review_id, reporter_id, reason)
select null, '00000000-0000-4000-8000-0000000000a5', 'spam' from generate_series(1, 10);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);
do $$
declare
  v_published uuid := (select v.id from public.venue_reviews('00000000-0000-4000-8000-0000000000b1') v
                       where v.body like '%staff%');
  v_held      uuid;
begin
  perform dryrun.expect_error(format('select public.report_review(%L, %L)', v_published, 'hate'), 'P0001');
end
$$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare
  v_held uuid := (select r.id from public.reviews r where r.author_id = '00000000-0000-4000-8000-0000000000a3');
begin
  delete from public.review_reports rr where rr.reporter_id = '00000000-0000-4000-8000-0000000000a5';
  perform set_config('dryrun.held', v_held::text, true);
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
select dryrun.expect_error(format('select public.report_review(%L, %L)', current_setting('dryrun.held'), 'hate'), 'P0002');

-- Kept, then reported again: the low-priority list, not the decide list.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare
  v_case record;
begin
  select c.id, c.review_id into v_case
  from public.admin_list_cases('decide', 'reported') c
  where c.author_id = '00000000-0000-4000-8000-0000000000a2';
  assert v_case.id is not null, 'the reported review is not in the decide list';
  assert (select count(*) from public.admin_case_reports(v_case.id)) = 1, 'the report behind the item';
  assert public.admin_decide_review(v_case.review_id, 'keep') = 'published', 'keep';
  perform set_config('dryrun.kept', v_case.review_id::text, true);
end
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}', true);
select public.report_review(current_setting('dryrun.kept')::uuid, 'hate');
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  assert exists (select 1 from public.moderation_cases c
                 where c.review_id = current_setting('dryrun.kept')::uuid
                   and c.state = 'open' and c.queue = 'look' and 'report_after_keep' = any(c.signals)),
    'a report after a keep went to the decide list';
  assert (select rr.outcome from public.review_reports rr
          where rr.reporter_id = '00000000-0000-4000-8000-0000000000a4') = 'dismissed', 'the first report was not settled';
end
$$;


\echo '== Venue names'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
insert into public.venues (google_place_id, name, lat, lng, last_synced_at)
values ('dryrun-place-1', 'The Glorp Inn', 51.5, -0.12, now()),
       ('dryrun-place-2', 'Glorp Lane Bakery', 51.5, -0.12, now());
select dryrun.expect_error(
  $q$insert into public.venues (google_place_id, name, address) values ('dryrun-place-3', 'Somewhere', 'An address')$q$,
  '42501');
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare
  v_inn uuid := (select v.id from public.venues v where v.google_place_id = 'dryrun-place-1');
begin
  assert (select v.name from public.venues v where v.id = v_inn) = 'Name being checked', 'a held name reached the public';
  assert (select v.pending_name from public.venues v where v.id = v_inn) = 'The Glorp Inn', 'the held name was lost';
  assert exists (select 1 from public.moderation_cases c
                 where c.venue_id = v_inn and c.state = 'open' and c.queue = 'decide'), 'no item for the name';
  assert (select v.name from public.venues v where v.google_place_id = 'dryrun-place-2') = 'Glorp Lane Bakery',
    'the allowlist did not cover a place name';
  perform set_config('dryrun.inn', v_inn::text, true);
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select public.admin_decide_venue_name(current_setting('dryrun.inn')::uuid, 'publish');
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  assert (select v.name from public.venues v where v.id = current_setting('dryrun.inn')::uuid) = 'The Glorp Inn',
    'publishing a name did not restore it';
end
$$;


\echo '== Deleting closes the item'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
select public.delete_my_review('00000000-0000-4000-8000-0000000000b1');
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  assert exists (select 1 from public.moderation_cases c
                 where c.author_id = '00000000-0000-4000-8000-0000000000a3'
                   and c.decision = 'deleted_by_author' and c.review_id is null), 'the deleted review''s item';
  -- The history outlives the review: who wrote it and what it matched, never the words.
  assert exists (select 1 from public.moderation_cases c
                 where c.author_id = '00000000-0000-4000-8000-0000000000a3'
                   and c.decision = 'rejected' and c.review_id is null
                   and cardinality(c.term_ids) > 0), 'the decisions on a deleted review were lost';
  assert not exists (select 1 from public.moderation_cases c
                     where c.author_id = '00000000-0000-4000-8000-0000000000a3' and c.state = 'open'),
    'an item stayed open for a deleted review';
end
$$;


\echo '== Rescan never touches reviews'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);
select public.submit_review('00000000-0000-4000-8000-0000000000b1', 4, 'yes', 'A quimbo was here.', '[]');
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('dryrun.ctid',
  (select r.ctid::text from public.reviews r where r.author_id = '00000000-0000-4000-8000-0000000000a4'), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select public.admin_create_term('quimbo', 'hold', 'racist', 'word', 'en', null, null);
do $$
declare
  v_batch record;
begin
  select * into v_batch from public.admin_rescreen_reviews(null, 200);
  assert v_batch.scanned >= 2 and v_batch.opened >= 1 and v_batch.next_after is null, format('rescan: %s', v_batch);
end
$$;
reset role;
select set_config('request.jwt.claims', '', true);
do $$
declare
  v_review uuid := (select r.id from public.reviews r where r.author_id = '00000000-0000-4000-8000-0000000000a4');
begin
  assert (select r.ctid::text from public.reviews r where r.id = v_review) = current_setting('dryrun.ctid'),
    'the rescan wrote to reviews';
  assert (select r.moderation from public.reviews r where r.id = v_review) = 'published', 'the rescan held a review';
  assert exists (select 1 from public.moderation_cases c
                 where c.review_id = v_review and c.queue = 'look' and 'rescan' = any(c.signals)), 'no rescan item';
end
$$;


\echo '== Take-down needs a ban'
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select dryrun.expect_error(
  $q$select public.admin_take_down_author_reviews('00000000-0000-4000-8000-0000000000a2', 'hate')$q$, 'P0001');
select public.admin_set_banned('00000000-0000-4000-8000-0000000000a2', true);
do $$
begin
  assert public.admin_take_down_author_reviews('00000000-0000-4000-8000-0000000000a2', 'hate') = 1, 'take-down count';
  assert exists (select 1 from public.admin_list_reviews(p_moderation => 'rejected') r
                 where r.author_id = '00000000-0000-4000-8000-0000000000a2'), 'the Reviews status filter';
end
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select dryrun.expect_error(
  $q$insert into public.venues (google_place_id, name, lat, lng) values ('dryrun-place-4', 'Anywhere', 51.5, -0.12)$q$,
  '42501');
reset role;
select set_config('request.jwt.claims', '', true);


\echo '== All checks passed. Rolling back.'
rollback;
