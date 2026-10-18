-- Questions for every tag, and three new tags.
--
-- Source: D:\CodingProject\LavenderBookLocations\tag-questions-draft.md. Read its
-- "Principles used" before editing: questions are what a visitor can report (what
-- we assert goes in venue_notes), nothing duplicates the stars or
-- reviews.trans_bathroom, and a question that works everywhere is one shared
-- question rather than ten wordings.
--
-- WHAT THIS DOES
--
--   1. Adds three tags: nightlife, queer-owned, sexual-health. (A fourth,
--      `organization`, is deliberately NOT added - whether groups with no public
--      address belong on the map is undecided.)
--   2. Rewords two UNANSWERED questions in place, and one help text:
--        "Could you be seen without a provincial health card?"  (Ontario-only)
--        "How much is this"  ->  the shared cost question
--        "Is the shelter clean?" help text
--   3. Adds the new questions and assigns shared ones to the tags they apply to.
--
-- WHAT IT DOES NOT TOUCH
--
--   * The six questions that already have an answer. They are immutable (see
--     20260911152000): wording, kind, options, required flag and position all
--     stay. This migration only ever ADDS an assignment to them
--     (the drop-in question and the first-appointment wait are reused).
--   * The `dangerous` tag. It is a warning, not a kind of place; it has and gets
--     no questions.
--   * Any venue, review or answer.
--
-- IDEMPOTENT. Re-running it adds nothing: a question is looked up by its exact
-- prompt among live questions before it is created, assignments use
-- ON CONFLICT DO NOTHING, and the in-place rewrites are guarded on "no answers".
-- The one thing a re-run cannot do is undo a hand edit made in the admin panel.
--
-- NEW TAG COLOURS ARE PLACEHOLDERS. The ten-hue palette is spoken for and no two
-- live tags should share a colour, so these are muted, distinct picks. Change
-- them from the panel (Tags -> edit); the chip text colour is derived.
--
-- Written with plain SQL rather than admin_* functions: those open with
-- is_admin(), which needs a signed-in user, and a migration has none.


-- ---------------------------------------------------------------------------
-- 1. Tags
-- ---------------------------------------------------------------------------

insert into public.tags (slug, label, description, color, sort_order) values
  ('nightlife',     'Nightlife',
   'Bars, clubs and drag rooms for the LGBTQ+ community.',                   '#A0522D', 11),
  ('queer-owned',   'Queer-owned',
   'Cafes, shops and studios owned by LGBTQ+ people or built to welcome them.', '#8E8E3A', 12),
  ('sexual-health', 'Sexual health',
   'HIV and STI testing, PrEP and harm-reduction services.',                  '#708090', 13)
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------------
-- 2. Rewording, in place, only while nobody has answered
-- ---------------------------------------------------------------------------

-- Ontario-only wording. Gatineau is on RAMQ, and Centretown's clinic cannot see
-- Quebec residents at all, so the question has to be about public insurance in
-- general.
update public.questions q
set prompt    = 'Could you be seen without public health insurance (OHIP or RAMQ)?',
    help_text = 'Some clinics only take residents of their own province.'
where q.prompt = 'Could you be seen without a provincial health card?'
  and q.archived_at is null
  and not exists (select 1 from public.review_answers ra where ra.question_id = q.id);

-- The orphan becomes the shared cost question.
update public.questions q
set prompt    = 'How much did it cost you?',
    help_text = 'Enter 0 if it was free. Leave it blank if you are not sure.'
where q.prompt = 'How much is this'
  and q.archived_at is null
  and not exists (select 1 from public.review_answers ra where ra.question_id = q.id);

update public.questions q
set help_text = 'Bedding, bathrooms and common areas. Not spotless, just cared for.'
where q.prompt = 'Is the shelter clean?'
  and q.archived_at is null
  and not exists (select 1 from public.review_answers ra where ra.question_id = q.id);


-- ---------------------------------------------------------------------------
-- 3. New questions, and assignments
-- ---------------------------------------------------------------------------
--
-- A throwaway helper in the session's temp schema; it disappears with the
-- connection and leaves nothing in public. Returns the question's id, creating
-- the question only if no live question has this exact prompt.
--
-- A tag slug that does not exist raises, so a typo cannot silently skip a tag.
-- Position is "end of the tag's questionnaire", so calling the tag-specific
-- questions first keeps the shared ones at the bottom of each list.

create function pg_temp.ask(
  p_prompt   text,
  p_kind     text,
  p_config   jsonb,
  p_required boolean,
  p_help     text,
  p_options  text[],
  p_tags     text[]
)
returns uuid
language plpgsql
as $$
declare
  v_id    uuid;
  v_slug  text;
  v_tag   uuid;
