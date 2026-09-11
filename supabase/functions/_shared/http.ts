/**
 * Shared by every function here.
 *
 * The leading underscore is what keeps it from being deployed as a function of
 * its own: the CLI treats `_`-prefixed directories under functions/ as support
 * code and bundles them into whichever functions import them.
 */

/** Browsers preflight the POST that supabase-js sends. */
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export function preflight(): Response {
  return new Response('ok', { headers: CORS });
}

/**
 * A place as the app wants it, whichever Places endpoint produced it.
 *
 * `placeId` is a real Google place id, which is what venues.google_place_id
 * dedupes on - so a place reached by search and the same place reached by
 * tapping its label resolve to one venue rather than two.
 */
export type PlaceResult = {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  /** False for cities, regions, streets - things with no door to walk through. */
  reviewable: boolean;
};

/**
 * Requested fields, and therefore the billing tier: Places (New) prices by the
 * most expensive field in the mask. These are what a result renders and what
 * `venues` stores - anything richer silently moves to a dearer SKU. `types` is
 * in the cheapest group, so it does not move the tier `displayName` already
 * sets.
 */
export const PLACE_FIELDS = 'id,displayName,location,formattedAddress,types';

/**
 * Administrative types: a city, a region, a road, a postcode.
 *
 * Deliberately a denylist rather than "must be tagged `establishment`". Both
 * rules classify Berlin correctly, but they fail in opposite directions when
 * something is missing - and something being missing is the normal case, not
 * the exotic one. An allowlist turns an absent `types` array into "nothing is
 * reviewable", which is the worse failure by far: it takes the whole app out
 * rather than letting one city through. Google also puts `political` on
 * essentially every administrative entity, so this catches more than it lists.
 */
const NEVER_REVIEWABLE = [
  'country',
  'continent',
  'administrative_area_level_',
  'locality',
  'sublocality',
  'neighborhood',
  'postal_code',
  'postal_town',
  'political',
  'archipelago',
  'colloquial_area',
  'route',
  'street_address',
  'intersection',
  'plus_code',
];

function isReviewable(types: string[]): boolean {
  return !types.some((type) => NEVER_REVIEWABLE.some((bad) => type.startsWith(bad)));
}

/** Shapes one Places (New) place into the above. Null when it is unusable. */
export function toPlaceResult(place: Record<string, unknown> | null): PlaceResult | null {
  if (!place) return null;

  const id = place.id as string | undefined;
  const location = place.location as { latitude: number; longitude: number } | undefined;
  // A place with no coordinates cannot be put on a map or stored as a venue.
  if (!id || !location) return null;

  const displayName = place.displayName as { text?: string } | undefined;
  const address = (place.formattedAddress as string | undefined) ?? null;
  const types = Array.isArray(place.types) ? (place.types as string[]) : [];

  return {
    placeId: id,
    name: displayName?.text ?? address ?? 'Unnamed place',
    address,
    latitude: location.latitude,
    longitude: location.longitude,
    reviewable: isReviewable(types),
  };
}
