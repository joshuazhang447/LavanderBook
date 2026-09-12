-- Venue notes, and the admin functions behind the Places section.
--
-- Notes are the second of the two kinds of information a tagged venue carries,
-- and the opposite of the first in almost every way:
--
--            questionnaire answers        venue notes
--   written  reviewers, the public        admins
--   scope    every venue with the tag     this one venue
--   shape    typed and aggregatable       free text, ordered
--   means    what visitors report         WHAT WE ASSERT
--   change   immutable once answered      edited freely
--
-- They share exactly one thing - both appear because a venue is tagged - and
-- keeping them visually distinct wherever both are shown is a correctness
-- requirement rather than a style choice. "We confirmed this shelter is staffed
-- overnight" and "some visitors thought it was" are different claims.
--
-- Notes are freely editable BECAUSE nothing points at them: no answer is stored
-- against a note, nothing is counted from one, and if a note becomes wrong the
-- only sensible response is to correct it. That is why the immutability rule
-- questions live under does not apply here.


-- ---------------------------------------------------------------------------
-- venue_notes
-- ---------------------------------------------------------------------------

create table public.venue_notes (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  body       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,

  -- A bullet is a bullet: long enough for a real fact, short enough that one
  -- paste cannot turn a venue page into an essay.
  constraint venue_notes_body_length check (char_length(body) between 1 and 280)
);

comment on table public.venue_notes is
  'Admin-written facts about one specific venue, shown as bullet points. LavenderBook speaking in its own voice - not crowd-sourced, and never to be displayed as though it were.';

create index venue_notes_venue_idx on public.venue_notes (venue_id, sort_order);

-- Reuse the trigger reviews already uses rather than adding a second one that
-- does the same thing.
create trigger venue_notes_set_updated_at
  before update on public.venue_notes
  for each row execute function public.set_updated_at();

alter table public.venue_notes enable row level security;

create policy "Venue notes are readable by everyone"
  on public.venue_notes for select
  using (true);

grant select on public.venue_notes to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Is a venue actually reachable?
-- ---------------------------------------------------------------------------
--
-- The single most useful thing the Places section can tell an admin is whether
-- the venue they just curated can be found at all. Defined here, once, so the
-- panel's answer cannot drift away from the predicate venues_near actually
-- applies - a filter that disagrees with the map is worse than no filter.

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
        exists (select 1 from public.reviews r where r.venue_id = v.id)
        or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
      )
  );
$$;

comment on function public.venue_is_on_map(uuid) is
  'Whether a venue passes the same test venues_near applies: it has coordinates, and it is either reviewed or tagged. Kept in one place so the admin panel and the map cannot disagree.';


-- ---------------------------------------------------------------------------
-- The Places list
-- ---------------------------------------------------------------------------

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
          vr.review_count > 0
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
-- Adding a place
-- ---------------------------------------------------------------------------

/*
 * Create a venue from a Google place, or fold into the one we already have.
 *
 * Atomic. The equivalent client-side flow in review-sheet.tsx selects by
 * google_place_id and then inserts, which is a race: two people rating the same
 * new place at once both find nothing and both insert, and one gets a unique
 * violation. ON CONFLICT closes that window.
 *
 * `created` comes from xmax = 0, which is the standard way to tell an INSERT
 * from an ON CONFLICT UPDATE in the same statement: a freshly inserted row has
 * no updating transaction stamped on it. It lets the panel say "added" or
 * "already knew this one" rather than guessing.
 *
 * Name, address and coordinates are refreshed on conflict, and last_synced_at
 * stamped. That is what those columns are - a cache of Google, per the comment
 * on venues.last_synced_at - so taking the newer copy is the point.
 */
