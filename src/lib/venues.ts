/**
 * A point of interest the user tapped on the map.
 *
 * This comes from the map's own label data, not a Places API lookup, so it is
 * free. The fields line up deliberately with the `venues` table: `placeId` ->
 * google_place_id, `name` -> name, and the coordinates -> lat/lng.
 */
export type SelectedPoi = {
  /** Absent on Apple Maps, which has no Google place IDs. */
  placeId?: string;
  name: string;
  latitude: number;
  longitude: number;
};
