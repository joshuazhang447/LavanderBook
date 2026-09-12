-- Tag colour becomes content, not schema.
--
-- 20260911152000 stored colour as public.tag_color, an enum of ten hues, with a
-- unique index so no two live tags shared one. Between them those capped the
-- system at ten tags forever: an eleventh needed ALTER TYPE ... ADD VALUE, which
-- needs a migration, which needs a developer.
--
-- That is the wrong constraint in the wrong place for a directory whose whole
-- premise is that organisers add their own categories without waiting on code.
-- The curated palette was a good idea; making it a schema decision rather than a
-- content decision was not. It survives as the preset swatches in the panel.
--
-- What the enum was really protecting was legibility - ten hand-checked pairs
-- that worked in both themes. That protection does not go away, it moves: the
-- client now stores one colour per tag and DERIVES the other three, solving for
-- a text lightness that clears WCAG 4.5:1 rather than trusting a fixed value.
-- See src/lib/tag-colors.ts. Perceived lightness varies enormously by hue, so a
-- fixed lightness passes for some hues and fails for others; solving for it
-- means an admin cannot produce an unreadable chip by accident.
--
-- tags.text_color is the deliberate override: null means computed.


-- ---------------------------------------------------------------------------
-- 1. New columns, backfilled from the enum
-- ---------------------------------------------------------------------------

alter table public.tags
  add column color_hex      text,
  add column text_color_hex text;

-- Each seeded hue at 50% lightness, 88% saturation - the mid point the light and
-- dark variants are derived from. The ten tags keep exactly the colours they
-- were given.
update public.tags set color_hex = case color
  when 'orange' then '#F0530F'   --  18
  when 'amber'  then '#F0B80F'   --  45
  when 'lime'   then '#92F00F'   --  85
  when 'green'  then '#0FF080'   -- 150
  when 'teal'   then '#0FE8F0'   -- 182
  when 'sky'    then '#0F92F0'   -- 205
  when 'indigo' then '#0F22F0'   -- 235
  when 'violet' then '#6D0FF0'   -- 265
  when 'purple' then '#DD0FF0'   -- 295
  when 'pink'   then '#F00F92'   -- 325
end;


-- ---------------------------------------------------------------------------
-- 2. Drop what depends on the type
-- ---------------------------------------------------------------------------
--
-- These four take or return tag_color. Their signatures change, so CREATE OR
-- REPLACE cannot do it - Postgres refuses to replace a function with a different
-- return type or argument list.

drop function if exists public.admin_create_tag(text, text, public.tag_color, text, integer);
drop function if exists public.admin_update_tag(uuid, text, public.tag_color, text, integer);
drop function if exists public.admin_list_tags(boolean);
drop function if exists public.venue_questionnaire(uuid);

-- The cap itself.
drop index if exists public.tags_color_unique_when_live;

alter table public.tags drop column color;
drop type public.tag_color;


-- ---------------------------------------------------------------------------
-- 3. Settle the new columns
-- ---------------------------------------------------------------------------

alter table public.tags rename column color_hex      to color;
alter table public.tags rename column text_color_hex to text_color;

alter table public.tags alter column color set not null;

-- Six-digit hex only. Three-digit shorthand and rgba() would both need handling
-- in the derivation, and there is no reason to accept a second spelling of the
-- same thing from a colour picker we control.
alter table public.tags
  add constraint tags_color_format check (color ~* '^#[0-9a-f]{6}$'),
  add constraint tags_text_color_format
    check (text_color is null or text_color ~* '^#[0-9a-f]{6}$');

comment on column public.tags.color is
  'The tag''s one colour, as #rrggbb. The chip background and text, in light and dark, are all derived from it by src/lib/tag-colors.ts - which solves for a text lightness that clears WCAG 4.5:1 rather than assuming one.';

comment on column public.tags.text_color is
  'Null means the text colour is computed, which is almost always what you want. Set to overrule the formula; the panel shows the resulting contrast and warns when it drops below 4.5:1, but does not refuse - there are legitimate reasons to overrule it and none to lecture someone about it.';


-- ---------------------------------------------------------------------------
-- 4. The functions, again
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
  p_color       text,
  p_text_color  text default null,
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

  insert into public.tags (slug, label, color, text_color, description, sort_order, created_by)
  values (
    btrim(p_slug), btrim(p_label),
    upper(btrim(p_color)),
    nullif(upper(btrim(coalesce(p_text_color, ''))), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_sort_order, (select auth.uid())
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'a tag with the slug % already exists', p_slug using errcode = '23505';
end;
$$;


-- The slug is still absent, and still deliberately. It is the stable handle a
-- client keys behaviour off, and renaming it silently breaks anything holding
-- one. Retire the tag and make a new one instead.
create or replace function public.admin_update_tag(
  p_id          uuid,
  p_label       text,
  p_color       text,
  p_text_color  text default null,
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
      color       = upper(btrim(p_color)),
      text_color  = nullif(upper(btrim(coalesce(p_text_color, ''))), ''),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      sort_order  = coalesce(p_sort_order, sort_order)
  where id = p_id;

  if not found then
    raise exception 'no such tag' using errcode = 'P0002';
  end if;
end;
$$;


-- Archiving is the usual way to retire a tag, and the only way once it has been
-- used. This is for the other case: a tag added by mistake, or renamed into
-- existence and never applied.
--
-- Both foreign keys are ON DELETE RESTRICT, so the database refuses a tag in use
-- whatever this function does. What it adds is a sentence a person can act on
-- instead of a foreign-key violation.
create or replace function public.admin_delete_tag(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venues    bigint;
  v_questions bigint;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select count(*) into v_venues    from public.venue_tags where tag_id = p_id;
  select count(*) into v_questions from public.questions  where tag_id = p_id;

  if v_venues > 0 or v_questions > 0 then
    raise exception
      'that tag is in use by % venue(s) and % question(s) - archive it instead',
      v_venues, v_questions
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
  join public.questions q on q.tag_id = t.id and q.archived_at is null
  where vt.venue_id = p_venue_id
  order by t.sort_order, t.label, q.sort_order, q.prompt;
$$;

comment on function public.venue_questionnaire(uuid) is
  'Live questions for a venue''s live tags, grouped by tag. No dedup across tags: a venue tagged both shelter and hub gets both questionnaires as separate sections, because matching questions on prompt text is guesswork and visible duplication is easier to read than a wrong merge.';


-- ---------------------------------------------------------------------------
-- 5. Grants, for the recreated and new functions
-- ---------------------------------------------------------------------------
--
-- A dropped function takes its grants with it, so every one of these has to be
-- restated - including for functions that merely changed shape.

revoke execute on function public.admin_list_tags(boolean)                            from public;
revoke execute on function public.admin_create_tag(text, text, text, text, text, integer) from public;
revoke execute on function public.admin_update_tag(uuid, text, text, text, text, integer) from public;
revoke execute on function public.admin_delete_tag(uuid)                              from public;
revoke execute on function public.venue_questionnaire(uuid)                           from public;

grant execute on function public.admin_list_tags(boolean)                             to authenticated;
grant execute on function public.admin_create_tag(text, text, text, text, text, integer) to authenticated;
grant execute on function public.admin_update_tag(uuid, text, text, text, text, integer) to authenticated;
grant execute on function public.admin_delete_tag(uuid)                               to authenticated;
grant execute on function public.venue_questionnaire(uuid)                            to anon, authenticated;
