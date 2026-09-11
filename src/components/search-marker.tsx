import * as React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { PlaceResult } from '@/lib/place-search';

const BOX_WIDTH = 200;
const BOX_HEIGHT = 40;
/** Clearance above the point, matching the rating boxes so the two never overlap. */
const LIFT = 35;
/** Long enough to read as an arrival, short enough not to delay the tap. */
const ENTER_MS = 180;

// Android takes `anchor` as a fraction of the marker view; iOS takes
// `centerOffset` in points. Both derive from LIFT so the platforms agree.
const ANCHOR = { x: 0.5, y: 1 + LIFT / BOX_HEIGHT };
const OFFSET = { x: 0, y: -(BOX_HEIGHT / 2 + LIFT) };

type SearchMarkerProps = {
  place: PlaceResult;
  onPress: (place: PlaceResult) => void;
};

/**
 * The place the user searched for, drawn where it is.
 *
 * Filled dark where the rating boxes are white, because it means something
 * different: a rating box is a place other people have been, this is the one
 * place you asked about. Tapping it opens the review form, which is the whole
 * point of putting it on the map rather than just moving the camera.
 */
function SearchMarkerImpl({ place, onPress }: SearchMarkerProps) {
  // On through the entrance animation, then off: Android rasterises a marker
  // view to a bitmap, and leaving tracking on re-rasterises it every frame.
  //
  // Mount-only. The parent keys this component by place id, so a new search
  // remounts it and tracking starts true again - without that remount the
  // second pin would keep the first one's bitmap.
  const [tracksViewChanges, setTracksViewChanges] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), ENTER_MS + 120);
    return () => clearTimeout(timer);
  }, []);

  const coordinate = React.useMemo(
    () => ({ latitude: place.latitude, longitude: place.longitude }),
    [place.latitude, place.longitude]
  );

  return (
    <Marker
      coordinate={coordinate}
      onPress={() => onPress(place)}
      tracksViewChanges={tracksViewChanges}
      // Above every rating box: this is what the user just asked to see.
      zIndex={1_000_000}
      {...Platform.select({
        android: { anchor: ANCHOR },
        ios: { centerOffset: OFFSET },
        default: {},
      })}>
      {/* Fixed pixel size via style, not className: NativeWind resolves classes
          on a later pass that can land after Android has taken its snapshot. */}
      <Animated.View entering={FadeIn.duration(ENTER_MS)} style={styles.box}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.hint} numberOfLines={1}>
          Tap to rate
        </Text>
      </Animated.View>
    </Marker>
  );
}

export const SearchMarker = React.memo(
  SearchMarkerImpl,
  (a, b) => a.place.placeId === b.place.placeId && a.onPress === b.onPress
);

// StyleSheet and literal colours rather than NativeWind tokens, for the same
// snapshot-timing reason as venue-marker.tsx. These are map chrome: they sit on
// Google's own light basemap in both themes, so they do not follow dark mode.
const styles = StyleSheet.create({
  box: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#171717',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  name: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    color: '#fafafa',
  },
  hint: {
    fontSize: 11,
    lineHeight: 14,
    color: '#a3a3a3',
  },
});
