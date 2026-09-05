import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

import { VenueCloseMarker, VenueMarker } from '@/components/venue-marker';
import type { MapRegion, NearbyVenue } from '@/lib/use-nearby-venues';
import type { SelectedPoi } from '@/lib/venues';
import { INITIAL_LATITUDE_DELTA } from '@/lib/use-location';

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
        latitudeDelta: INITIAL_LATITUDE_DELTA,
        longitudeDelta: INITIAL_LATITUDE_DELTA,
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
      {/*
        Two flat lists rather than one component rendering both markers: MapView
        tracks its own children, and a Fragment holding a pair left the close
        marker on screen after the pair unmounted. Distinct keys also give React
        an unambiguous identity for each native marker.
      */}
      {venues.map((venue) => (
        <VenueMarker key={`${venue.id}-box`} venue={venue} onPress={onSelectVenue} />
      ))}
      {venues.map((venue) => (
        <VenueCloseMarker key={`${venue.id}-close`} venue={venue} onDismiss={onDismissVenue} />
      ))}
    </MapView>
  );
}
