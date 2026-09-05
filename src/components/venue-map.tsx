import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

import type { SelectedPoi } from '@/lib/venues';
import { VIEW_RADIUS_METERS } from '@/lib/use-location';

// One degree of latitude is ~111,320m everywhere, so a delta covering twice the
// radius puts the user in the middle of roughly VIEW_RADIUS_METERS of ground.
const LATITUDE_DELTA = (VIEW_RADIUS_METERS * 2) / 111320;

type VenueMapProps = {
  center: { latitude: number; longitude: number };
  onSelectPoi: (poi: SelectedPoi) => void;
};

/**
 * Shop and restaurant labels are drawn by the map itself, and tapping one is
 * answered from data the map already holds - neither costs a Places API call.
 *
 * No provider is forced: Android gets Google Maps, iOS gets Apple Maps. Apple
 * Maps has no place IDs, so `placeId` is undefined there.
 */
export function VenueMap({ center, onSelectPoi }: VenueMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LATITUDE_DELTA,
      }}
      showsUserLocation
      // Google's own chrome, hidden to match the web map.
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      onPoiClick={(event) => {
        const { placeId, name, coordinate } = event.nativeEvent;
        onSelectPoi({
          placeId,
          name,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      }}
    />
  );
}