begin
  select q.id into v_id
  from public.questions q
  where q.prompt = p_prompt and q.archived_at is null
  limit 1;

  if v_id is null then
    insert into public.questions (prompt, help_text, kind, config, required)
    values (p_prompt, p_help, p_kind::public.question_kind,
            coalesce(p_config, '{}'::jsonb), p_required)
    returning id into v_id;

    perform public.set_question_options(v_id, coalesce(p_options, '{}'::text[]));
  end if;

  foreach v_slug in array coalesce(p_tags, '{}'::text[]) loop
    select t.id into v_tag from public.tags t where t.slug = v_slug;
    if v_tag is null then
      raise exception 'no tag with slug %', v_slug;
    end if;

    insert into public.question_tags (question_id, tag_id, sort_order)
    values (
      v_id, v_tag,
      coalesce((select max(qt.sort_order) from public.question_tags qt
                where qt.tag_id = v_tag), 0) + 1
    )
    on conflict (question_id, tag_id) do nothing;
  end loop;

  return v_id;
end;
$$;


-- ---- support-group -------------------------------------------------------

select pg_temp.ask('Who runs it?', 'single_select', '{}', false, null,
  array['Peer volunteers', 'A trained facilitator or counsellor', 'Not sure'],
  array['support-group']);

select pg_temp.ask('Did you have to register first?', 'yes_no_unsure', '{}', false,
  'Some groups ask you to call ahead, others let you walk in.',
  null, array['support-group']);

-- ---- healthcare ----------------------------------------------------------

select pg_temp.ask('Were they taking new patients?', 'single_select', '{}', false, null,
  array['Yes, I was seen straight away', 'Yes, after a wait',
        'No, they were not taking patients', 'Not sure'],
  array['healthcare']);

select pg_temp.ask('Did you feel able to talk about your gender or sexuality with them?',
  'yes_no_unsure', '{}', false,
  'You were not made to explain or defend yourself.',
  null, array['healthcare']);

-- ---- mental-health -------------------------------------------------------

select pg_temp.ask('Was the counsellor or therapist knowledgeable about LGBTQ+ issues?',
  'yes_no_unsure', '{}', false, null, null, array['mental-health']);

select pg_temp.ask('How could you see them?', 'multi_select',
  '{"min_choices": 1}', false, 'Tick everything that was offered.',
  array['In person', 'By phone', 'Online video', 'Drop-in or walk-in'],
  array['mental-health']);

-- ---- sexual-health -------------------------------------------------------
-- Not "What did they offer?": trans-healthcare already owns that exact prompt
-- with different options, and a lookup by prompt would reuse it.

select pg_temp.ask('Which sexual health services did you use?', 'multi_select',
  '{"min_choices": 1}', false, 'Tick everything you used.',
  array['HIV testing', 'Other STI testing', 'PrEP', 'PEP',
        'Harm-reduction supplies', 'Vaccines (such as HPV or hepatitis)', 'Counselling'],
  array['sexual-health']);

select pg_temp.ask('Could you test without giving your name?', 'yes_no_unsure',
  '{}', false, null, null, array['sexual-health']);

select pg_temp.ask('How long until you had your results?', 'duration',
  '{"unit": "days"}', false, null, null, array['sexual-health']);

-- ---- crisis --------------------------------------------------------------

select pg_temp.ask('How can you reach them?', 'multi_select',
  '{"min_choices": 1}', true, 'Tick every way you could get through.',
  array['Phone', 'Text', 'Online chat', 'In person'],
  array['crisis']);

select pg_temp.ask('When are they available?', 'single_select', '{}', false, null,
  array['24 hours', 'Set hours', 'Not sure'], array['crisis']);

select pg_temp.ask('How long until you spoke to someone?', 'duration',
  '{"unit": "minutes"}', false, null, null, array['crisis']);

-- ---- shelter -------------------------------------------------------------

select pg_temp.ask('Were you placed in the right section for your gender?',
  'yes_no_unsure', '{}', false,
  'In the section, room or floor that matches your gender, or given a safe alternative.',
  null, array['shelter']);

select pg_temp.ask('What time is the curfew?', 'time_of_day', '{}', false,
  'Leave it blank if there is none.', null, array['shelter']);

select pg_temp.ask('Were you asked to show ID or proof of anything?', 'yes_no_unsure',
  '{}', false, null, null, array['shelter']);

select pg_temp.ask('What is the longest you can stay?', 'duration',
  '{"unit": "days"}', false, 'Leave it blank if there is no limit.',
  null, array['shelter']);

-- ---- food ----------------------------------------------------------------

select pg_temp.ask('What was available?', 'multi_select',
  '{"min_choices": 1}', false, 'Tick everything you saw.',
  array['Groceries', 'Hot meals', 'Clothing', 'Hygiene products', 'Haircuts', 'Other'],
  array['food']);

