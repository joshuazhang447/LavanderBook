import * as React from 'react';
import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';

import { SearchMarker } from '@/components/search-marker';
import { VenueCloseMarker, VenueMarker } from '@/components/venue-marker';
import type { PlaceResult } from '@/lib/place-search';
import type { Coords } from '@/lib/use-location';
import {
  distanceMeters,
  METERS_PER_DEGREE_LAT,
  regionAround,
  VIEW_RADIUS_METERS,
  ZOOM_IN_SLACK,
} from '@/lib/use-location';
import type { MapRegion, NearbyVenue } from '@/lib/use-nearby-venues';
import type { SelectedPoi } from '@/lib/venues';

/** Long enough to read as movement, short enough that follow steps do not queue. */
const FOLLOW_ANIMATION_MS = 400;
/**
 * A move that zooms as well - in from the whole country, say - travels much
 * further than a follow step, and at follow speed it reads as a cut.
 */
const ZOOM_ANIMATION_MS = 1000;
/**
 * Apple Maps fires onRegionChangeComplete several times per move, so the
 * programmatic flag clears on a trailing timer rather than the first callback -
 * clearing early would let our own animation look like a user pan.
 */
const SETTLE_MS = 250;
/** Smaller changes of span are latitude drift or rounding, not a zoom. */
const SPAN_CHANGE = 0.1;

/** The shorter side of what is on screen, in metres. */
function shortestSideMeters(region: MapRegion): number {
  return Math.min(
    region.latitudeDelta * METERS_PER_DEGREE_LAT,
    region.longitudeDelta * METERS_PER_DEGREE_LAT * Math.cos((region.latitude * Math.PI) / 180)
  );
}

