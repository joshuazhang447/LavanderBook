import type { Coords } from '@/lib/use-location';

/**
 * What the phone tells the server about where somebody is, and how coarsely.
 *
 * The exact position never leaves the device. It draws the blue dot and moves
 * the camera; anything sent anywhere goes through one of these first. Requests
 * that carry a position also go through `publicSupabase`, so the coarse place
 * they do carry is not tied to an account either.
 */

/** One degree of latitude is ~111,320m everywhere. */
const METERS_PER_DEGREE_LAT = 111320;

/**
 * The size of a grid square, in metres. A few city blocks: enough that the
 * server learns the neighbourhood the map is showing and not the doorway.
 */
export const GRID_METERS = 250;

/**
 * How much further a query must reach to cover everything a centred fetch
 * would have: the most the square's centre can sit from the real point, which
 * is half the square's diagonal.
 */
export const GRID_PADDING_METERS = (GRID_METERS * Math.SQRT2) / 2;

/**
 * The centre of the grid square a point falls in.
 *
 * Deterministic, so every point in a square sends the same centre - which is
 * also what lets a refetch be skipped until the square changes. Longitude steps
 * are scaled by the latitude of the square's row, not of the point, so a whole
 * row shares one step and the squares stay square-ish away from the equator.
 */
export function snapToGrid(point: Coords): Coords {
  const latStep = GRID_METERS / METERS_PER_DEGREE_LAT;
  const latitude = Math.round(point.latitude / latStep) * latStep;
  const lngStep =
    GRID_METERS / (METERS_PER_DEGREE_LAT * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  const longitude = Math.round(point.longitude / lngStep) * lngStep;
  return { latitude, longitude };
}

/**
 * Coarse enough for "near here" in a search ranking: one decimal place, about
 * 11km north-south. Search is for finding somewhere you are not, so the hint
 * only has to know which city you are in.
 */
export function roundForSearch(point: Coords): Coords {
  return {
    latitude: Math.round(point.latitude * 10) / 10,
    longitude: Math.round(point.longitude * 10) / 10,
  };
}
