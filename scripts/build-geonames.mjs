#!/usr/bin/env node
/**
 * Builds the app's place data from a GeoNames export.
 *
 *   node scripts/build-geonames.mjs <download-dir> [out-dir]
 *
 * <download-dir> must hold three files from https://download.geonames.org/export/dump/:
 *   cities15000.txt        (unzipped from cities15000.zip)
 *   countryInfo.txt
 *   admin1CodesASCII.txt
 *
 * Writes three JSON files to [out-dir] (default src/data/geonames):
 *
 *   zones.json      IANA time zone -> the city that stands for it, for "general area"
 *   countries.json  country code -> name and capital, the fallback when the zone says nothing
 *   cities.json     the city picker's list, most populous first
 *
 * The raw files are not committed; re-run this to refresh the data. GeoNames is
 * CC BY 4.0 - see src/data/geonames/CREDITS.md, which this does not touch.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** The picker's floor. Low enough for a college town, high enough to bundle. */
const PICKER_MIN_POPULATION = 50000;

/** Three decimals is ~100m: a city centre does not need more, and it keeps the files small. */
const round = (value) => Math.round(Number(value) * 1000) / 1000;

const [, , downloadDir, outDir = 'src/data/geonames'] = process.argv;
if (!downloadDir) {
  console.error('usage: node scripts/build-geonames.mjs <download-dir> [out-dir]');
  process.exit(1);
}

const lines = (file) =>
  readFileSync(join(downloadDir, file), 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'));

// geoname table: https://download.geonames.org/export/dump/readme.txt
const cities = lines('cities15000.txt').map((line) => {
  const f = line.split('\t');
  return {
    name: f[1],
    ascii: f[2],
    lat: round(f[4]),
    lng: round(f[5]),
    code: f[7],
    cc: f[8],
    admin1: f[10],
    population: Number(f[14]) || 0,
    zone: f[17],
  };
});
cities.sort((a, b) => b.population - a.population);

const admin1 = new Map(
  lines('admin1CodesASCII.txt').map((line) => {
    const [code, name] = line.split('\t');
    return [code, name];
  })
);

const countryInfo = lines('countryInfo.txt').map((line) => {
  const f = line.split('\t');
  return { cc: f[0], name: f[4], capital: f[5] };
});

// ---------------------------------------------------------------------------
// zones.json - the city a time zone is named for, or failing that its biggest
// ---------------------------------------------------------------------------

const zones = {};
const byZone = new Map();
for (const city of cities) {
  if (!city.zone) continue;
  if (!byZone.has(city.zone)) byZone.set(city.zone, []);
  byZone.get(city.zone).push(city);
}
for (const [zone, members] of byZone) {
  // "America/Argentina/Buenos_Aires" -> "buenos aires"
  const named = zone.split('/').pop().replace(/_/g, ' ').toLowerCase();
  const pick =
    members.find((city) => city.ascii.toLowerCase() === named) ??
    // Already sorted by population, so the first is the biggest.
    members[0];
  zones[zone] = [pick.name, pick.cc, pick.lat, pick.lng];
}

// ---------------------------------------------------------------------------
// countries.json - name and capital
// ---------------------------------------------------------------------------

const countries = {};
for (const country of countryInfo) {
  const inCountry = cities.filter((city) => city.cc === country.cc);
  const capital =
    // PPLC: "capital of a political entity" in GeoNames' feature codes.
    inCountry.find((city) => city.code === 'PPLC') ??
    inCountry.find((city) => city.name === country.capital || city.ascii === country.capital) ??
    inCountry[0];
  if (!capital) continue;
  countries[country.cc] = [country.name, capital.name, capital.lat, capital.lng];
}

// ---------------------------------------------------------------------------
// cities.json - [name, region, country code, lat, lng], most populous first
// ---------------------------------------------------------------------------

const picker = cities
  .filter((city) => city.population >= PICKER_MIN_POPULATION)
  .map((city) => [
    city.name,
    admin1.get(`${city.cc}.${city.admin1}`) ?? '',
    city.cc,
    city.lat,
    city.lng,
  ]);

mkdirSync(outDir, { recursive: true });
const write = (file, data) => {
  const text = JSON.stringify(data);
  writeFileSync(join(outDir, file), text);
  console.log(`${file}: ${Object.keys(data).length} entries, ${(text.length / 1024).toFixed(0)} KB`);
};
write('zones.json', zones);
write('countries.json', countries);
write('cities.json', picker);