type VenueMapProps = {
  center: Coords;
  /** How much ground to show around `center` when the map opens. */
  initialRadiusMeters?: number;
  /**
   * The blue dot. Only while following: someone who chose an area or a city
   * did not ask for their position to be on screen, even when the OS allows it.
   */
  showsUser: boolean;
  onSelectPoi: (poi: SelectedPoi) => void;
  /** Tapping bare map, away from any place label. */
  onDismiss: () => void;
  /** Reviewed venues nearby, drawn as rating boxes above their point. */
  venues: NearbyVenue[];
  onSelectVenue: (venue: NearbyVenue) => void;
  onDismissVenue: (venueId: string) => void;
  /** The place the user searched for, pinned until they clear the box. */
  searchResult: PlaceResult | null;
  onSelectSearchResult: (place: PlaceResult) => void;
  /** Where the camera should sit while following. Null pauses following. */
  followCenter: Coords | null;
  /**
   * Bumped to re-run the camera move even when followCenter is unchanged.
   * Without it, pressing recentre while already centred does nothing. A move
   * issued for a new token is an explicit one - Locate, a search result, the
   * locate button - and may zoom in; a GPS fix under the same token never does.
   */
  focusToken: number;
  /**
   * How much ground an explicit move shows at least, in metres: further out
   * than this (and ZOOM_IN_SLACK), it zooms in to it. It never zooms out.
   */
  focusRadiusMeters?: number;
  /** Fires only for a pan or zoom the user performed, never our own camera moves. */
  onUserPannedTo: (region: MapRegion) => void;
  /**
   * The visible span, whenever it changes by more than a little, whatever
   * changed it - a pinch, or a move zooming in. Neither need be a pan: a pinch
   * centred on the user while following never reaches onUserPannedTo.
   */
  onSpanChanged?: (region: MapRegion) => void;
  /**
   * How much of the map's bottom edge something floats over - Chenfeng's tab
   * bar. The map's own legal label and logo move up out from under it, as
   * they must stay visible. Zero or absent: nothing does.
   */
  bottomInset?: number;
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
  initialRadiusMeters = VIEW_RADIUS_METERS,
  showsUser,
  onSelectPoi,
  onDismiss,
  venues,
  onSelectVenue,
  onDismissVenue,
  searchResult,
  onSelectSearchResult,
  followCenter,
  focusToken,
  focusRadiusMeters = VIEW_RADIUS_METERS,
  onUserPannedTo,
  onSpanChanged,
  bottomInset = 0,
}: VenueMapProps) {
  const mapRef = React.useRef<MapView>(null);
  const [ready, setReady] = React.useState(false);
  const programmaticRef = React.useRef(false);
  const programmaticTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the camera was last driven to, for the distance backstop below.
  const followedRef = React.useRef<Coords | null>(null);
  // Kept current even for programmatic moves, so a follow-driven refetch can
  // reuse whatever zoom the user chose.
  const initialRegion = regionAround(center, initialRadiusMeters);
  const deltasRef = React.useRef({
    latitudeDelta: initialRegion.latitudeDelta,
    longitudeDelta: initialRegion.longitudeDelta,
  });

  // The span last handed to onSpanChanged.
  const reportedSpanRef = React.useRef({
    latitudeDelta: initialRegion.latitudeDelta,
    longitudeDelta: initialRegion.longitudeDelta,
  });
  // The token the last move was issued for; see focusToken.
  const issuedTokenRef = React.useRef(focusToken);
  // Until when a zooming move is still in flight. Follow steps wait it out: a
  // new camera move cancels the one in flight, and would strand the zoom half
  // way down.
  const zoomingUntilRef = React.useRef(0);

  React.useEffect(() => {
    // Waiting on onMapReady rather than firing at mount: a camera move issued
    // before the native view exists goes nowhere, with no error.
    if (!followCenter || !ready) return;

    // Only marked issued here, past the guard: a locate press before the first
    // fix arrives still zooms when that fix does.
    const explicit = focusToken !== issuedTokenRef.current;
    issuedTokenRef.current = focusToken;
    if (!explicit && Date.now() < zoomingUntilRef.current) return;

    const zoomIn =
      explicit &&
      shortestSideMeters({ ...followCenter, ...deltasRef.current }) >
        focusRadiusMeters * 2 * ZOOM_IN_SLACK;
    const duration = zoomIn ? ZOOM_ANIMATION_MS : FOLLOW_ANIMATION_MS;

    followedRef.current = followCenter;
    programmaticRef.current = true;
    if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    programmaticTimer.current = setTimeout(() => {
      programmaticRef.current = false;
    }, duration + SETTLE_MS);

    if (zoomIn) {
      zoomingUntilRef.current = Date.now() + duration;
      // A region, not a camera: the same framing the map opens on, and Apple
      // Maps ignores a camera's zoom.
      mapRef.current?.animateToRegion(regionAround(followCenter, focusRadiusMeters), duration);
      return;
    }

    // animateCamera, not animateToRegion: a Partial<Camera> of just the centre
    // preserves the user's zoom, where animateToRegion forces a span and on
    // Android fits to bounds, so the zoom drifts on every step.
    mapRef.current?.animateCamera({ center: followCenter }, { duration });
  }, [followCenter, focusToken, focusRadiusMeters, ready]);

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
      initialRegion={initialRegion}
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

        // Every cause, ahead of the guards below: what loads has to follow the
        // zoom even when it was ours, or a locate press from the whole country
        // would land on a street and load nothing.
        if (
          Math.abs(region.latitudeDelta / reportedSpanRef.current.latitudeDelta - 1) > SPAN_CHANGE
        ) {
          reportedSpanRef.current = deltasRef.current;
          onSpanChanged?.(region);
        }

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
      onMapReady={() => setReady(true)}
      // Lifts the legal label and logo clear of a tab bar floating over the
      // map: 10 above its top edge.
      mapPadding={bottomInset > 0 ? { top: 0, left: 0, right: 0, bottom: bottomInset + 10 } : undefined}
      showsUserLocation={showsUser}
      // Google's own chrome, hidden to match the web map. The my-location button
      // is deliberately off: react-native-maps registers no click listener for
      // it, so its taps cannot be hooked to resume following.
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      // Google routes POI taps to onPoiClick only, so this fires for bare map -
      // and for every marker. A marker's press is a bubbling event, so it
      // reaches the map's own onPress too, as 'marker-press'. Dismissing on it
      // closed the review form the search pin had just opened, in the same tick.
      onPress={(event) => {
        if (event.nativeEvent.action === 'marker-press') return;
        onDismiss();
      }}
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
      {/* Last, so it draws over the rating boxes when a searched place happens
          to sit among reviewed ones. Keyed by place: a new search remounts the
          pin rather than moving it, which replays the entrance and re-captures
          the marker bitmap on Android. */}
      {searchResult ? (
        <SearchMarker
          key={searchResult.placeId}
          place={searchResult}
          onPress={onSelectSearchResult}
        />
      ) : null}
    </MapView>
  );
}
