-- Questions become a bank, assignable to any number of tags.
--
-- They were owned outright by one tag - questions.tag_id, not null. That made
-- "Is this place wheelchair accessible?" a thing you write once per tag, which
-- guarantees ten slightly different wordings of the same question that can never
-- be compared with each other. §10 of docs/tag-system-design.md flagged this
-- join table as the additive fix; this is it.
--
-- Three consequences, all deliberate:
--
--   * sort_order moves off questions and onto question_tags. Order is a property
--     of a question WITHIN a tag, and a shared question sits in a different
--     place in each of them.
--   * A question may belong to no tag at all. That is the bank - written, not
--     yet asked - and it is a state, not a mistake.
--   * Both foreign keys cascade. Deleting a tag drops its assignments and the
--     questions survive in the bank, so nothing is lost and refusing would just
--     be obstruction. admin_delete_tag therefore stops caring about questions
--     and only checks venues.


-- ---------------------------------------------------------------------------
-- question_tags
-- ---------------------------------------------------------------------------

create table public.question_tags (
  question_id uuid not null references public.questions (id) on delete cascade,
  tag_id      uuid not null references public.tags (id)      on delete cascade,
  sort_order  integer not null default 0,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (question_id, tag_id)
);

comment on table public.question_tags is
  'Which questions a tag asks, and in what order. Many-to-many on purpose: one well-worded question serves every tag it applies to, so the answers can actually be compared across them.';

-- One tag's questionnaire in order - the hot read, and the primary key leads
-- with question_id so it cannot serve this.
create index question_tags_tag_idx on public.question_tags (tag_id, sort_order);

-- Carry the existing ownership across. A no-op today at zero questions, but the
-- migration has to be correct rather than convenient.
insert into public.question_tags (question_id, tag_id, sort_order)
select id, tag_id, sort_order from public.questions;

alter table public.questions
  drop column tag_id,
  drop column sort_order;

alter table public.question_tags enable row level security;

create policy "Question assignments are readable by everyone"
  on public.question_tags for select
  using (true);

grant select on public.question_tags to anon, authenticated;


-- ---------------------------------------------------------------------------
-- The bank
-- ---------------------------------------------------------------------------

-- Signature changes from (uuid, boolean) to (text, boolean), so this cannot be
-- replaced in place.
drop function if exists public.admin_list_questions(uuid, boolean);

create or replace function public.admin_list_questions(
  p_search text default null,
  p_include_archived boolean default false
)
returns table (
  id            uuid,
  prompt        text,
  help_text     text,
  kind          public.question_kind,
  config        jsonb,
  required      boolean,
  supersedes_id uuid,
  archived_at   timestamptz,
  answer_count  bigint,
  options       jsonb,
  tags          jsonb
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
    q.id, q.prompt, q.help_text, q.kind, q.config, q.required,
    q.supersedes_id, q.archived_at,
    -- What the editor needs to know before offering to reword something.
    (select count(*) from public.review_answers ra where ra.question_id = q.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                       order by o.sort_order, o.label)
      from public.question_options o where o.question_id = q.id
    ), '[]'::jsonb),
    -- Enough of each tag to draw its chip without a second query.
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'slug', t.slug, 'label', t.label,
               'color', t.color, 'text_color', t.text_color)
             order by t.sort_order, t.label)
      from public.question_tags qt
      join public.tags t on t.id = qt.tag_id
      where qt.question_id = q.id
    ), '[]'::jsonb)
  from public.questions q
  where (p_include_archived or q.archived_at is null)
    and (
      p_search is null or p_search = ''
      or q.prompt ilike '%' || p_search || '%'
      or q.help_text ilike '%' || p_search || '%'
    )
  order by q.archived_at nulls first, lower(q.prompt);
end;
$$;

comment on function public.admin_list_questions(text, boolean) is
  'The whole question bank, with each question''s options, its answer count, and the tags it is assigned to. A question assigned to nothing still appears - that is the bank working, not a gap.';


