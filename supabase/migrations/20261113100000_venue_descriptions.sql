-- A description for every listed place, written by admins.
--
-- A tagged place already says what KIND of place it is (its tags) and carries
-- what we checked about it (venue_notes: bullets, behind "More details"). What
-- it did not have is the line a directory prints under a name - one or two
-- plain sentences saying what the place is and who it is for. Without it a
-- reader of the list has to open "Kind Space" to learn it is a community
-- centre and not a cafe.
--
-- venues.description is that line.
--
--            description                  venue notes
--   shape    one short paragraph          bullets, ordered, 280 each
--   says     what the place is            what we checked about it
--   shown    in the list and on the card  behind "More details"
--
-- Both are LavenderBook speaking in its own voice, never a visitor's, and the
-- app says so wherever it shows either. Both are freely editable for the same
-- reason: nothing is stored against them and nothing is counted from them.
--
-- Written only through admin functions. `authenticated` can insert a venue
-- (name, coordinates, Google id - the review form does) but has no grant on
-- this column and no UPDATE on venues at all, so a description can only come
-- from the panel. That is also why it is not screened: like a note, and like a
-- name an admin sets, it is the decision itself.
--
-- Nothing here changes what an installed app is sent: venues_near and
-- venues_search are untouched. The list's own function, which returns the
-- description with each row, is the next migration.


-- ---------------------------------------------------------------------------
-- The column
-- ---------------------------------------------------------------------------

alter table public.venues
  add column description text
  -- A paragraph, not a page: long enough for two or three sentences, short
  -- enough that a list row can show most of it.
  constraint venues_description_length
  check (description is null or char_length(description) between 1 and 500);

comment on column public.venues.description is
  'One short paragraph saying what this place is and who it is for. Admin-written, LavenderBook''s own voice; null until someone writes one. Set only through admin_update_venue and admin_upsert_venue.';

-- SELECT on venues names its columns (20261009180000), so a new one is
-- invisible until it is granted. Public on purpose: it is written to be read.
-- It carries no time and no account, and venues is not in the realtime
-- publication.
grant select (description) on public.venues to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Editing a place
-- ---------------------------------------------------------------------------

/*
 * Rename a place and set its description.
 *
 * A function rather than an UPDATE policy, per the rule for everything the
 * panel does: a policy would grant the whole row, and this is two columns.
 *
 * The name is here too because an online organisation has no Google listing to
 * take one from, and because Google's label is sometimes the building rather
 * than the group inside it. venues_normalize_name still collapses its
 * whitespace; venues_screen_name skips admins.
 *
 * An empty description clears it. Runs of whitespace become one space: this is
 * a single paragraph everywhere it is shown, and a pasted line break would
 * otherwise print differently in each of them.
 */