select pg_temp.ask('Did you have to register or show ID?', 'yes_no_unsure', '{}', false,
  'Some places ask for nothing, others want a form or ID.',
  null, array['food']);

-- ---- youth ---------------------------------------------------------------

select pg_temp.ask('What ages is it for?', 'multi_select',
  '{"min_choices": 1}', false, null,
  array['Under 13', '13 to 17', '18 to 25', '26 to 35'], array['youth']);

select pg_temp.ask('Did you need a parent or guardian''s permission?', 'yes_no_unsure',
  '{}', false, null, null, array['youth']);

select pg_temp.ask('Did they keep what you said private?', 'yes_no_unsure', '{}', false,
  'Not passed on to parents, school or anyone else without asking you.',
  null, array['youth']);

-- ---- legal ---------------------------------------------------------------

select pg_temp.ask('What did they help with?', 'multi_select',
  '{"min_choices": 1}', true, 'Tick everything they helped with.',
  array['Changing name or gender marker', 'Discrimination', 'Housing',
        'Immigration or refugee claim', 'Family law', 'Other'],
  array['legal']);

-- ---- nightlife -----------------------------------------------------------

select pg_temp.ask('What was the age policy?', 'single_select', '{}', false,
  '19 and over in Ontario, 18 and over in Quebec.',
  array['All ages', '18 and over', '19 and over', 'Not sure'], array['nightlife']);

select pg_temp.ask('What was on?', 'multi_select', '{"min_choices": 1}', false,
  'Tick everything you saw.',
  array['Drag', 'Karaoke', 'DJ and dance floor', 'Live music', 'Comedy or trivia'],
  array['nightlife']);

select pg_temp.ask('Did staff step in when someone was harassed?', 'yes_no_unsure',
  '{}', false, 'Say not sure if you did not see it happen.', null, array['nightlife']);

select pg_temp.ask('Were you let in without a hassle at the door?', 'yes_no_unsure',
  '{}', false, null, null, array['nightlife']);


-- ---- shared: written once, assigned to many ------------------------------
-- Existing questions are reused by prompt and only gain assignments.

-- Drop-in already belongs to `hub` (answered, untouched); sexual-health joins it.
select pg_temp.ask('Can you drop in without an appointment?', 'yes_no_unsure',
  '{}', true, null, null, array['sexual-health']);

-- The first-appointment wait already belongs to `trans-healthcare`.
select pg_temp.ask('How long did you wait for a first appointment?', 'duration',
  '{"unit": "weeks"}', false, null, null,
  array['healthcare', 'mental-health', 'legal', 'sexual-health']);

-- The rewritten orphan: one currency question for every tag that can cost money.
select pg_temp.ask('How much did it cost you?', 'currency',
  '{"code": "CAD"}', false,
  'Enter 0 if it was free. Leave it blank if you are not sure.', null,
  array['mental-health', 'legal', 'sexual-health', 'nightlife', 'support-group']);

select pg_temp.ask('Did staff use your name and pronouns correctly?', 'yes_no_unsure',
  '{}', false, null, null,
  array['healthcare', 'trans-healthcare', 'mental-health', 'crisis', 'shelter',
        'youth', 'legal', 'sexual-health']);

select pg_temp.ask('Which languages could you be served in?', 'multi_select',
  '{}', false, 'Tick what you were offered, not what the website says.',
  array['English', 'French', 'Another language', 'Sign language'],
  array['hub', 'support-group', 'healthcare', 'trans-healthcare', 'mental-health',
        'crisis', 'shelter', 'food', 'youth', 'legal', 'sexual-health']);

select pg_temp.ask('Is the place step-free to get into?', 'yes_no_unsure', '{}', false,
  'A ramp or level entrance, and a lift if it is not on the ground floor.', null,
  array['hub', 'support-group', 'healthcare', 'trans-healthcare', 'mental-health',
        'shelter', 'food', 'youth', 'legal', 'sexual-health', 'nightlife',
        'queer-owned']);

drop function pg_temp.ask(text, text, jsonb, boolean, text, text[], text[]);


-- ---------------------------------------------------------------------------
-- Check, after running (read-only)
-- ---------------------------------------------------------------------------
--
--   select t.slug, count(*) as questions
--   from public.tags t
--   left join public.question_tags qt on qt.tag_id = t.id
--   left join public.questions q on q.id = qt.question_id and q.archived_at is null
--   group by t.slug order by min(t.sort_order);
--
-- Expected after this migration: dangerous 0, crisis 5, shelter 8, food 4,
-- healthcare 6, trans-healthcare 8, mental-health 7, youth 6, legal 6,
-- hub 5, support-group 8, nightlife 6, queer-owned 1, sexual-health 9.
-- (count(*) over a left join reports 1 for a tag with none: read dangerous as 0.)
