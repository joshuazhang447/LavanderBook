-- Search reviewed venues by name, anywhere, ordered by distance from a point.
--
-- A sibling to venues_near with a deliberately identical return shape, so one
-- row component renders both the nearby list and search results.
--
-- Unlike venues_near this has no radius: the point of searching is to find
-- somewhere you are not. distance_meters is what keeps a 40km result honest.

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
  latest_review_at timestamptz
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
    lr.created_at as latest_review_at
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
  -- Rated only. An unrated venue has nothing to show in a list and is found by
  -- tapping its label on the map instead.
  where vr.review_count > 0
    -- ilike cannot use the lower(name) btree, so this is a sequential scan.
    -- Fine at a few thousand venues; pg_trgm GIN is the additive upgrade if it
    -- ever stops being fine, and needs no client change.
    and v.name ilike '%' || p_query || '%'
  -- nulls last so a venue missing coordinates sorts to the bottom rather than
  -- the top, which is where a null would otherwise land.
  order by d.meters asc nulls last
  limit p_limit;
$$;

comment on function public.venues_search(text, double precision, double precision, integer) is
  'Reviewed venues whose name matches p_query, anywhere, ordered by distance from the given point.';

-- Required: this project does not auto-expose new objects, and the grant has to
-- carry the full argument type signature.
grant execute on function public.venues_search(
  text, double precision, double precision, integer
) to anon, authenticated;
