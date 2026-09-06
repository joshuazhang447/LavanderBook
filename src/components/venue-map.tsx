import * as React from 'react';
import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

import { VenueCloseMarker, VenueMarker } from '@/components/venue-marker';
import type { Coords } from '@/lib/use-location';
import { distanceMeters, INITIAL_LATITUDE_DELTA } from '@/lib/use-location';
import type { MapRegion, NearbyVenue } from '@/lib/use-nearby-venues';
import type { SelectedPoi } from '@/lib/venues';

/** Long enough to read as movement, short enough that follow steps do not queue. */
const FOLLOW_ANIMATION_MS = 400;
/**
 * Apple Maps fires onRegionChangeComplete several times per move, so the
 * programmatic flag clears on a trailing timer rather than the first callback -
 * clearing early would let our own animation look like a user pan.
 */
const PROGRAMMATIC_SETTLE_MS = FOLLOW_ANIMATION_MS + 250;

type VenueMapProps = {
  center: Coords;
  onSelectPoi: (poi: SelectedPoi) => void;
  /** Tapping bare map, away from any place label. */
  onDismiss: () => void;
  /** Reviewed venues nearby, drawn as rating boxes above their point. */
  venues: NearbyVenue[];
  onSelectVenue: (venue: NearbyVenue) => void;
  onDismissVenue: (venueId: string) => void;
  /** Where the camera should sit while following. Null pauses following. */
  followCenter: Coords | null;
  /**
   * Bumped to re-run the camera move even when followCenter is unchanged.
   * Without it, pressing recentre while already centred does nothing.
   */
  focusToken: number;
  /** Fires only for a pan or zoom the user performed, never our own camera moves. */
  onUserPannedTo: (region: MapRegion) => void;
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
  followCenter,
  focusToken,
  onUserPannedTo,
}: VenueMapProps) {
  const mapRef = React.useRef<MapView>(null);
  const programmaticRef = React.useRef(false);
  const programmaticTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the camera was last driven to, for the distance backstop below.
  const followedRef = React.useRef<Coords | null>(null);
  // Kept current even for programmatic moves, so a follow-driven refetch can
  // reuse whatever zoom the user chose.
  const deltasRef = React.useRef({
    latitudeDelta: INITIAL_LATITUDE_DELTA,
    longitudeDelta: INITIAL_LATITUDE_DELTA,
  });

  React.useEffect(() => {
    if (!followCenter) return;

    followedRef.current = followCenter;
    programmaticRef.current = true;
    if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    programmaticTimer.current = setTimeout(() => {
      programmaticRef.current = false;
    }, PROGRAMMATIC_SETTLE_MS);

    // animateCamera, not animateToRegion: a Partial<Camera> of just the centre
    // preserves the user's zoom, where animateToRegion forces a span and on
    // Android fits to bounds, so the zoom drifts on every step.
    mapRef.current?.animateCamera({ center: followCenter }, { duration: FOLLOW_ANIMATION_MS });
  }, [followCenter, focusToken]);

  React.useEffect(
    () => () => {
      if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    },
    []
  );

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: INITIAL_LATITUDE_DELTA,
        longitudeDelta: INITIAL_LATITUDE_DELTA,
      }}
      // Complete, not onRegionChange: the latter fires continuously through the
      // whole gesture and would fire a query per frame.
      //
      // animateCamera fires this exactly like a user pan does, so a naive
      // "region changed, stop following" check would switch itself off on its
      // own first animation. Three guards, cheapest first.
      onRegionChangeComplete={(region, details) => {
        deltasRef.current = {
          latitudeDelta: region.latitudeDelta,
          longitudeDelta: region.longitudeDelta,
        };

        // 1. Exact, but Google-only: Apple sends no isGesture at all.
        if (details?.isGesture === false) return;
        // 2. Covers Apple, where isGesture is undefined.
        if (programmaticRef.current) return;
        // 3. Backstop: a follow move lands on the user by definition, so a
        //    centre still sitting on them was not a pan.
        const followed = followedRef.current;
        if (
          followed &&
          distanceMeters(followed, region) < region.latitudeDelta * 111320 * 0.15
        ) {
          return;
        }

        onUserPannedTo(region);
      }}
      showsUserLocation
      // Google's own chrome, hidden to match the web map. The my-location button
      // is deliberately off: react-native-maps registers no click listener for
      // it, so its taps cannot be hooked to resume following.
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
