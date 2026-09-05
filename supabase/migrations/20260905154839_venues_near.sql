-- Reviewed venues around a point, for the boxes drawn on the map.
--
-- Deliberately no PostGIS. A bounding box plus Haversine is a few milliseconds at
-- this scale; a GiST index only starts winning around 100k venues. Keeping the
-- geometry out of the table also keeps `select *` on venues small. If this ever
-- needs PostGIS the signature and return shape stay identical, so it is one
-- migration and no client change.

-- Narrows the bounding box below to an index range scan.
create index if not exists venues_lat_lng_idx on public.venues (lat, lng);

-- Makes the lateral "most recent review" an index lookup rather than a sort per venue.
create index if not exists reviews_venue_recent_idx
  on public.reviews (venue_id, created_at desc, id desc);

-- Parameters are p_-prefixed because RETURNS TABLE column names share a namespace
-- with parameter names, and this returns lat/lng columns.
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
  latest_review_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with box as (
    select
      p_radius_meters / 111320.0 as dlat,
      -- greatest(...) guards against cos() approaching zero near the poles,
      -- which would otherwise make the longitude window explode.
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
    lr.created_at as latest_review_at
  from public.venues v
  cross join box b
  join public.venue_ratings vr on vr.venue_id = v.id
  -- on true keeps this a LEFT join, so a venue whose newest review has no text
  -- still comes back (the box falls back to showing the review count).
  left join lateral (
    select r.body, r.created_at
    from public.reviews r
    where r.venue_id = v.id
    -- id breaks created_at ties so the "latest" review is deterministic.
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
    -- Bounding box first: this is the part an index can serve. The exact
    -- distance below only runs on what survives, and must never move into a
    -- form the planner would have to evaluate over the whole table.
    and v.lat between p_lat - b.dlat and p_lat + b.dlat
    and v.lng between p_lng - b.dlng and p_lng + b.dlng
    and d.meters <= p_radius_meters
    -- Unreviewed venues already carry a Google label; we only draw our own box
    -- where we have something to say.
    and vr.review_count > 0
  order by d.meters
  limit p_limit;
$$;

comment on function public.venues_near(double precision, double precision, double precision, integer) is
  'Reviewed venues within p_radius_meters of a point, nearest first, each with its rating aggregate and most recent review.';

-- Required: this project does not auto-expose new objects, and the grant has to
-- carry the full argument type signature.
grant execute on function public.venues_near(
  double precision, double precision, double precision, integer
) to anon, authenticated;
