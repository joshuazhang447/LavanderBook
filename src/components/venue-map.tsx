import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

import type { SelectedPoi } from '@/lib/venues';

// Placeholder until we ask for location permission and centre on the user.
const INITIAL_REGION = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type VenueMapProps = {
  onSelectPoi: (poi: SelectedPoi) => void;
};

/**
 * Shop and restaurant labels are drawn by the map itself, and tapping one is
 * answered from data the map already holds - neither costs a Places API call.
 *
 * No provider is forced: Android gets Google Maps, iOS gets Apple Maps. Apple
 * Maps has no place IDs, so `placeId` is undefined there.
 */
export function VenueMap({ onSelectPoi }: VenueMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={INITIAL_REGION}
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
