import * as React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { VenueMap } from '@/components/venue-map';
import type { SelectedPoi } from '@/lib/venues';

export default function MapScreen() {
  const [selected, setSelected] = React.useState<SelectedPoi | null>(null);

  return (
    <View className="flex-1 bg-background">
      <VenueMap onSelectPoi={setSelected} />

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
