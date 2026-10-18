-- venues_search keeps venues without coordinates away from apps that cannot
-- handle them.
--
-- Online organisations (the `online` tag, 20261018110000) are venues with no
-- lat/lng on purpose. Every installed Android app up to 1.2.0 (versionCode 3)
-- assumes a search result has coordinates: "Locate" hands null to the map's
-- initialRegion, and "Directions" opens Google Maps at "null,null". Those
-- builds have the JS bundle baked in and no over-the-air updates, so nothing
-- server-side can change what those buttons do. What the server CAN do is not
-- send such a venue to them in the first place.
--
-- So: a new p_include_online, default false. Old apps never pass it and get
-- exactly what they got before, minus venues without coordinates. The website
-- and builds after 1.2.0 pass true and hide Locate and Directions for those
-- rows. Despite the name, the switch is about coordinates, not the tag: any
-- venue without lat/lng counts, because that is what breaks the old buttons.
--
-- Dropped and recreated rather than overloaded. Two venues_search functions
-- that both accept (p_query, p_lat, p_lng) would make PostgREST refuse the
-- old call as ambiguous; one function with a defaulted fifth argument answers
-- both. Dropping takes the grants with it, so they are restated below.
--
-- Body otherwise unchanged from 20261009180000_hide_review_dates.sql.

drop function if exists public.venues_search(text, double precision, double precision, integer);

create function public.venues_search(
  p_query          text,
  p_lat            double precision,
  p_lng            double precision,
  p_limit          integer default 40,
  p_include_online boolean default false
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
    case when vr.review_count > 0 then public.venue_latest_review_body(v.id) end as latest_review_body,
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
    and (p_include_online or (v.lat is not null and v.lng is not null))
    and v.name ilike '%' || p_query || '%'
  order by d.meters asc nulls last
  limit p_limit;
$$;

comment on function public.venues_search(text, double precision, double precision, integer, boolean) is
  'Reviewed or tagged venues whose name matches, nearest first. Venues without coordinates (online organisations) are returned only when p_include_online is true: apps up to 1.2.0 cannot locate or route to them and never pass it.';

revoke execute on function public.venues_search(
  text, double precision, double precision, integer, boolean
) from public;

grant execute on function public.venues_search(
  text, double precision, double precision, integer, boolean
) to anon, authenticated;
