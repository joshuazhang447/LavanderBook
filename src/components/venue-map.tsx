import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

import { VenueMarker } from '@/components/venue-marker';
import type { MapRegion, NearbyVenue } from '@/lib/use-nearby-venues';
import type { SelectedPoi } from '@/lib/venues';
import { VIEW_RADIUS_METERS } from '@/lib/use-location';

// One degree of latitude is ~111,320m everywhere, so a delta covering twice the
// radius puts the user in the middle of roughly VIEW_RADIUS_METERS of ground.
const LATITUDE_DELTA = (VIEW_RADIUS_METERS * 2) / 111320;

type VenueMapProps = {
  center: { latitude: number; longitude: number };
  onSelectPoi: (poi: SelectedPoi) => void;
  /** Tapping bare map, away from any place label. */
  onDismiss: () => void;
  /** Reviewed venues nearby, drawn as rating boxes above their point. */
  venues: NearbyVenue[];
  onSelectVenue: (venue: NearbyVenue) => void;
  onDismissVenue: (venueId: string) => void;
  /** Fires once panning or zooming settles, so venues can be fetched for it. */
  onRegionSettled: (region: MapRegion) => void;
};

/**
 * Shop and restaurant labels are drawn by the map itself, and tapping one is
 * answered from data the map already holds - neither costs a Places API call.
 *
 * No provider is forced: Android gets Google Maps, iOS gets Apple Maps. Apple
 * Maps has no place IDs, so `placeId` is undefined there.
 */
export function VenueMap({
  center,
  onSelectPoi,
  onDismiss,
  venues,
  onSelectVenue,
  onDismissVenue,
  onRegionSettled,
}: VenueMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LATITUDE_DELTA,
      }}
      // Complete, not onRegionChange: the latter fires continuously through the
      // whole gesture and would fire a query per frame.
      onRegionChangeComplete={onRegionSettled}
      showsUserLocation
      // Google's own chrome, hidden to match the web map.
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      // Google routes POI taps to onPoiClick only, so this fires just for bare map.
      onPress={onDismiss}
      onPoiClick={(event) => {
        const { placeId, name, coordinate } = event.nativeEvent;
        onSelectPoi({
          placeId,
          name,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      }}>
      {venues.map((venue) => (
        <VenueMarker
          key={venue.id}
          venue={venue}
          onPress={onSelectVenue}
          onDismiss={onDismissVenue}
        />
      ))}
    </MapView>
  );
}