-- One tag's questionnaire, live only, in its own order.
create or replace function public.admin_list_tag_questions(p_tag_id uuid)
returns table (
  id           uuid,
  prompt       text,
  help_text    text,
  kind         public.question_kind,
  config       jsonb,
  required     boolean,
  sort_order   integer,
  answer_count bigint,
  options      jsonb
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
    q.id, q.prompt, q.help_text, q.kind, q.config, q.required, qt.sort_order,
    (select count(*) from public.review_answers ra where ra.question_id = q.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                       order by o.sort_order, o.label)
      from public.question_options o where o.question_id = q.id
    ), '[]'::jsonb)
  from public.question_tags qt
  join public.questions q on q.id = qt.question_id
  where qt.tag_id = p_tag_id and q.archived_at is null
  order by qt.sort_order, lower(q.prompt);
end;
$$;


-- ---------------------------------------------------------------------------
-- Writing questions
-- ---------------------------------------------------------------------------

-- Loses p_tag_id, gains p_tag_ids, so again not replaceable in place.
drop function if exists public.admin_create_question(
  uuid, text, public.question_kind, jsonb, boolean, text, text[]
);

create or replace function public.admin_create_question(
  p_prompt    text,
  p_kind      public.question_kind,
  p_config    jsonb   default '{}'::jsonb,
  p_required  boolean default false,
  p_help_text text    default null,
  p_options   text[]  default null,
  -- Optional, so a field can be written and assigned in one call rather than
  -- created into limbo and attached as an afterthought.
  p_tag_ids   uuid[]  default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  insert into public.questions (prompt, help_text, kind, config, required, created_by)
  values (
    btrim(p_prompt),
    nullif(btrim(coalesce(p_help_text, '')), ''),
    p_kind,
    coalesce(p_config, '{}'::jsonb),
    p_required,
    (select auth.uid())
  )
  returning id into v_id;

  perform public.set_question_options(v_id, coalesce(p_options, '{}'::text[]));

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    perform public.admin_set_question_tags(v_id, p_tag_ids);
  end if;

  return v_id;
end;
$$;


/*
 * Assignment from the question's side: this question belongs to exactly these tags.
 *
 * Archived tags are allowed here, unlike admin_set_venue_tags which refuses
 * them. The difference is who is affected: applying an archived tag to a VENUE
 * would change what the public is asked right now, while assigning a question to
 * an archived tag changes nothing until that tag is restored. Blocking it would
 * only get in the way of tidying up a tag before bringing it back.
 */
create or replace function public.admin_set_question_tags(p_question_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(p_tag_ids, '{}'::uuid[]);
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  delete from public.question_tags qt
  where qt.question_id = p_question_id and not (qt.tag_id = any(v_ids));

  -- New assignments land at the end of each tag's existing order. Guessing a
  -- position inside someone else's questionnaire would be wrong more often than
  -- right; they can reorder from the tag.
  insert into public.question_tags (question_id, tag_id, sort_order, assigned_by)
  select
    p_question_id,
    t.tag_id,
    coalesce((select max(qt.sort_order) from public.question_tags qt
               where qt.tag_id = t.tag_id), 0) + 1,
    (select auth.uid())
  from unnest(v_ids) as t(tag_id)
  -- Leaves assigned_by and the existing position alone for tags already set, so
  -- re-saving a form does not reshuffle a questionnaire.
  on conflict (question_id, tag_id) do nothing;
end;
$$;


-- Assignment from the tag's side: add these questions to this tag, keeping
-- whatever it already has.
create or replace function public.admin_assign_questions(p_tag_id uuid, p_question_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(p_question_ids, '{}'::uuid[]);
  v_base integer;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select coalesce(max(sort_order), 0) into v_base
  from public.question_tags where tag_id = p_tag_id;

  insert into public.question_tags (question_id, tag_id, sort_order, assigned_by)
  select q.question_id, p_tag_id, v_base + q.ord, (select auth.uid())
  from unnest(v_ids) with ordinality as q(question_id, ord)
  on conflict (question_id, tag_id) do nothing;
end;
$$;


create or replace function public.admin_unassign_question(p_tag_id uuid, p_question_id uuid)
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

  -- Only the assignment goes. The question stays in the bank with its answers
  -- intact, which is the whole point of a bank.
  delete from public.question_tags
  where tag_id = p_tag_id and question_id = p_question_id;
end;
$$;


-- Now reorders within one tag rather than within the question table.
create or replace function public.admin_reorder_questions(p_tag_id uuid, p_ids uuid[])
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

  update public.question_tags qt
  set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(question_id, ord)
  -- Scoped to the tag, so reordering one questionnaire cannot disturb the
  -- position of the same shared question inside another.
  where qt.question_id = o.question_id and qt.tag_id = p_tag_id;
end;
$$;


-- Archiving is the usual way to retire a question, and the only way once it has
-- been answered. This is for the other case: written by mistake, never used.
create or replace function public.admin_delete_question(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_answers bigint;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select count(*) into v_answers from public.review_answers where question_id = p_id;

  if v_answers > 0 then
    raise exception
      'that field has been answered % time(s) - archive it instead, so the answers keep their wording',
      v_answers
      using errcode = '23503';
  end if;

  if exists (select 1 from public.questions where supersedes_id = p_id) then
    raise exception 'that field was replaced by a newer one and cannot be deleted'
      using errcode = '23503';
  end if;

  delete from public.questions where id = p_id;

  if not found then
    raise exception 'no such field' using errcode = 'P0002';
  end if;
end;
$$;


/*
 * Revise, with the rule from 20260911152000 intact.
 *
 * Unanswered, this rewords in place. Answered, it archives the old question and
 * returns a NEW id - the wording people were asked under is not ours to change
 * after the fact.
 *
 * The new part is that the successor must INHERIT THE OLD ONE'S ASSIGNMENTS.
 * Without that, rewording a question silently drops it out of every tag that
 * asked it, and nothing would report an error - the questionnaire would just
 * quietly get shorter.
 */
create or replace function public.admin_revise_question(
  p_question_id uuid,
  p_prompt      text,
  p_kind        public.question_kind,
  p_config      jsonb   default '{}'::jsonb,
  p_required    boolean default false,
  p_help_text   text    default null,
  p_options     text[]  default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old      public.questions%rowtype;
  v_answered boolean;
  v_new_id   uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select * into v_old from public.questions where id = p_question_id;
  if not found then
    raise exception 'no such field' using errcode = 'P0002';
  end if;
  if v_old.archived_at is not null then
    raise exception 'that field is archived; create a new one instead' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.review_answers ra where ra.question_id = p_question_id
  ) into v_answered;

  if not v_answered then
    update public.questions
    set prompt    = btrim(p_prompt),
        help_text = nullif(btrim(coalesce(p_help_text, '')), ''),
        kind      = p_kind,
        config    = coalesce(p_config, '{}'::jsonb),
        required  = p_required
    where id = p_question_id;

    perform public.set_question_options(p_question_id, coalesce(p_options, '{}'::text[]));
    return p_question_id;
  end if;

  insert into public.questions (
    prompt, help_text, kind, config, required, supersedes_id, created_by
  )
  values (
    btrim(p_prompt),
    nullif(btrim(coalesce(p_help_text, '')), ''),
    p_kind,
    coalesce(p_config, '{}'::jsonb),
    p_required,
    v_old.id,
    (select auth.uid())
  )
  returning id into v_new_id;

  perform public.set_question_options(v_new_id, coalesce(p_options, '{}'::text[]));

  -- The successor takes the retired question's place in every tag, at exactly
  -- the position it held.
  insert into public.question_tags (question_id, tag_id, sort_order, assigned_by)
  select v_new_id, qt.tag_id, qt.sort_order, (select auth.uid())
  from public.question_tags qt
  where qt.question_id = p_question_id;

  -- The archived original keeps its own rows for history; venue_questionnaire
  -- filters on archived_at, so they are never asked again.
  update public.questions set archived_at = now() where id = p_question_id;

  return v_new_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Functions that counted questions through the old column
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_tags(p_include_archived boolean default true)
returns table (
  id             uuid,
  slug           text,
  label          text,
  description    text,
  color          text,
  text_color     text,
  sort_order     integer,
  archived_at    timestamptz,
  venue_count    bigint,
  question_count bigint
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
    t.id, t.slug, t.label, t.description, t.color, t.text_color, t.sort_order, t.archived_at,
    (select count(*) from public.venue_tags vt where vt.tag_id = t.id),
    (select count(*)
       from public.question_tags qt
       join public.questions q on q.id = qt.question_id
      where qt.tag_id = t.id and q.archived_at is null)
  from public.tags t
  where p_include_archived or t.archived_at is null
  order by t.archived_at nulls first, t.sort_order, t.label;
end;
$$;


-- Questions no longer block a delete: the assignments cascade away and the
-- questions themselves stay in the bank. Only venues still hold a tag down.
create or replace function public.admin_delete_tag(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venues bigint;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select count(*) into v_venues from public.venue_tags where tag_id = p_id;

  if v_venues > 0 then
    raise exception 'that tag is applied to % venue(s) - archive it instead', v_venues
      using errcode = '23503';
  end if;

  delete from public.tags where id = p_id;

  if not found then
    raise exception 'no such tag' using errcode = 'P0002';
  end if;
end;
$$;


create or replace function public.venue_questionnaire(p_venue_id uuid)
returns table (
  tag_id         uuid,
  tag_slug       text,
  tag_label      text,
  tag_color      text,
  tag_text_color text,
  question_id    uuid,
  prompt         text,
  help_text      text,
  kind           public.question_kind,
  config         jsonb,
  required       boolean,
  options        jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id, t.slug, t.label, t.color, t.text_color,
    q.id, q.prompt, q.help_text, q.kind, q.config, q.required,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                       order by o.sort_order, o.label)
      from public.question_options o where o.question_id = q.id
    ), '[]'::jsonb)
  from public.venue_tags vt
  join public.tags t on t.id = vt.tag_id and t.archived_at is null
  join public.question_tags qt on qt.tag_id = t.id
  join public.questions q on q.id = qt.question_id and q.archived_at is null
  where vt.venue_id = p_venue_id
  order by t.sort_order, t.label, qt.sort_order, lower(q.prompt);
$$;

comment on function public.venue_questionnaire(uuid) is
  'Live questions for a venue''s live tags, grouped by tag, in each tag''s own order. A question shared by two of the venue''s tags appears once under each - deliberately: the duplication is visible and explicable, where a silent merge would not be.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_list_questions(text, boolean)          from public;
revoke execute on function public.admin_list_tag_questions(uuid)               from public;
revoke execute on function public.admin_set_question_tags(uuid, uuid[])        from public;
revoke execute on function public.admin_assign_questions(uuid, uuid[])         from public;
revoke execute on function public.admin_unassign_question(uuid, uuid)          from public;
revoke execute on function public.admin_delete_question(uuid)                  from public;
revoke execute on function public.admin_create_question(
  text, public.question_kind, jsonb, boolean, text, text[], uuid[]
) from public;

grant execute on function public.admin_list_questions(text, boolean)           to authenticated;
grant execute on function public.admin_list_tag_questions(uuid)                to authenticated;
grant execute on function public.admin_set_question_tags(uuid, uuid[])         to authenticated;
grant execute on function public.admin_assign_questions(uuid, uuid[])          to authenticated;
grant execute on function public.admin_unassign_question(uuid, uuid)           to authenticated;
grant execute on function public.admin_delete_question(uuid)                   to authenticated;
grant execute on function public.admin_create_question(
  text, public.question_kind, jsonb, boolean, text, text[], uuid[]
) to authenticated;


-- ---------------------------------------------------------------------------
-- A worked example
-- ---------------------------------------------------------------------------
--
-- One field, so the section has something in it on first open. Safe to delete -
-- unlike the tags, the real fields are the organisers' to write.
--
-- Worth noticing what is slightly wrong with it: a bank question reads best
-- phrased neutrally, because it can be assigned anywhere. "Is the shelter
-- clean?" starts looking odd the moment it is also assigned to `hub`. "Is this
-- place clean?" would travel better.

do $$
declare
  v_question uuid;
  v_tag      uuid;
begin
  select id into v_tag from public.tags where slug = 'shelter';

  if v_tag is not null
     and not exists (select 1 from public.questions where prompt = 'Is the shelter clean?') then
    insert into public.questions (prompt, kind, help_text)
    values ('Is the shelter clean?', 'yes_no',
            'Bedding, bathrooms and common areas - not spotless, just cared for.')
    returning id into v_question;

    insert into public.question_tags (question_id, tag_id, sort_order)
    values (v_question, v_tag, 1);
  end if;
end $$;
