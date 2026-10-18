-- An `online` tag, for groups with no place to visit.
--
-- Some organisations exist only as a website, a chat or a phone line (Gender
-- Mosaic, LGBT YouthLine, United in Pride). They are venues with NO coordinates:
-- we never pin them at a city centre, because a pin says "come here" and there
-- is nowhere to come. How to reach them goes in the venue notes, as plain text
-- (a website, a text number, an email).
--
-- Without coordinates they do not appear on the map - venues_near and
-- venue_is_on_map both require lat and lng - but venues_search returns them by
-- name to apps that ask with p_include_online (20261018120000). Apps up to
-- 1.2.0 do not ask, because their Locate and Directions break on null.
--
-- Depends on 20261018100000_tag_questions_and_new_tags.sql: the questions below
-- are written there and only reused here. If that migration has not run, the
-- helper creates them with the same wording, so the order is safe either way.
--
-- Idempotent, like the previous one: tags by slug, questions by exact live
-- prompt, assignments ON CONFLICT DO NOTHING.
--
-- Deliberately NOT asked of online groups: "Is the place step-free to get
-- into?", "Can you drop in without an appointment?", "When is it open?" - none
-- means anything without a door.
--
-- The colour is a placeholder; change it from the panel.


insert into public.tags (slug, label, description, color, sort_order) values
  ('online', 'Online',
   'Reached by website, chat, text or phone, with no place to visit.', '#4B5D8C', 14)
on conflict (slug) do nothing;


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
  v_id   uuid;
  v_slug text;
  v_tag  uuid;
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


-- In this order on the `online` questionnaire. All shared with other tags.

select pg_temp.ask('How can you reach them?', 'multi_select',
  '{"min_choices": 1}', true, 'Tick every way you could get through.',
  array['Phone', 'Text', 'Online chat', 'In person'],
  array['online']);

select pg_temp.ask('When are they available?', 'single_select', '{}', false, null,
  array['24 hours', 'Set hours', 'Not sure'], array['online']);

select pg_temp.ask('How long until you spoke to someone?', 'duration',
  '{"unit": "minutes"}', false, null, null, array['online']);

select pg_temp.ask('Did staff use your name and pronouns correctly?', 'yes_no_unsure',
  '{}', false, null, null, array['online']);

select pg_temp.ask('Which languages could you be served in?', 'multi_select',
  '{}', false, 'Tick what you were offered, not what the website says.',
  array['English', 'French', 'Another language', 'Sign language'],
  array['online']);

drop function pg_temp.ask(text, text, jsonb, boolean, text, text[], text[]);


-- Check, after running (read-only): `online` should ask 5 questions.
--
--   select q.prompt, qt.sort_order
--   from public.question_tags qt
--   join public.tags t on t.id = qt.tag_id and t.slug = 'online'
--   join public.questions q on q.id = qt.question_id and q.archived_at is null
--   order by qt.sort_order;
