import { supabase } from '@/lib/supabase';
import type { Coords } from '@/lib/use-location';
import type { SelectedPoi } from '@/lib/venues';

/**
 * A place returned by search, before anyone has reviewed it.
 *
 * Shaped to line up with both ends: `placeId` is a real Google place id, which
 * is what `venues.google_place_id` dedupes on, so rating a searched place and
 * later tapping that same place's label on the map resolve to one venue rather
 * than two rows with two separate star averages.
 */
export type PlaceResult = {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /**
   * False for cities, regions, streets and the like.
   *
   * They stay searchable on purpose - typing "Berlin" to move the map there is
   * a reasonable thing to want - but a whole city has no door to walk through
   * and nothing to say about whether it is safe to be yourself in, so it never
   * gets a rate pin. Decided on the server from Google's own place types; see
   * supabase/functions/_shared/http.ts.
   *
   * Optional, and every caller must treat absent as reviewable - never `!x`,
   * always `x === false`. The web build is deployed separately from the edge
   * functions, so a client that knows about this field WILL at some point be
   * talking to a function that does not send it. Reading that as "not
   * reviewable" makes a routine version skew look like a total outage.
   */
  reviewable?: boolean;
};

/** A search result is one of the things the review form can be opened on. */
export function poiFromPlace(place: PlaceResult): SelectedPoi {
  return {
    placeId: place.placeId,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export type PlaceSearchOutcome =
  | { ok: true; results: PlaceResult[] }
  | { ok: false; message: string };

/**
 * Text search for places, whether or not anyone has reviewed them.
 *
 * The only part of the app that knows where places come from. It goes through
 * an edge function rather than calling Google directly because a Places key
 * cannot safely ship inside the bundle - see supabase/functions/places-search.
 * Swapping providers, or moving back to a direct call once there is a key that
 * can be restricted properly, is a change to this function and nothing else.
 *
 * `origin` only biases the ordering. Search is for finding somewhere you are
 * not, so results are never bounded to the visible map.
 */
export async function searchPlaces(
  query: string,
  origin: Coords | null
): Promise<PlaceSearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { ok: true, results: [] };

  const { data, error } = await supabase.functions.invoke('places-search', {
    body: {
      query: trimmed,
      ...(origin ? { lat: origin.latitude, lng: origin.longitude } : {}),
    },
  });

  if (error) {
    // FunctionsHttpError means the function ran and refused: its body carries a
    // message written for a person, so prefer that over anything invented here.
    if (error.name === 'FunctionsHttpError') {
      const body = await error.context?.json?.().catch(() => null);
      return { ok: false, message: body?.error ?? 'Search is unavailable right now.' };
    }

    // Anything else is a transport failure, and on web the two causes are
    // genuinely indistinguishable: a missing function returns a 404 that
    // carries no CORS headers, so the browser blocks it and reports exactly
    // what it reports for being offline. The user gets the cause they can do
    // something about; the one only a developer can fix goes to the console.
    console.warn(
      'places-search could not be reached. If you are online, it may not be deployed: ' +
        'npx supabase functions deploy places-search'
    );
    return { ok: false, message: 'Could not reach search. Check your connection and try again.' };
  }

  if (data?.error) return { ok: false, message: data.error };

  return { ok: true, results: (data?.results ?? []) as PlaceResult[] };
}

export type PlaceLookupOutcome =
  | { ok: true; place: PlaceResult }
  | { ok: false; message: string };

/**
 * One place, by its Google place id.
 *
 * For the web map only. Android's onPoiClick hands back a tapped label's name
 * for free; the Maps JavaScript API's click event carries only an id, so the
 * name has to be fetched - which is why the web build could not open places
 * nobody had reviewed until there was a server to ask.
 */
export async function lookupPlace(placeId: string): Promise<PlaceLookupOutcome> {
  const { data, error } = await supabase.functions.invoke('place-details', {
    body: { placeId },
  });

  if (error) {
    if (error.name === 'FunctionsHttpError') {
      const body = await error.context?.json?.().catch(() => null);
      return { ok: false, message: body?.error ?? 'Could not open that place.' };
    }

    console.warn(
      'place-details could not be reached. If you are online, it may not be deployed: ' +
        'npx supabase functions deploy place-details'
    );
    return { ok: false, message: 'Could not reach the server. Check your connection.' };
  }

  if (data?.error) return { ok: false, message: data.error };
  if (!data?.place) return { ok: false, message: 'Could not open that place.' };

  return { ok: true, place: data.place as PlaceResult };
}
