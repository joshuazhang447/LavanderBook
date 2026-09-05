import * as React from 'react';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type NearbyVenue = Database['public']['Functions']['venues_near']['Returns'][number];

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
/** Zoomed right out, stop asking for the whole country. */
const MAX_RADIUS_METERS = 20000;
/**
 * Past this the boxes are unreadable clutter rather than information, so they
 * are not drawn - and the query is skipped rather than thrown away.
 * ~0.05 degrees of latitude is roughly 5.5km of map on screen.
 */
const MAX_VISIBLE_LAT_DELTA = 0.05;

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
 * Reviewed venues inside the visible map region.
 *
 * Refetches when the region settles (pan or zoom), when `refreshKey` changes -
 * it folds together posting a review and walking far enough for a new anchor -
 * and whenever any review changes anywhere, pushed over Realtime.
 */
export function useNearbyVenues(region: MapRegion | null, refreshKey: string) {
  const [venues, setVenues] = React.useState<NearbyVenue[]>([]);
  const zoomedOut = !region || region.latitudeDelta > MAX_VISIBLE_LAT_DELTA;
  // Bumped by the Realtime subscription, which must not itself depend on the
  // region or every pan would tear the channel down and rebuild it.
  const [liveKey, setLiveKey] = React.useState(0);

  React.useEffect(() => {
    if (!region || zoomedOut) return;

    let active = true;

    supabase
      .rpc('venues_near', {
        p_lat: region.latitude,
        p_lng: region.longitude,
        p_radius_meters: radiusForRegion(region),
      })
      .then(({ data }) => {
        if (active) setVenues(data ?? []);
      });

    return () => {
      active = false;
    };
  }, [region, zoomedOut, refreshKey, liveKey]);

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

  return zoomedOut ? NONE : venues;
}