create or replace function public.admin_upsert_venue(
  p_name            text,
  p_google_place_id text default null,
  p_address         text default null,
  p_lat             double precision default null,
  p_lng             double precision default null,
  p_tag_ids         uuid[] default null
)
returns table (venue_id uuid, created boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_created boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if p_google_place_id is null or btrim(p_google_place_id) = '' then
    -- Nothing to dedupe on. ON CONFLICT cannot help here because two NULLs are
    -- never equal in a unique index, so this is a plain insert - and a second
    -- add of the same unidentified place really does make a second row.
    insert into public.venues (name, address, lat, lng, last_synced_at)
    values (btrim(p_name), nullif(btrim(coalesce(p_address, '')), ''), p_lat, p_lng, now())
    returning id into v_id;
    v_created := true;
  else
    insert into public.venues (google_place_id, name, address, lat, lng, last_synced_at)
    values (
      btrim(p_google_place_id), btrim(p_name),
      nullif(btrim(coalesce(p_address, '')), ''), p_lat, p_lng, now()
    )
    on conflict (google_place_id) do update
      set name           = excluded.name,
          address        = coalesce(excluded.address, public.venues.address),
          lat            = coalesce(excluded.lat, public.venues.lat),
          lng            = coalesce(excluded.lng, public.venues.lng),
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


/*
 * Delete a venue.
 *
 * THIS IS WHY THIS FUNCTION EXISTS: reviews.venue_id is ON DELETE CASCADE, so a
 * plain `delete from venues` silently destroys every review ever written about
 * the place - somebody's account of whether it was safe to be themselves there,
 * gone, with no warning and nothing to restore from.
 *
 * venue_tags and venue_notes cascading is fine; both are ours and both are
 * meaningless without the venue.
 */
create or replace function public.admin_delete_venue(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reviews bigint;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select count(*) into v_reviews from public.reviews where venue_id = p_id;

  if v_reviews > 0 then
    raise exception
      'that place has % review(s), which deleting it would destroy - untag it instead',
      v_reviews
      using errcode = '23503';
  end if;

  delete from public.venues where id = p_id;

  if not found then
    raise exception 'no such place' using errcode = 'P0002';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_venue_notes(p_venue_id uuid)
returns table (
  id         uuid,
  body       text,
  sort_order integer,
  updated_at timestamptz,
  updated_by uuid
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
  select n.id, n.body, n.sort_order, n.updated_at, n.updated_by
  from public.venue_notes n
  where n.venue_id = p_venue_id
  order by n.sort_order, n.created_at;
end;
$$;


create or replace function public.admin_create_venue_note(p_venue_id uuid, p_body text)
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

  insert into public.venue_notes (venue_id, body, sort_order, created_by, updated_by)
  values (
    p_venue_id,
    btrim(p_body),
    coalesce((select max(sort_order) + 1 from public.venue_notes where venue_id = p_venue_id), 1),
    (select auth.uid()),
    (select auth.uid())
  )
  returning id into v_id;

  return v_id;
end;
$$;


create or replace function public.admin_update_venue_note(p_id uuid, p_body text)
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

  update public.venue_notes
  set body = btrim(p_body), updated_by = (select auth.uid())
  where id = p_id;

  if not found then
    raise exception 'no such note' using errcode = 'P0002';
  end if;
end;
$$;


create or replace function public.admin_delete_venue_note(p_id uuid)
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

  -- A hard delete, with no guard: nothing in the schema references a note, so
  -- there is nothing for it to take with it.
  delete from public.venue_notes where id = p_id;

  if not found then
    raise exception 'no such note' using errcode = 'P0002';
  end if;
end;
$$;


create or replace function public.admin_reorder_venue_notes(p_venue_id uuid, p_ids uuid[])
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

  -- The whole list in one statement. At tens of bullets a full rewrite is
  -- cheaper and far simpler than keeping fractional ranks.
  update public.venue_notes n
  set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
  where n.id = o.id and n.venue_id = p_venue_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- The map needs to know a venue is tagged
-- ---------------------------------------------------------------------------
--
-- venues_near and venues_search already return tagged venues that nobody has
-- reviewed - that was the point of the change in 20260911152000. What they do
-- not return is WHICH tags, and without that the map draws a listed shelter as
-- "0.0" with "0 reviews", which does not read as "newly listed". It reads as
-- rated zero out of five, about a place we ourselves vouched for.
--
-- Adding tags here is what lets the marker say "Shelter" instead of inventing a
-- rating nobody gave.
--
-- Dropped first, not replaced: adding a column to a RETURNS TABLE changes the
-- row type defined by the OUT parameters, and Postgres refuses CREATE OR REPLACE
-- across that ("cannot change return type of existing function"). Dropping also
-- discards the grants, so both are restated at the bottom of this file.

drop function if exists public.venues_near(double precision, double precision, double precision, integer);
drop function if exists public.venues_search(text, double precision, double precision, integer);

create or replace function public.venues_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision default 200,
  p_limit integer default 60
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  google_place_id text,
  distance_meters double precision,
  review_count bigint,
  avg_stars numeric,
  latest_review_body text,
  latest_review_at timestamptz,
  tags jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with box as (
    select
      p_radius_meters / 111320.0 as dlat,
      p_radius_meters / (111320.0 * greatest(cos(radians(p_lat)), 0.01)) as dlng
  )
  select
    v.id,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id,
    d.meters as distance_meters,
    vr.review_count,
    vr.avg_stars,
    lr.body as latest_review_body,
    lr.created_at as latest_review_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', t.slug, 'label', t.label,
               'color', t.color, 'text_color', t.text_color)
             order by t.sort_order, t.label)
      from public.venue_tags vt
      join public.tags t on t.id = vt.tag_id and t.archived_at is null
      where vt.venue_id = v.id
    ), '[]'::jsonb) as tags
  from public.venues v
  cross join box b
  join public.venue_ratings vr on vr.venue_id = v.id
  left join lateral (
    select r.body, r.created_at
    from public.reviews r
    where r.venue_id = v.id
    order by r.created_at desc, r.id desc
    limit 1
  ) lr on true
  cross join lateral (
    select 6371000.0 * 2 * asin(sqrt(
      power(sin(radians(v.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(v.lat))
      * power(sin(radians(v.lng - p_lng) / 2), 2)
    )) as meters
  ) d
  where v.lat is not null
    and v.lng is not null
    and v.lat between p_lat - b.dlat and p_lat + b.dlat
    and v.lng between p_lng - b.dlng and p_lng + b.dlng
    and d.meters <= p_radius_meters
    and (
      vr.review_count > 0
      or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
    )
  order by d.meters
  limit p_limit;
$$;


create or replace function public.venues_search(
  p_query text,
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 40
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  google_place_id text,
  distance_meters double precision,
  review_count bigint,
  avg_stars numeric,
  latest_review_body text,
  latest_review_at timestamptz,
  tags jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    v.id,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id,
    d.meters as distance_meters,
    vr.review_count,
    vr.avg_stars,
    lr.body as latest_review_body,
    lr.created_at as latest_review_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', t.slug, 'label', t.label,
               'color', t.color, 'text_color', t.text_color)
             order by t.sort_order, t.label)
      from public.venue_tags vt
      join public.tags t on t.id = vt.tag_id and t.archived_at is null
      where vt.venue_id = v.id
    ), '[]'::jsonb) as tags
  from public.venues v
  join public.venue_ratings vr on vr.venue_id = v.id
  left join lateral (
    select r.body, r.created_at
    from public.reviews r
    where r.venue_id = v.id
    order by r.created_at desc, r.id desc
    limit 1
  ) lr on true
  cross join lateral (
    select case
      when v.lat is null or v.lng is null then null::double precision
      else 6371000.0 * 2 * asin(sqrt(
        power(sin(radians(v.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(v.lat))
        * power(sin(radians(v.lng - p_lng) / 2), 2)
      ))
    end as meters
  ) d
  where (
      vr.review_count > 0
      or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
    )
    and v.name ilike '%' || p_query || '%'
  order by d.meters asc nulls last
  limit p_limit;
$$;


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.venue_is_on_map(uuid)                           from public;
revoke execute on function public.admin_delete_venue(uuid)                        from public;
revoke execute on function public.admin_list_venue_notes(uuid)                    from public;
revoke execute on function public.admin_create_venue_note(uuid, text)             from public;
revoke execute on function public.admin_update_venue_note(uuid, text)             from public;
revoke execute on function public.admin_delete_venue_note(uuid)                   from public;
revoke execute on function public.admin_reorder_venue_notes(uuid, uuid[])         from public;
revoke execute on function public.admin_upsert_venue(
  text, text, text, double precision, double precision, uuid[]
) from public;
revoke execute on function public.admin_list_venues(
  text, uuid, text, text, text, text, text, boolean, integer, integer
) from public;

grant execute on function public.venue_is_on_map(uuid)                            to authenticated;
grant execute on function public.admin_delete_venue(uuid)                         to authenticated;
grant execute on function public.admin_list_venue_notes(uuid)                     to authenticated;
grant execute on function public.admin_create_venue_note(uuid, text)              to authenticated;
grant execute on function public.admin_update_venue_note(uuid, text)              to authenticated;
grant execute on function public.admin_delete_venue_note(uuid)                    to authenticated;
grant execute on function public.admin_reorder_venue_notes(uuid, uuid[])          to authenticated;
grant execute on function public.admin_upsert_venue(
  text, text, text, double precision, double precision, uuid[]
) to authenticated;
grant execute on function public.admin_list_venues(
  text, uuid, text, text, text, text, text, boolean, integer, integer
) to authenticated;

-- Restored after the drops above. Losing these would take the map out entirely,
-- for signed-out visitors first.
grant execute on function public.venues_near(
  double precision, double precision, double precision, integer
) to anon, authenticated;
grant execute on function public.venues_search(
  text, double precision, double precision, integer
) to anon, authenticated;
