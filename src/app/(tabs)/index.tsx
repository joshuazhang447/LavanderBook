import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import type { MapViewMode } from '@/components/map-controls';
import { MapControls, RecenterButton } from '@/components/map-controls';
import { ReviewSheet } from '@/components/review-sheet';
import { Text } from '@/components/ui/text';
import { VenueMap } from '@/components/venue-map';
import { VenueSheet } from '@/components/venue-sheet';
import {
  INITIAL_LATITUDE_DELTA,
  useCurrentLocation,
  useFollowPosition,
  VIEW_RADIUS_METERS,
} from '@/lib/use-location';
import type { MapRegion, NearbyVenue } from '@/lib/use-nearby-venues';
import { useNearbyVenues } from '@/lib/use-nearby-venues';
import type { SelectedPoi } from '@/lib/venues';

/**
 * How far the user must travel before venues are refetched while following.
 *
 * Following is deliberately NOT wired to the region-settled path: the camera
 * moves constantly while following, and refetching on every move would rebuild
 * the venue list, remounting every marker and replaying its fade. Distance
 * travelled severs that loop at the source.
 */
const FOLLOW_REFETCH_METERS = VIEW_RADIUS_METERS / 2;

/**
 * How long the refresh button spins after a press.
 *
 * Deliberately a fixed duration rather than the fetch's own loading flag: that
 * flag is true for every background refetch - panning, following, a realtime
 * event - which made the icon flicker on its own. This button reflects the
 * press and nothing else.
 */
const REFRESH_SPIN_MS = 900;

export default function MapScreen() {
  const [selected, setSelected] = React.useState<SelectedPoi | null>(null);
  // Set when a rating box is tapped, so the sheet edits that venue directly
  // rather than resolving it from a place id.
  // Tapping one of our rating boxes opens the read-only detail sheet; tapping a
  // Google place label still opens the review form.
  const [viewingVenue, setViewingVenue] = React.useState<NearbyVenue | null>(null);
  // Set when the review form is opened from a venue we already know, so the
  // sheet edits that venue rather than resolving it from a place id.
  const [selectedVenueId, setSelectedVenueId] = React.useState<string | undefined>(undefined);
  const [mode, setMode] = React.useState<MapViewMode>('map');
  const [following, setFollowing] = React.useState(true);
  const [region, setRegion] = React.useState<MapRegion | null>(null);
  const [savedCount, setSavedCount] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  // Boxes the user closed because they overlapped something. Session-only.
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  const location = useCurrentLocation();
  // No GPS at all in List view, or once the user has panned away.
  const { position: followPosition, anchor: followAnchor } = useFollowPosition(
    mode === 'map' && following,
    FOLLOW_REFETCH_METERS
  );

  // Stable identity, or React.memo on the marker would hold a stale closure.
  const dismissVenue = React.useCallback((venueId: string) => {
    setDismissed((previous) => new Set(previous).add(venueId));
  }, []);

  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    []
  );

  const refresh = React.useCallback(() => {
    setSavedCount((count) => count + 1);
    setRefreshing(true);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), REFRESH_SPIN_MS);
  }, []);

  // onRegionChangeComplete does not fire until the map is first moved, so seed
  // the region from the opening view or nothing loads until the user pans.
  const initialRegion = React.useMemo<MapRegion | null>(
    () =>
      location.status === 'granted'
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: INITIAL_LATITUDE_DELTA,
            longitudeDelta: INITIAL_LATITUDE_DELTA,
          }
        : null,
    [location]
  );

  const pannedRegion = region ?? initialRegion;

  const fetchRegion = React.useMemo<MapRegion | null>(() => {
    if (!following || !followAnchor || !pannedRegion) return pannedRegion;
    // Keep whatever zoom the user chose; only the centre follows them.
    return {
      latitude: followAnchor.latitude,
      longitude: followAnchor.longitude,
      latitudeDelta: pannedRegion.latitudeDelta,
      longitudeDelta: pannedRegion.longitudeDelta,
    };
  }, [following, followAnchor, pannedRegion]);

  const { venues: allVenues } = useNearbyVenues(fetchRegion, String(savedCount));
  const venues = React.useMemo(
    () => (dismissed.size === 0 ? allVenues : allVenues.filter((v) => !dismissed.has(v.id))),
    [allVenues, dismissed]
  );

  // The map reads its centre once, on mount, so wait for the position rather
  // than mounting somewhere arbitrary and jumping afterwards.
  if (location.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background">
        <ActivityIndicator />
        <Text className="text-sm text-muted-foreground">Finding you...</Text>
      </View>
    );
  }

  if (location.status !== 'granted') {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-background px-8">
        <Text className="text-lg font-semibold text-foreground">Location needed</Text>
        <Text className="text-center text-sm text-muted-foreground">
          {location.status === 'denied'
            ? 'LavenderBook shows venues around you, so it needs location access. Enable it in your settings and reopen this tab.'
            : location.message}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {mode === 'map' ? (
        <VenueMap
          center={location}
          venues={venues}
          followCenter={following ? followPosition : null}
          onSelectPoi={(poi) => {
            setSelectedVenueId(undefined);
            setSelected(poi);
          }}
          onSelectVenue={setViewingVenue}
          onDismiss={() => setSelected(null)}
          onDismissVenue={dismissVenue}
          onUserPannedTo={(next) => {
            // A pan is the user taking over; following would otherwise drag the
            // map back out from under them on the next fix.
            setFollowing(false);
            setRegion(next);
          }}
        />
      ) : (
        <View className="flex-1 items-center justify-center bg-muted">
          <Text className="text-lg font-medium text-muted-foreground">List View</Text>
        </View>
      )}

      <MapControls
        mode={mode}
        onChangeMode={setMode}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      {mode === 'map' ? (
        <RecenterButton following={following} onPress={() => setFollowing(true)} />
      ) : null}

      {viewingVenue ? (
        <VenueSheet
          venue={viewingVenue}
          onClose={() => setViewingVenue(null)}
          onWriteReview={() => {
            const venue = viewingVenue;
            setViewingVenue(null);
            setSelectedVenueId(venue.id);
            setSelected({
              placeId: venue.google_place_id ?? undefined,
              name: venue.name,
              latitude: venue.lat,
              longitude: venue.lng,
            });
          }}
        />
      ) : null}

      {selected ? (
        <ReviewSheet
          poi={selected}
          venueId={selectedVenueId}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            // Do not wait for a pan or a walk to see your own review.
            setSavedCount((count) => count + 1);
          }}
        />
      ) : null}
    </View>
  );
}
