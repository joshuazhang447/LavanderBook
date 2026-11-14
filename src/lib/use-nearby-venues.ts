import * as React from 'react';

import type { Database } from '@/lib/database.types';
import { GRID_METERS, GRID_PADDING_METERS, snapToGrid } from '@/lib/location-privacy';
import { publicSupabase, supabase } from '@/lib/supabase';

export type NearbyVenue = Database['public']['Functions']['venues_near']['Returns'][number] & {
  /**
   * What LavenderBook says the place is, when the row came from the list
   * (venues_directory sends it). The map's own rows do not carry one, and the
   * place card asks for it itself; see useVenueDetails.
   */
  description?: string | null;
};

/**
 * Whether a venue has a place on the map. Online organisations do not: they
 * reach the app only through venues_search with p_include_online, and Locate
 * and Directions have nowhere to go for them. The generated types say number;
 * a search result can still carry null.
 */
export function isMapped(venue: Pick<NearbyVenue, 'lat' | 'lng'>): boolean {
  return venue.lat != null && venue.lng != null;
}

/** The slice of map currently on screen, as react-native-maps reports it. */
export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const METERS_PER_DEGREE_LAT = 111320;
/** Fetch slightly past the edges so panning does not reveal empty space first. */
const OVERSCAN = 1.25;
/**
 * Up to here the radius follows the view in grid squares, as it always has.
 * Further out it doubles in steps instead: zooming out a little asks for
 * nothing new, and the request says no more about the view than its scale.
 */
const STEPPED_FROM_METERS = 20000;
/** Half the way round the world: everything. */
const MAX_RADIUS_METERS = 20_000_000;
/**
 * The most places one request brings, nearest first. Zoomed out they are
 * drawn as groups (map-layout.ts), and a group's count is only true if the
 * places in it all came: the server's default of 60 counted a city short.
 */
const MAX_PLACES = 500;

/** Stable so a hidden map does not hand back a new array every render. */
const NONE: NearbyVenue[] = [];

function radiusForRegion(region: MapRegion): number {
  const halfHeight = (region.latitudeDelta * METERS_PER_DEGREE_LAT) / 2;
  const halfWidth =
    (region.longitudeDelta *
      METERS_PER_DEGREE_LAT *
      Math.cos((region.latitude * Math.PI) / 180)) /
    2;
  // Corner-to-centre, so venues near the edges of a wide screen are included.
  const corner = Math.sqrt(halfHeight ** 2 + halfWidth ** 2);
  return Math.min(corner * OVERSCAN, MAX_RADIUS_METERS);
}

/**
 * What is actually sent for a region: the centre of its grid square, and a
 * radius padded to cover what the real centre would have, rounded up to whole
 * squares. Rounding the radius too means zooming within a step sends nothing
 * new, and the request says no more about the zoom than about the place.
 */
function queryForRegion(region: MapRegion): { lat: number; lng: number; radius: number } {
  const centre = snapToGrid(region);
  const needed = Math.min(radiusForRegion(region) + GRID_PADDING_METERS, MAX_RADIUS_METERS);
  const radius =
    needed <= STEPPED_FROM_METERS
      ? Math.ceil(needed / GRID_METERS) * GRID_METERS
      : STEPPED_FROM_METERS * 2 ** Math.ceil(Math.log2(needed / STEPPED_FROM_METERS));
  return {
    lat: centre.latitude,
    lng: centre.longitude,
    radius: Math.min(radius, MAX_RADIUS_METERS),
  };
}

/**
 * Reviewed and listed venues inside the visible map region, at any zoom: the
 * map draws them as pins close in and as groups further out (map-layout.ts).
 * It used to stop at about 5 km of map, when every place was a card and a
 * city's worth of cards was a pile; zoomed out, the map was simply empty.
 *
 * Refetches when the region settles into a different grid square or zoom step,
 * when `refreshKey` changes - it folds together posting a review and walking
 * far enough for a new anchor - and whenever any review changes anywhere,
 * pushed over Realtime.
 *
 * The server is sent the square, never the point; see @/lib/location-privacy.
 * `distance_meters` in the result is therefore measured from the square's
 * centre, and anything shown to the user measures from the real point itself.
 */
export function useNearbyVenues(region: MapRegion | null, refreshKey: string) {
  const [venues, setVenues] = React.useState<NearbyVenue[]>([]);
  // Bumped by the Realtime subscription, which must not itself depend on the
  // region or every pan would tear the channel down and rebuild it.
  const [liveKey, setLiveKey] = React.useState(0);

  const query = region ? queryForRegion(region) : null;
  // A string, so a pan that stays inside the same square and zoom step is the
  // same dependency and fires nothing.
  const queryKey = query ? `${query.lat},${query.lng},${query.radius}` : null;

  React.useEffect(() => {
    if (!queryKey) return;
    const [lat, lng, radius] = queryKey.split(',').map(Number);

    let active = true;

    // publicSupabase, not supabase: this carries a place, and must not carry
    // the account with it.
    publicSupabase
      .rpc('venues_near', {
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: radius,
        p_limit: MAX_PLACES,
      })
      .then(({ data }) => {
        if (active) setVenues(data ?? []);
      });

    return () => {
      active = false;
    };
  }, [queryKey, refreshKey, liveKey]);

  React.useEffect(() => {
    const channel = supabase
      .channel('reviews-near-me')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews' },
        // Refetch rather than patching locally: avg_stars lives in a view, and
        // views emit no change events, so the aggregate has to be recomputed.
        () => setLiveKey((key) => key + 1)
      )
      .subscribe();

    return () => {
      // removeChannel, not unsubscribe: unsubscribe stops events but leaves the
      // channel object against the per-connection budget.
      supabase.removeChannel(channel);
    };
  }, []);

  return { venues: region ? venues : NONE };
}
