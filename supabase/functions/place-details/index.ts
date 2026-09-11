import { CORS, json, PLACE_FIELDS, preflight, toPlaceResult } from '../_shared/http.ts';
import type { PlaceResult } from '../_shared/http.ts';

/**
 * One place, by id.
 *
 * This exists for the web map. Android's onPoiClick hands back a place's name
 * along with the tap, for free; the Maps JavaScript API's click event carries
 * only an id, so turning a tapped label into something reviewable costs a Place
 * Details call. That is why the web build used to refuse to open places nobody
 * had reviewed - not a policy, just the absence of anywhere safe to make the
 * call from. There is one now.
 *
 * Deploy:
 *   npx supabase functions deploy place-details
 *
 * Uses the same GOOGLE_PLACES_KEY secret as places-search.
 */

/**
 * A place's name and where it is essentially never change, and an id that
 * resolved once will resolve the same way tomorrow - so this caches far longer
 * than a search does. Still per-instance and still not durable: it exists to
 * make repeat taps on the same label free, not to be a source of truth.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; place: PlaceResult }>();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight();

  const key = Deno.env.get('GOOGLE_PLACES_KEY');
  if (!key) {
    console.error('GOOGLE_PLACES_KEY is not set on this project.');
    return json({ error: 'Place lookup is not configured.' }, 500);
  }

  let placeId: string;
  try {
    const body = await request.json();
    placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  // Guard before spending a call. Google's ids are opaque but bounded, and
  // anything outside this is someone poking at the endpoint.
  if (placeId.length === 0 || placeId.length > 500) {
    return json({ error: 'A place id is required.' }, 400);
  }

  const hit = cache.get(placeId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return json({ place: hit.place, cached: true });
  }

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': PLACE_FIELDS,
      },
    }
  );

  if (!response.ok) {
    // 404 is ordinary - an id can be retired - and is not the same failure as a
    // disabled API or an unpaid bill, which is why only the latter is shouted
    // about in the log.
    if (response.status === 404) {
      return json({ error: 'That place could not be found.' }, 404);
    }
    console.error('Places details failed', response.status, await response.text());
    return json({ error: 'Could not look that place up right now.' }, 502);
  }

  const place = toPlaceResult(await response.json());
  if (!place) {
    return json({ error: 'That place has no location to put on the map.' }, 422);
  }

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(placeId, { at: Date.now(), place });

  return json({ place });
});
