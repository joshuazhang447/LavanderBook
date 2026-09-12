-- Reading and writing the tag system.
--
-- The tables in 20260911152000_tag_system.sql are readable by everyone and
-- writable by nobody. These functions are the only writers, and each opens by
-- checking is_admin() itself - rendering the admin panel is a client-side
-- decision that can be forced, so the refusal has to live here.
--
-- Every admin_* function follows the pattern established by admin_set_banned:
-- security definer, search_path pinned, guard first, execute granted to
-- `authenticated` because a grant is not finer-grained than a role.


-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.question_requires_options(p_kind public.question_kind)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_kind in ('single_select', 'multi_select');
$$;

-- Replaces a question's options wholesale. Only ever called for a question with
-- no answers - either brand new, or being edited in place because nobody has
-- answered it yet - so the cascade delete here can never orphan an answer.
create or replace function public.set_question_options(p_question_id uuid, p_options text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.question_kind;
  v_count integer := coalesce(array_length(p_options, 1), 0);
begin
  select kind into v_kind from public.questions where id = p_question_id;

  if public.question_requires_options(v_kind) then
    if v_count < 2 then
      raise exception 'a % question needs at least two options', v_kind
        using errcode = '22023';
    end if;
  elsif v_count > 0 then
    raise exception 'a % question does not take options', v_kind
      using errcode = '22023';
  end if;

  delete from public.question_options where question_id = p_question_id;

  -- with ordinality preserves the order they were typed in, which is the order
  -- the author meant.
  insert into public.question_options (question_id, label, sort_order)
  select p_question_id, btrim(o.label), o.ord
  from unnest(p_options) with ordinality as o(label, ord);
end;
$$;


-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_tags(p_include_archived boolean default true)
returns table (
  id             uuid,
  slug           text,
  label          text,
  description    text,
  color          public.tag_color,
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
    t.id, t.slug, t.label, t.description, t.color, t.sort_order, t.archived_at,
    (select count(*) from public.venue_tags vt where vt.tag_id = t.id),
    -- Live questions only: the archived ones are history, and a count that
    -- included them would not match what the editor shows by default.
    (select count(*) from public.questions q
      where q.tag_id = t.id and q.archived_at is null)
  from public.tags t
  where p_include_archived or t.archived_at is null
  order by t.archived_at nulls first, t.sort_order, t.label;
end;
$$;


create or replace function public.admin_create_tag(
  p_slug        text,
  p_label       text,
  p_color       public.tag_color,
  p_description text default null,
  p_sort_order  integer default 0
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

  insert into public.tags (slug, label, color, description, sort_order, created_by)
  values (btrim(p_slug), btrim(p_label), p_color, nullif(btrim(coalesce(p_description, '')), ''),
          p_sort_order, (select auth.uid()))
  returning id into v_id;

  return v_id;
exception
  -- Both are unique violations, and "duplicate key value violates unique
  -- constraint tags_color_unique_when_live" is not a sentence to show anyone.
  when unique_violation then
    if position('tags_color_unique_when_live' in sqlerrm) > 0 then
      raise exception 'another live tag already uses the % colour', p_color
        using errcode = '23505';
    end if;
    raise exception 'a tag with the slug % already exists', p_slug
      using errcode = '23505';
end;
$$;


-- The slug is deliberately absent. It is the stable handle a client keys
-- behaviour off, and renaming it silently breaks anything holding one. Retire
-- the tag and make a new one instead.
create or replace function public.admin_update_tag(
  p_id          uuid,
  p_label       text,
  p_color       public.tag_color,
  p_description text default null,
  p_sort_order  integer default null
)
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

  update public.tags
  set label       = btrim(p_label),
      color       = p_color,
      description = nullif(btrim(coalesce(p_description, '')), ''),
      sort_order  = coalesce(p_sort_order, sort_order)
  where id = p_id;

  if not found then
    raise exception 'no such tag' using errcode = 'P0002';
  end if;
exception
  when unique_violation then
    raise exception 'another live tag already uses the % colour', p_color
      using errcode = '23505';
end;
$$;


-- Archive and restore are one function because they are one decision, and a
-- restore can fail in a way a caller must be told about: the colour may have
-- been taken while the tag was away.
create or replace function public.admin_set_tag_archived(p_id uuid, p_archived boolean)
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

  update public.tags
  -- coalesce so re-archiving keeps the original date rather than restarting it.
  set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_id
  returning archived_at into v_archived_at;

  if not found then
    raise exception 'no such tag' using errcode = 'P0002';
  end if;

  return v_archived_at;
exception
  when unique_violation then
    raise exception 'that tag cannot be restored: another live tag has taken its colour'
      using errcode = '23505';
end;
$$;


create or replace function public.admin_reorder_tags(p_ids uuid[])
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

  -- One statement for the whole list. At this many rows a full rewrite is
  -- cheaper and far simpler than keeping fractional ranks.
  update public.tags t
  set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where t.id = o.id;
end;
$$;


-- Replaces a venue's tags with exactly this set. Takes an existing venue, so
-- tagging a Google place is two steps for the panel: insert the venue (which
-- any signed-in user may already do) then call this.
create or replace function public.admin_set_venue_tags(p_venue_id uuid, p_tag_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_archived integer;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if not exists (select 1 from public.venues where id = p_venue_id) then
    raise exception 'no such venue' using errcode = 'P0002';
  end if;

  -- An archived tag is one we have stopped using. Applying it would quietly
  -- resurrect a questionnaire nobody expects to be asked.
  select count(*) into v_archived
  from public.tags t
  where t.id = any(coalesce(p_tag_ids, '{}'::uuid[])) and t.archived_at is not null;

  if v_archived > 0 then
    raise exception 'cannot apply an archived tag' using errcode = '22023';
  end if;

  delete from public.venue_tags vt
  where vt.venue_id = p_venue_id
    and not (vt.tag_id = any(coalesce(p_tag_ids, '{}'::uuid[])));

  insert into public.venue_tags (venue_id, tag_id, added_by)
  select p_venue_id, t.tag_id, (select auth.uid())
  from unnest(coalesce(p_tag_ids, '{}'::uuid[])) as t(tag_id)
  -- Leaves added_by and added_at alone for tags already present, so re-saving
  -- the form does not rewrite who applied what.
  on conflict (venue_id, tag_id) do nothing;
end;
$$;


-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_questions(
  p_tag_id uuid,
  p_include_archived boolean default false
)
returns table (
  id            uuid,
  tag_id        uuid,
  prompt        text,
  help_text     text,
  kind          public.question_kind,
  config        jsonb,
  required      boolean,
  sort_order    integer,
  supersedes_id uuid,
  archived_at   timestamptz,
  answer_count  bigint,
  options       jsonb
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
    q.id, q.tag_id, q.prompt, q.help_text, q.kind, q.config, q.required,
    q.sort_order, q.supersedes_id, q.archived_at,
    -- What the editor needs to decide whether an edit rewords or supersedes,
    -- and to say so before the author commits to it.
    (select count(*) from public.review_answers ra where ra.question_id = q.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                       order by o.sort_order, o.label)
      from public.question_options o where o.question_id = q.id
    ), '[]'::jsonb)
  from public.questions q
  where q.tag_id = p_tag_id
    and (p_include_archived or q.archived_at is null)
  order by q.archived_at nulls first, q.sort_order, q.prompt;
end;
$$;


create or replace function public.admin_create_question(
  p_tag_id    uuid,
  p_prompt    text,
  p_kind      public.question_kind,
  p_config    jsonb   default '{}'::jsonb,
  p_required  boolean default false,
  p_help_text text    default null,
  p_options   text[]  default null
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

  insert into public.questions (tag_id, prompt, help_text, kind, config, required, sort_order, created_by)
  values (
    p_tag_id,
    btrim(p_prompt),
    nullif(btrim(coalesce(p_help_text, '')), ''),
    p_kind,
    coalesce(p_config, '{}'::jsonb),
    p_required,
    -- Appended to the end of the live list. Reorder afterwards if it belongs
    -- elsewhere; guessing here would be wrong more often than right.
    coalesce((select max(sort_order) + 1 from public.questions
               where tag_id = p_tag_id and archived_at is null), 1),
    (select auth.uid())
  )
  returning id into v_id;

  perform public.set_question_options(v_id, coalesce(p_options, '{}'::text[]));

  return v_id;
end;
$$;


-- The rule from the schema header lives here and nowhere else.
--
-- Unanswered, this rewords the question in place. Answered, it archives the old
-- one and returns a NEW id: the wording people were asked under is not ours to
-- change after the fact. Callers must use the returned id rather than assuming
-- they still hold the right one.
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
    raise exception 'no such question' using errcode = 'P0002';
  end if;
  if v_old.archived_at is not null then
    raise exception 'that question is archived; create a new one instead'
      using errcode = '22023';
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

  -- Answered. Stand up the replacement first, so a failure anywhere below
  -- leaves the original live rather than leaving the tag with a gap.
  insert into public.questions (
    tag_id, prompt, help_text, kind, config, required, sort_order,
    supersedes_id, created_by
  )
  values (
    v_old.tag_id,
    btrim(p_prompt),
    nullif(btrim(coalesce(p_help_text, '')), ''),
    p_kind,
    coalesce(p_config, '{}'::jsonb),
    p_required,
    v_old.sort_order,   -- takes the retired question's place in the list
    v_old.id,
    (select auth.uid())
  )
  returning id into v_new_id;

  perform public.set_question_options(v_new_id, coalesce(p_options, '{}'::text[]));

  update public.questions set archived_at = now() where id = p_question_id;

  return v_new_id;
end;
$$;


create or replace function public.admin_set_question_archived(p_id uuid, p_archived boolean)
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

  -- A question retired by a revision has a successor standing in its place;
  -- bringing it back would ask both wordings at once.
  if not p_archived and exists (
    select 1 from public.questions q where q.supersedes_id = p_id
  ) then
    raise exception 'that question was replaced by a newer one and cannot be restored'
      using errcode = '22023';
  end if;

  update public.questions
  set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_id
  returning archived_at into v_archived_at;

  if not found then
    raise exception 'no such question' using errcode = 'P0002';
  end if;

  return v_archived_at;
end;
$$;


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

  update public.questions q
  set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  -- Scoped to the tag, so a stray id from another questionnaire cannot reorder
  -- a list the caller was not looking at.
  where q.id = o.id and q.tag_id = p_tag_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- The public read path
-- ---------------------------------------------------------------------------

-- Every live question a venue should ask, grouped by the tag that asks it.
-- security invoker, so the ordinary select policies apply and an archived tag or
-- question simply is not visible.
create or replace function public.venue_questionnaire(p_venue_id uuid)
returns table (
  tag_id        uuid,
  tag_slug      text,
  tag_label     text,
  tag_color     public.tag_color,
  question_id   uuid,
  prompt        text,
  help_text     text,
  kind          public.question_kind,
  config        jsonb,
  required      boolean,
  options       jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id, t.slug, t.label, t.color,
    q.id, q.prompt, q.help_text, q.kind, q.config, q.required,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                       order by o.sort_order, o.label)
      from public.question_options o where o.question_id = q.id
    ), '[]'::jsonb)
  from public.venue_tags vt
  join public.tags t on t.id = vt.tag_id and t.archived_at is null
  join public.questions q on q.tag_id = t.id and q.archived_at is null
  where vt.venue_id = p_venue_id
  -- Tag order then question order: the review sheet renders one labelled
  -- section per tag, in the order the tags themselves are listed.
  order by t.sort_order, t.label, q.sort_order, q.prompt;
$$;

comment on function public.venue_questionnaire(uuid) is
  'Live questions for a venue''s live tags, grouped by tag. No dedup across tags: a venue tagged both shelter and hub gets both questionnaires as separate sections, because matching questions on prompt text is guesswork and visible duplication is easier to read than a wrong merge.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.question_requires_options(public.question_kind) from public;
revoke execute on function public.set_question_options(uuid, text[])              from public;
revoke execute on function public.admin_list_tags(boolean)                        from public;
revoke execute on function public.admin_create_tag(text, text, public.tag_color, text, integer) from public;
revoke execute on function public.admin_update_tag(uuid, text, public.tag_color, text, integer) from public;
revoke execute on function public.admin_set_tag_archived(uuid, boolean)           from public;
revoke execute on function public.admin_reorder_tags(uuid[])                      from public;
revoke execute on function public.admin_set_venue_tags(uuid, uuid[])              from public;
revoke execute on function public.admin_list_questions(uuid, boolean)             from public;
revoke execute on function public.admin_create_question(uuid, text, public.question_kind, jsonb, boolean, text, text[]) from public;
revoke execute on function public.admin_revise_question(uuid, text, public.question_kind, jsonb, boolean, text, text[]) from public;
revoke execute on function public.admin_set_question_archived(uuid, boolean)      from public;
revoke execute on function public.admin_reorder_questions(uuid, uuid[])           from public;
revoke execute on function public.venue_questionnaire(uuid)                       from public;

-- set_question_options is called only by the two functions above, which have
-- already checked is_admin(). It is never granted to anyone.

grant execute on function public.admin_list_tags(boolean)                        to authenticated;
grant execute on function public.admin_create_tag(text, text, public.tag_color, text, integer) to authenticated;
grant execute on function public.admin_update_tag(uuid, text, public.tag_color, text, integer) to authenticated;
grant execute on function public.admin_set_tag_archived(uuid, boolean)           to authenticated;
grant execute on function public.admin_reorder_tags(uuid[])                      to authenticated;
grant execute on function public.admin_set_venue_tags(uuid, uuid[])              to authenticated;
grant execute on function public.admin_list_questions(uuid, boolean)             to authenticated;
grant execute on function public.admin_create_question(uuid, text, public.question_kind, jsonb, boolean, text, text[]) to authenticated;
grant execute on function public.admin_revise_question(uuid, text, public.question_kind, jsonb, boolean, text, text[]) to authenticated;
grant execute on function public.admin_set_question_archived(uuid, boolean)      to authenticated;
grant execute on function public.admin_reorder_questions(uuid, uuid[])           to authenticated;

-- Anyone writing a review needs this, signed in or not.
grant execute on function public.venue_questionnaire(uuid) to anon, authenticated;
