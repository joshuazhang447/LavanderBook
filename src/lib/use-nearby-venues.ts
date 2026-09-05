import * as React from 'react';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { Coords } from '@/lib/use-location';
import { VIEW_RADIUS_METERS } from '@/lib/use-location';

export type NearbyVenue = Database['public']['Functions']['venues_near']['Returns'][number];

/**
 * Reviewed venues around `anchor`. Refetches only when the anchor changes, which
 * useWalkingAnchor already throttles to roughly once per 50m walked.
 */
export function useNearbyVenues(anchor: Coords | null): NearbyVenue[] {
  const [venues, setVenues] = React.useState<NearbyVenue[]>([]);

  React.useEffect(() => {
    if (!anchor) return;

    let active = true;

    supabase
      .rpc('venues_near', {
        p_lat: anchor.latitude,
        p_lng: anchor.longitude,
        p_radius_meters: VIEW_RADIUS_METERS,
      })
      .then(({ data }) => {
        if (active) setVenues(data ?? []);
      });

    return () => {
      active = false;
    };
  }, [anchor]);

  return venues;
}
