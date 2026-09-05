import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ReviewSheet } from '@/components/review-sheet';
import { Text } from '@/components/ui/text';
import { VenueMap } from '@/components/venue-map';
import type { MapRegion } from '@/lib/use-nearby-venues';
import { useNearbyVenues } from '@/lib/use-nearby-venues';
import { useCurrentLocation, useWalkingAnchor } from '@/lib/use-location';
import type { SelectedPoi } from '@/lib/venues';

export default function MapScreen() {
  const [selected, setSelected] = React.useState<SelectedPoi | null>(null);
  // Set when a rating box is tapped, so the sheet edits that venue directly
  // rather than resolving it from a place id.
  const [selectedVenueId, setSelectedVenueId] = React.useState<string | undefined>(undefined);
  const location = useCurrentLocation();
  // Separate from `location`: this one updates as you walk, and must not reach
  // the map's centre or the map would drag itself back under you. It only
  // nudges a refetch, so venues appear as you walk without panning.
  const anchor = useWalkingAnchor();
  const [region, setRegion] = React.useState<MapRegion | null>(null);
  const [savedCount, setSavedCount] = React.useState(0);
  // Boxes the user closed because they overlapped something. Session-only, and
  // cleared whenever the venue list itself changes.
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  // Stable identity, or React.memo on the marker would hold a stale closure.
  const dismissVenue = React.useCallback((venueId: string) => {
    setDismissed((previous) => new Set(previous).add(venueId));
  }, []);
  // Derived rather than an effect that bumps a counter: walking to a new anchor
  // and saving a review are both just reasons to refetch.
  const allVenues = useNearbyVenues(
    region,
    `${savedCount}:${anchor ? `${anchor.latitude},${anchor.longitude}` : ''}`
  );
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
      <VenueMap
        center={location}
        venues={venues}
        onSelectPoi={(poi) => {
          setSelectedVenueId(undefined);
          setSelected(poi);
        }}
        onSelectVenue={(venue) => {
          setSelectedVenueId(venue.id);
          setSelected({
            placeId: venue.google_place_id ?? undefined,
            name: venue.name,
            latitude: venue.lat,
            longitude: venue.lng,
          });
        }}
        onDismiss={() => setSelected(null)}
        onDismissVenue={dismissVenue}
        onRegionSettled={setRegion}
      />

      {selected ? (
        <ReviewSheet
          poi={selected}
          venueId={selectedVenueId}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            // Do not wait for a pan or a 50m walk to see your own review.
            setSavedCount((count) => count + 1);
          }}
        />
      ) : null}

    </View>
  );
}
