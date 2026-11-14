-- The places of a whole city, for the list and the Directory tab.
--
-- venues_near answers "what is on this piece of map": a bounding box, sixty
-- rows, no online organisations, and the app does not even ask once the map is
-- zoomed out past a few kilometres. That is right for drawing markers and wrong
-- for the two things that are not a map:
--
--   * The list. Opened at a city's zoom it was empty and said "pan the map or
--     zoom out" - to somebody already zoomed out too far to be shown anything.
--   * The Directory tab: every place LavenderBook lists in the city, by kind -
--     the community centres, the trans clinics, the shelters, the queer-owned
--     businesses. For a newcomer that is the question, and it has no map
--     region to it at all.
--
-- venues_directory answers "what is there around here": every reviewed or
-- tagged venue within a radius of a point, nearest first, with its description
-- (20261113100000), plus the online organisations, which have no distance and
-- come last. The app filters by kind itself - a city has tens of listed places,
-- not thousands - so there is one request per city, not one per tap.
--
-- THE POINT IS COARSE. The app sends the centre of an ~11 km square
-- (roundForSearch in src/lib/location-privacy.ts), through the client that
-- carries no session, and works out the distances it shows on the device.
-- distance_meters here is from that rounded point: good for ordering and for
-- the radius, never for display. That is why the radius is generous.
--
-- Two limits, not one. Rows are numbered separately among tagged venues and
-- among untagged (reviewed-only) ones, and each group is cut at p_limit. With a
-- single limit over a nearest-first list, a city with many reviewed cafes would
-- push its own listed shelter off the end - and the online organisations, which
-- sort last, would be the first to go.
--
-- Invoker, like venues_near and venues_search: the tag and review policies
-- apply to the caller exactly as they do on the map, so a held review counts
-- for nobody here either. Needs 20261113100000 for venues.description and its
-- grant.
--
-- Apps without this function (everything up to 1.4.0) are unaffected: they
-- never call it. An app that does call it and finds it missing falls back to
-- venues_search with an empty query, so the two can ship in either order.


create function public.venues_directory(
  p_lat           double precision,
  p_lng           double precision,
  p_radius_meters double precision default 50000,
  p_limit         integer default 300
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
  tags jsonb,
  description text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with known as (
    select
      v.id,
      v.name,
      v.lat,
      v.lng,
      v.google_place_id,
      v.description,
      vr.review_count,
      vr.avg_stars,
      case
        when v.lat is null or v.lng is null then null::double precision
        -- least(): rounding can put the haversine term a hair over 1 for two
        -- points on opposite sides of the world, and asin() of that is an
        -- error, not a large number.
        else 6371000.0 * 2 * asin(least(1.0, sqrt(
          power(sin(radians(v.lat - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(v.lat))
          * power(sin(radians(v.lng - p_lng) / 2), 2)
        )))
      end as meters,
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
    -- The same test the map applies: reviewed, or tagged.
    where vr.review_count > 0
       or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
  ),
  ranked as (
    select
      k.*,
      row_number() over (
        partition by (jsonb_array_length(k.tags) > 0)
        order by (k.meters is null), k.meters, lower(k.name), k.id
      ) as place
    from known k
    -- No coordinates means no distance to be out of range by: an online
    -- organisation is as near to one reader as to another.
    where k.meters is null or k.meters <= p_radius_meters
  )
  select
    r.id,
    r.name,
    r.lat,
    r.lng,
    r.google_place_id,
    r.meters as distance_meters,
    r.review_count,
    r.avg_stars,
    case when r.review_count > 0 then public.venue_latest_review_body(r.id) end as latest_review_body,
    r.tags,
    r.description
  from ranked r
  where r.place <= least(greatest(coalesce(p_limit, 300), 1), 500)
  order by (r.meters is null), r.meters, lower(r.name), r.id;
$$;

comment on function public.venues_directory(double precision, double precision, double precision, integer) is
  'Every reviewed or tagged venue within p_radius_meters of a point, nearest first, each with its description; venues without coordinates (online organisations) are always included and come last. Tagged and untagged venues are limited separately, so reviewed places cannot crowd out listed ones. The caller sends a coarse point and measures the distances it shows itself.';

revoke execute on function public.venues_directory(
  double precision, double precision, double precision, integer
) from public;

grant execute on function public.venues_directory(
  double precision, double precision, double precision, integer
) to anon, authenticated;


-- To check afterwards (read-only), from the middle of Ottawa:
--
--   select name, round(distance_meters) as m, review_count, description,
--          (select string_agg(t->>'slug', ', ') from jsonb_array_elements(tags) t) as tags
--   from public.venues_directory(45.4, -75.7);
