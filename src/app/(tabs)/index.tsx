import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ReviewSheet } from '@/components/review-sheet';
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
      <VenueMap
        center={location}
        onSelectPoi={setSelected}
        onDismiss={() => setSelected(null)}
      />

      {selected ? (
        <ReviewSheet
          poi={selected}
          onClose={() => setSelected(null)}
          onSaved={() => setSelected(null)}
        />
      ) : null}

    </View>
  );
}
