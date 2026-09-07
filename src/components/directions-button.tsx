import { ExternalLink } from 'lucide-react-native';
import { Linking, Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';

type DirectionsButtonProps = {
  name: string;
  latitude: number;
  longitude: number;
  /** Absent on Apple Maps, which has no Google place IDs. */
  placeId?: string | null;
};

/**
 * Opens directions to a venue in Google Maps.
 *
 * This uses the Maps URLs scheme, which is free and needs no API key - none of
 * the billable Places endpoints are involved. On a phone the Google Maps app
 * claims the link; on web it opens in a new tab.
 */
export function DirectionsButton({ name, latitude, longitude, placeId }: DirectionsButtonProps) {
  return (
    <Pressable
      onPress={() => {
        const url =
          'https://www.google.com/maps/dir/?api=1' +
          `&destination=${latitude},${longitude}` +
          // Coordinates alone can land on the wrong side of a building, so pin
          // the destination to the listing itself where we know it. The place id
          // is only valid alongside destination, never in place of it.
          (placeId ? `&destination_place_id=${encodeURIComponent(placeId)}` : '');

        // Nothing useful to do if the app or browser refuses the link, and an
        // unhandled rejection would show up as a dev red-box.
        Linking.openURL(url).catch(() => {});
      }}
      accessibilityRole="button"
      accessibilityLabel={`Directions to ${name} in Google Maps`}
      className="rounded-full p-2 active:bg-accent">
      <Icon as={ExternalLink} className="size-5 text-muted-foreground" />
    </Pressable>
  );
}
