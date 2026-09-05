import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { SelectedPoi } from '@/lib/venues';

type VenueMapProps = {
  onSelectPoi: (poi: SelectedPoi) => void;
};

/**
 * react-native-maps is Android/iOS only - importing it on web breaks the build.
 * Metro picks this file for web, so the web bundle never touches it.
 *
 * Replacing this with a real map means the Maps JavaScript API, which needs a
 * billing account and an API key (10,000 loads/month free).
 */
export function VenueMap(_props: VenueMapProps) {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-muted px-6">
      <Text className="text-lg font-semibold text-foreground">Map is mobile only, for now</Text>
      <Text className="text-center text-sm text-muted-foreground">
        Open LavenderBook on your phone to browse the map. The web map is coming later.
      </Text>
    </View>
  );
}
