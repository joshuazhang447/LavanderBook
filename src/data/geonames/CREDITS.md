# Place data: GeoNames

The files in this folder are derived from [GeoNames](https://www.geonames.org/), which is
licensed under the
[Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/).

> Place data © GeoNames (geonames.org), CC BY 4.0.

## What was used

From the GeoNames export at <https://download.geonames.org/export/dump/>:

- `cities15000.txt` - cities with a population over 15,000
- `countryInfo.txt` - country names and capitals
- `admin1CodesASCII.txt` - names of provinces, states and regions

## What was changed

The data has been modified, as the licence asks us to say:

- `cities.json` keeps only cities with a population of 50,000 or more, and only their
  name, region, country code and coordinates, most populous first.
- `zones.json` keeps one city per time zone: the one the zone is named after, or failing
  that the most populous city in it.
- `countries.json` keeps each country's name and its capital.
- Coordinates are rounded to three decimal places, about 100 metres.

`scripts/build-geonames.mjs` produces all three files from the export; re-run it to refresh
them. The app shows the credit line above in the city picker, which is where this data is
visible to the people using it.
