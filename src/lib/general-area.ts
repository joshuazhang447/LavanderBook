import { getCalendars, getLocales } from 'expo-localization';

import countriesData from '@/data/geonames/countries.json';
import zonesData from '@/data/geonames/zones.json';
import type { Coords } from '@/lib/use-location';

/**
 * Where the map opens for someone not sharing their location, worked out from
 * the phone's own settings and nothing else.
 *
 * Read on the device, never sent anywhere, and never stored: worked out afresh
 * each time, so it moves when the phone's time zone does. Nothing here is a
 * security boundary - a phone can claim any time zone it likes - because all it
 * decides is where a map starts.
 *
 * Data: GeoNames, CC BY 4.0. See src/data/geonames/CREDITS.md.
 */

/** [city, country code, lat, lng] */
const ZONES = zonesData as unknown as Record<string, [string, string, number, number]>;
/** [country name, capital, lat, lng] */
const COUNTRIES = countriesData as unknown as Record<string, [string, string, number, number]>;

export type GeneralArea = Coords & {
  /** "Vancouver area". */
  label: string;
  /** "Canada". */
  country: string;
  /** "CA" - which country the city picker opens on. */
  countryCode: string;
  /** Which of the phone's settings it came from, for the words that explain it. */
  source: 'time-zone' | 'region';
};

/** A country's name from its ISO code, or the code itself if GeoNames lacks it. */
export function countryName(code: string): string {
  return COUNTRIES[code]?.[0] ?? code;
}

function timeZone(): string | null {
  try {
    return getCalendars()[0]?.timeZone ?? null;
  } catch {
    return null;
  }
}

function regionCode(): string | null {
  try {
    return getLocales().find((locale) => locale.regionCode)?.regionCode ?? null;
  } catch {
    return null;
  }
}

/**
 * The time zone's city first - America/Vancouver names Vancouver, and puts a
 * Vancouver phone in its own region rather than in the capital 3,500km away.
 * Failing that (UTC, or a zone with no city in the data), the capital of the
 * country the phone's region setting names. Failing both, null, and the caller
 * asks the person to pick a city.
 *
 * The region setting comes second because it is the weaker clue: plenty of
 * phones are set to en-US wherever they happen to be.
 */
export function resolveGeneralArea(): GeneralArea | null {
  const zone = timeZone();
  const fromZone = zone ? ZONES[zone] : undefined;
  if (fromZone) {
    const [city, code, latitude, longitude] = fromZone;
    return {
      label: `${city} area`,
      country: countryName(code),
      countryCode: code,
      latitude,
      longitude,
      source: 'time-zone',
    };
  }

  const code = regionCode()?.toUpperCase();
  const fromRegion = code ? COUNTRIES[code] : undefined;
  if (code && fromRegion) {
    const [country, capital, latitude, longitude] = fromRegion;
    return { label: `${capital} area`, country, countryCode: code, latitude, longitude, source: 'region' };
  }

  return null;
}
