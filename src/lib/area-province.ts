import type { Coords } from '@/lib/use-location';

/**
 * Which province or territory a point is in, as the two-letter code the
 * directory's service areas use (20261114130000): an organisation that serves
 * all of Nova Scotia is listed to readers in Nova Scotia only.
 *
 * Worked out on the device, from the city list the city picker already ships
 * (GeoNames, src/data/geonames), by the nearest city. Nothing is looked up
 * anywhere: the point never leaves the device for this, and the code that is
 * sent is coarser than the rounded point the directory is already sent.
 *
 * Nearest city is a guess at a border - Ottawa and Gatineau face each other
 * across a river - but there the nearest city is the reader's own. The list
 * leaves out Prince Edward Island and the territories, so their towns are
 * added here. Further than MAX_METERS from any Canadian city is "not in
 * Canada", which the directory answers with no province-wide organisations.
 */

const PROVINCE_CODES: Record<string, string> = {
  Alberta: 'AB',
  'British Columbia': 'BC',
  Manitoba: 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Nova Scotia': 'NS',
  Ontario: 'ON',
  Quebec: 'QC',
  Saskatchewan: 'SK',
};

/** [latitude, longitude, code]: towns the GeoNames list is too coarse to carry. */
const EXTRA_TOWNS: readonly (readonly [number, number, string])[] = [
  [46.238, -63.131, 'PE'], // Charlottetown
  [46.393, -63.79, 'PE'], // Summerside
  [60.721, -135.057, 'YT'], // Whitehorse
  [64.06, -139.433, 'YT'], // Dawson City
  [62.454, -114.372, 'NT'], // Yellowknife
  [60.816, -115.799, 'NT'], // Hay River
  [68.36, -133.723, 'NT'], // Inuvik
  [63.749, -68.522, 'NU'], // Iqaluit
  [62.809, -92.085, 'NU'], // Rankin Inlet
  [69.117, -105.06, 'NU'], // Cambridge Bay
];

/** Beyond this from every Canadian town, the reader is taken to be abroad. */
const MAX_METERS = 400_000;

type Town = readonly [number, number, string];

let townsRequest: Promise<Town[]> | null = null;

function loadTowns(): Promise<Town[]> {
  townsRequest ??= import('@/data/geonames/cities.json')
    .then((module) => {
      // [name, province name, country, lat, lng]
      const rows = (module.default ?? module) as unknown as [string, string, string, number, number][];
      const towns: Town[] = [];
      for (const [, region, country, lat, lng] of rows) {
        const code = country === 'CA' ? PROVINCE_CODES[region] : undefined;
        if (code) towns.push([lat, lng, code]);
      }
      return [...towns, ...EXTRA_TOWNS];
    })
    .catch(() => {
      townsRequest = null;
      return [...EXTRA_TOWNS];
    });
  return townsRequest;
}

/** Great-circle metres, good enough to pick the nearest town. */
function metres(a: Coords, lat: number, lng: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat - a.latitude) * rad;
  const dLng = (lng - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The province or territory `point` is in, as a two-letter code, or '' for a
 * point outside Canada. Null only if the city list could not be read, in which
 * case the directory lists every province-wide organisation, as it used to.
 */
export async function provinceAt(point: Coords): Promise<string | null> {
  const towns = await loadTowns();
  if (towns.length === EXTRA_TOWNS.length) return null;

  let best: Town | null = null;
  let bestMetres = Infinity;
  for (const town of towns) {
    const m = metres(point, town[0], town[1]);
    if (m < bestMetres) {
      bestMetres = m;
      best = town;
    }
  }
  return best && bestMetres <= MAX_METERS ? best[2] : '';
}