create or replace function public.admin_update_venue(
  p_id          uuid,
  p_name        text,
  p_description text default null
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

  if p_name is null or btrim(p_name) = '' then
    raise exception 'a place needs a name' using errcode = '23514';
  end if;

  update public.venues
  set name        = btrim(p_name),
      description = nullif(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')), '')
  where id = p_id;

  if not found then
    raise exception 'no such place' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_update_venue(uuid, text, text) is
  'Admin only: sets a place''s name and its description (empty clears it). Nothing else about the place changes.';


-- ---------------------------------------------------------------------------
-- Adding a place, with its description
-- ---------------------------------------------------------------------------

-- Dropped and recreated rather than overloaded, as venues_search was in
-- 20261018120000: two functions that both accept the old six arguments would
-- make PostgREST refuse the old call as ambiguous, where one function with a
-- defaulted seventh answers both. A panel built before this migration keeps
-- working. Dropping takes the grants with it; they are restated below.
drop function if exists public.admin_upsert_venue(
  text, text, text, double precision, double precision, uuid[]
);

/*
 * Create a venue, or fold into the one we already have for that Google place.
 *
 * Unchanged from 20260911180000 except for p_description. On a place we
 * already hold, a description is only ever filled in or replaced by one that
 * was actually typed - adding a known place again with the field left empty
 * must not wipe what a colleague wrote.
 *
 * With no Google id and no coordinates this is how an online organisation is
 * added: a venue with nowhere to go to, found in the list and never on the map.
 */
create function public.admin_upsert_venue(
  p_name            text,
  p_google_place_id text default null,
  p_address         text default null,
  p_lat             double precision default null,
  p_lng             double precision default null,
  p_tag_ids         uuid[] default null,
  p_description     text default null
)
returns table (venue_id uuid, created boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id          uuid;
  v_created     boolean;
  v_description text := nullif(btrim(regexp_replace(coalesce(p_description, ''), '\s+', ' ', 'g')), '');
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if p_google_place_id is null or btrim(p_google_place_id) = '' then
    -- Nothing to dedupe on. ON CONFLICT cannot help here because two NULLs are
    -- never equal in a unique index, so this is a plain insert - and a second
    -- add of the same unidentified place really does make a second row.
    insert into public.venues (name, address, lat, lng, description, last_synced_at)
    values (
      btrim(p_name), nullif(btrim(coalesce(p_address, '')), ''), p_lat, p_lng,
      v_description, now()
    )
    returning id into v_id;
    v_created := true;
  else
    insert into public.venues (google_place_id, name, address, lat, lng, description, last_synced_at)
    values (
      btrim(p_google_place_id), btrim(p_name),
      nullif(btrim(coalesce(p_address, '')), ''), p_lat, p_lng,
      v_description, now()
    )
    on conflict (google_place_id) do update
      set name           = excluded.name,
          address        = coalesce(excluded.address, public.venues.address),
          lat            = coalesce(excluded.lat, public.venues.lat),
          lng            = coalesce(excluded.lng, public.venues.lng),
          description    = coalesce(excluded.description, public.venues.description),
          last_synced_at = now()
    returning id, (xmax = 0) into v_id, v_created;
  end if;

  if p_tag_ids is not null and array_length(p_tag_ids, 1) > 0 then
    -- Adds to whatever the venue already carries rather than replacing: an
    -- admin adding a place from search is not saying anything about tags a
    -- colleague applied earlier.
    perform public.admin_set_venue_tags(
      v_id,
      (select array_agg(distinct t) from unnest(
         p_tag_ids || array(select vt.tag_id from public.venue_tags vt where vt.venue_id = v_id)
       ) as t)
    );
  end if;

  return query select v_id, v_created;
end;
$$;

comment on function public.admin_upsert_venue(
  text, text, text, double precision, double precision, uuid[], text
) is
  'Admin only: adds a place, or folds into the one already held for that Google id (its tags are added to, a typed description replaces the old one, an empty one leaves it). Without a Google id or coordinates this adds an online organisation.';


-- ---------------------------------------------------------------------------
-- The Places list shows the description, and can ask for places without one
-- ---------------------------------------------------------------------------

-- Dropped for the same reason as above, and because `description` joins the
-- return type, which CREATE OR REPLACE refuses ("cannot change return type of
-- existing function"). The body is 20261016100200's, plus:
--   * `description` in the row;
--   * p_description, 'any' | 'with' | 'without', so "every tagged place has
--     one" is something the panel can check rather than hope;
--   * the search also looks in the description.
drop function if exists public.admin_list_venues(
  text, uuid, text, text, text, text, text, boolean, integer, integer
);

create function public.admin_list_venues(
  p_search      text default null,
  p_tag_id      uuid default null,
  -- 'any' | 'tagged' | 'untagged'
  p_tag_state   text default 'any',
  -- 'any' | 'with' | 'without'
  p_notes       text default 'any',
  p_reviews     text default 'any',
  -- 'any' | 'on' | 'off'
  p_visibility  text default 'any',
  -- 'name' | 'created_at' | 'review_count' | 'note_count'
  p_sort        text default 'created_at',
  p_desc        boolean default true,
  p_limit       integer default 25,
  p_offset      integer default 0,
  -- 'any' | 'with' | 'without'. Last, so a call written for the ten arguments
  -- above still lands here.
  p_description text default 'any'
)
returns table (
  id              uuid,
  name            text,
  address         text,
  description     text,
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
      v.description,
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
        or c.description ilike '%' || p_search || '%'
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
      and (
        p_description is null or p_description = 'any'
        or (p_description = 'with'    and c.description is not null)
        or (p_description = 'without' and c.description is null)
      )
  )
  select
    f.id, f.name, f.address, f.description, f.lat, f.lng, f.google_place_id, f.created_at,
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
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_update_venue(uuid, text, text) from public;
revoke execute on function public.admin_upsert_venue(
  text, text, text, double precision, double precision, uuid[], text
) from public;
revoke execute on function public.admin_list_venues(
  text, uuid, text, text, text, text, text, boolean, integer, integer, text
) from public;

grant execute on function public.admin_update_venue(uuid, text, text) to authenticated;
grant execute on function public.admin_upsert_venue(
  text, text, text, double precision, double precision, uuid[], text
) to authenticated;
grant execute on function public.admin_list_venues(
  text, uuid, text, text, text, text, text, boolean, integer, integer, text
) to authenticated;


-- To check afterwards (read-only). Every tagged place should end up with one:
--
--   select v.name, v.description
--   from public.venues v
--   where exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
--   order by (v.description is null) desc, v.name;
