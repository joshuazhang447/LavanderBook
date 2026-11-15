import * as React from 'react';

import { roundForSearch } from '@/lib/location-privacy';
import { publicSupabase } from '@/lib/supabase';
import type { Coords } from '@/lib/use-location';
import type { NearbyVenue } from '@/lib/use-nearby-venues';

/**
 * LavenderBook's own places whose names hold what was typed, wherever they
 * are: for a search box that should find "Kind Space" from Windsor, which no
 * list around Windsor has. The rows around the reader are searched on the
 * device (@/lib/place-match); this only adds the ones further away.
 *
 * Like the place search it sits beside, it sends the ~11 km square, not the
 * position, and goes without the account (@/lib/location-privacy).
 */

/** Below this, a name search matches half the places in the country. */
const MIN_CHARS = 3;
/** Typing, not a request per key. */
const PAUSE_MS = 300;

/** Answers already had this session, by what was typed and where. */
const answers = new Map<string, NearbyVenue[]>();

export function useVenueNameSearch(query: string, origin: Coords | null): NearbyVenue[] {
  const trimmed = query.trim();
  const near = origin ? roundForSearch(origin) : null;
  const key =
    trimmed.length >= MIN_CHARS && near
      ? `${trimmed.toLowerCase()}|${near.latitude},${near.longitude}`
      : null;
  const [loaded, setLoaded] = React.useState<{ key: string; venues: NearbyVenue[] } | null>(null);

  React.useEffect(() => {
    if (key === null || answers.has(key)) return;
    let active = true;
    const [text, point] = key.split('|');
    const [latitude, longitude] = point.split(',').map(Number);
    const timer = setTimeout(async () => {
      const { data, error } = await publicSupabase.rpc('venues_search', {
        p_query: text,
        p_lat: latitude,
        p_lng: longitude,
        p_limit: 20,
        p_include_online: true,
      });
      // A failure finds nothing further away; the rows nearby still show.
      const venues = error ? [] : ((data as NearbyVenue[] | null) ?? []);
      if (!error) answers.set(key, venues);
      if (active) setLoaded({ key, venues });
    }, PAUSE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [key]);

  if (key === null) return NONE;
  return answers.get(key) ?? (loaded?.key === key ? loaded.venues : NONE);
}

const NONE: NearbyVenue[] = [];
