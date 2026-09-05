import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { VenueMap } from '@/components/venue-map';
import { useCurrentLocation } from '@/lib/use-location';
import type { SelectedPoi } from '@/lib/venues';

export default function MapScreen() {
  const [selected, setSelected] = React.useState<SelectedPoi | null>(null);
  const location = useCurrentLocation();

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
      <VenueMap center={location} onSelectPoi={setSelected} />

      {selected ? (
        <View className="absolute inset-x-0 bottom-0 gap-1 border-t border-border bg-background p-4">
          <Text className="text-lg font-semibold text-foreground">{selected.name}</Text>
          <Text className="text-xs text-muted-foreground">
            {selected.placeId ? `Place ID: ${selected.placeId}` : 'No place ID (Apple Maps)'}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
