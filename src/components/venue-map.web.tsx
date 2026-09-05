import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { VIEW_RADIUS_METERS } from '@/lib/use-location';
import type { SelectedPoi } from '@/lib/venues';

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;

/** Ground resolution at zoom 0 on the equator, in metres per pixel. */
const EQUATOR_METERS_PER_PIXEL = 156543.03392;

/**
 * Native takes a region in degrees; the JS API takes a zoom level. Derive the
 * zoom that puts `radiusMeters` between the centre and the nearest screen edge,
 * so both platforms frame the same amount of ground.
 */
function zoomForRadius(latitude: number, radiusMeters: number): number {
  const shortestEdge = Math.max(Math.min(window.innerWidth, window.innerHeight), 320);
  const metersPerPixel = radiusMeters / (shortestEdge / 2);
  const zoom = Math.log2(
    (EQUATOR_METERS_PER_PIXEL * Math.cos((latitude * Math.PI) / 180)) / metersPerPixel
  );
  return Math.min(Math.max(zoom, 3), 20);
}

type VenueMapProps = {
  center: { latitude: number; longitude: number };
  onSelectPoi: (poi: SelectedPoi) => void;
  onDismiss: () => void;
};

/**
 * Web uses the Maps JavaScript API; native uses react-native-maps, which has no
 * web support. Metro picks this file for web, so the two never collide.
 *
 * POI taps are not wired up here yet. On native, onPoiClick hands back the
 * place name for free, but the JS API's click event carries only a placeId -
 * resolving it to a name needs a Places lookup, which is a billable call.
 */
export function VenueMap({ center, onDismiss }: VenueMapProps) {
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
          defaultCenter={{ lat: center.latitude, lng: center.longitude }}
          defaultZoom={zoomForRadius(center.latitude, VIEW_RADIUS_METERS)}
          gestureHandling="greedy"
          clickableIcons
          onClick={onDismiss}
          // Strip Google's default chrome - this is our UI, not theirs.
          mapTypeControl={false}
          fullscreenControl={false}
          streetViewControl={false}
          cameraControl={false}
          rotateControl={false}
          zoomControl={false}
        />
      </APIProvider>
    </View>
  );
}
