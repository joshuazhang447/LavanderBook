/**
 * Places text search, proxied.
 *
 * The key cannot live in the app. Every EXPO_PUBLIC_* variable is inlined into
 * the bundle at build time, so a client-side Places key is published - readable
 * in the web build's source and extractable from the APK - and a Places key is
 * a billable one. Restricting it does not rescue the idea either: an HTTP
 * referrer restriction blocks native (no referrer to send) and an Android app
 * restriction blocks plain fetch (the package/cert headers are added by the
 * Maps SDK, not by fetch). There is no restriction setting under which one
 * client-side key serves both platforms safely.
 *
 * So the key stays here, in a secret, and both platforms call this instead.
 *
 * Deploy:
 *   npx supabase secrets set GOOGLE_PLACES_KEY=...
 *   npx supabase functions deploy places-search
 */

import { json, PLACE_FIELDS, preflight, toPlaceResult } from '../_shared/http.ts';
import type { PlaceResult } from '../_shared/http.ts';

/** Enough to choose from, few enough to read. Each result is billed the same. */
const MAX_RESULTS = 5;

/** Text Search prefixes each field with `places.`; the fields themselves are shared. */
const FIELD_MASK = PLACE_FIELDS.split(',')
  .map((field) => `places.${field}`)
  .join(',');

/**
 * Bias, not restriction: searching is mostly for somewhere you are not, so a
 * hard bound would hide the right answer. This only breaks ties, which is what
 * makes a nearby "Starbucks" beat one in another country.
 */
const BIAS_RADIUS_METERS = 50000;

/**
 * Repeat searches inside one instance's lifetime, free.
 *
 * Deliberately in memory and deliberately small. Edge instances are short-lived
 * and there may be several, so this is a cheap win on the common pattern -
 * submitting the same query twice, or coming back to it in the same session -
 * and explicitly not a durable cache. If searches ever need to be cached across
 * instances that is a Postgres table, not a bigger Map.
 */
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; results: PlaceResult[] }>();

function cacheKey(query: string, lat: number | null, lng: number | null): string {
  // Coordinates rounded to ~1km: a bias that has barely moved returns the same
  // ordering, and keying on raw floats would make every cache entry a miss.
  const at = lat === null || lng === null ? 'none' : `${lat.toFixed(2)},${lng.toFixed(2)}`;
  return `${query.toLowerCase()}|${at}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return preflight();

  const key = Deno.env.get('GOOGLE_PLACES_KEY');
  if (!key) {
    // A configuration fault, not the caller's - and worth saying plainly,
    // because the symptom at the other end is just an empty result list.
    console.error('GOOGLE_PLACES_KEY is not set on this project.');
    return json({ error: 'Search is not configured.' }, 500);
  }

  let query: string;
  let lat: number | null = null;
  let lng: number | null = null;

  try {
    const body = await request.json();
    query = typeof body.query === 'string' ? body.query.trim() : '';
    if (typeof body.lat === 'number' && typeof body.lng === 'number') {
      lat = body.lat;
      lng = body.lng;
    }
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  // Guard before spending a call. An empty query is a client bug; a very long
  // one is someone poking at the endpoint.
  if (query.length === 0) return json({ results: [] });
  if (query.length > 200) return json({ error: 'Query too long.' }, 400);

  const hit = cache.get(cacheKey(query, lat, lng));
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return json({ results: hit.results, cached: true });
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: MAX_RESULTS,
      ...(lat !== null && lng !== null
        ? {
            locationBias: {
              circle: {
                center: { latitude: lat, longitude: lng },
                radius: BIAS_RADIUS_METERS,
              },
            },
          }
        : {}),
    }),
  });

  if (!response.ok) {
    // Logged in full because this is where a disabled API, a wrong key or an
    // unpaid bill shows up, and none of that should reach the user verbatim.
    console.error('Places searchText failed', response.status, await response.text());
    return json({ error: 'Search is unavailable right now.' }, 502);
  }

  const data = await response.json();

  // toPlaceResult drops anything without coordinates, which cannot be put on a
  // map or stored as a venue, rather than rendering a row that does nothing.
  const results: PlaceResult[] = (data.places ?? [])
    .map(toPlaceResult)
    .filter((place: PlaceResult | null): place is PlaceResult => place !== null);

  // Evict oldest-first once full. Insertion order is Map's iteration order, so
  // the first key is the least recently added.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey(query, lat, lng), { at: Date.now(), results });

  return json({ results });
});
