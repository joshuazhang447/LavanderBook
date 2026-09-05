import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { SelectedPoi } from '@/lib/venues';

// Placeholder until we ask for location permission and centre on the user.
const INITIAL_CENTER = { lat: 43.6532, lng: -79.3832 };

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;

type VenueMapProps = {
  onSelectPoi: (poi: SelectedPoi) => void;
};

/**
 * Web uses the Maps JavaScript API; native uses react-native-maps, which has no
 * web support. Metro picks this file for web, so the two never collide.
 *
 * POI taps are not wired up here yet. On native, onPoiClick hands back the
 * place name for free, but the JS API's click event carries only a placeId -
 * resolving it to a name needs a Places lookup, which is a billable call.
 */
export function VenueMap(_props: VenueMapProps) {
  if (!apiKey) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-muted px-6">
        <Text className="text-lg font-semibold text-foreground">Map key missing</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY in .env, then restart the dev server. Environment
          variables are inlined at build time, so a running server will not pick it up.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={INITIAL_CENTER}
          defaultZoom={15}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons
        />
      </APIProvider>
    </View>
  );
}
