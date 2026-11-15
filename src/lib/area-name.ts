import * as React from 'react';

import { countryName } from '@/lib/general-area';
import { distanceMeters, type Coords } from '@/lib/use-location';

/**
 * What to call the place a list of places is around, when that is not the
 * reader: "Toronto, Ontario".
 *
 * The map's list follows the middle of the map once it is panned, so the city
 * chosen on this device stops being where the list is. Naming the chosen city
 * there - "187 places near Windsor" over a list of Toronto churches - is
 * simply wrong. So the list is named after the city nearest its middle,
 * from the GeoNames list the city picker already ships: worked out on the
 * device, and nothing is sent anywhere for it.
 */

/** [name, region, country, latitude, longitude], most populous first. */
type City = readonly [string, string, string, number, number];

let citiesRequest: Promise<readonly City[]> | null = null;

function loadCities(): Promise<readonly City[]> {
  citiesRequest ??= import('@/data/geonames/cities.json')
    .then((module) => (module.default ?? module) as unknown as City[])
    .catch(() => {
      citiesRequest = null;
      return [];
    });
  return citiesRequest;
}

/**
 * Within this of the chosen place, the list is still about it, and keeps the
 * words it was chosen with ("Ottawa area" stays "Ottawa area" rather than
 * becoming whichever suburb is a little nearer the middle of the map).
 */
const CHOSEN_PLACE_METERS = 10_000;

/** Further than this from every city, the middle of the map has no name. */
const NAMED_WITHIN_METERS = 40_000;

/** The nearest city to `point`, as "Name, Region", or null if none is close. */
function nearestCityLabel(cities: readonly City[], point: Coords): string | null {
  let best: City | null = null;
  let bestMeters = Infinity;
  for (const city of cities) {
    // A cheap box first: a degree of latitude is about 111 km.
    if (Math.abs(city[3] - point.latitude) > 0.5) continue;
    const meters = distanceMeters(point, { latitude: city[3], longitude: city[4] });
    if (meters < bestMeters) {
      bestMeters = meters;
      best = city;
    }
  }
  if (!best || bestMeters > NAMED_WITHIN_METERS) return null;
  // The same words the city picker saves a city with (map-location.ts).
  return `${best[0]}, ${best[1] || countryName(best[2])}`;
}

export type ListPlaceName =
  /** Around the reader themselves, and the city they are in if one is near. */
  | { kind: 'you'; city: string | null }
  /** Around a city, by name. */
  | { kind: 'named'; label: string }
  /** Around the middle of the map, somewhere no city is near. */
  | { kind: 'map' };

/**
 * What a list of places is around: the reader while the map follows them (and
 * which city that is); the place chosen on this device while the list is
 * still there; else the city nearest the list's middle.
 */
export function useListPlaceName(
  origin: Coords | null,
  following: boolean,
  chosen: (Coords & { label: string }) | null
): ListPlaceName {
  const atChosen =
    !following &&
    origin !== null &&
    chosen !== null &&
    distanceMeters(origin, chosen) <= CHOSEN_PLACE_METERS;

  const latitude = origin?.latitude ?? null;
  const longitude = origin?.longitude ?? null;
  const needsName = !atChosen && latitude !== null && longitude !== null;

  const [named, setNamed] = React.useState<{ key: string; label: string | null } | null>(null);
  const key = needsName ? `${latitude},${longitude}` : null;

  React.useEffect(() => {
    if (key === null || latitude === null || longitude === null) return;
    let active = true;
    loadCities().then((cities) => {
      if (active) setNamed({ key, label: nearestCityLabel(cities, { latitude, longitude }) });
    });
    return () => {
      active = false;
    };
  }, [key, latitude, longitude]);

  if (atChosen && chosen) return { kind: 'named', label: chosen.label };
  // Still working it out: the last name found, which is right for any pan
  // within a city, rather than a flash of "the middle of the map".
  const label = named?.key === key ? named.label : (named?.label ?? null);
  if (following) return { kind: 'you', city: label };
  return label ? { kind: 'named', label } : { kind: 'map' };
}
