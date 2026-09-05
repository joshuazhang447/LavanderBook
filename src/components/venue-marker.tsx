import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { NearbyVenue } from '@/lib/use-nearby-venues';

const BOX_WIDTH = 168;
const BOX_HEIGHT = 44;
const SNIPPET_CHARS = 40;
/** Clearance above the point, so the box does not sit on Google's own label. */
const LIFT = 35;
const CLOSE_SIZE = 26;

// Android takes `anchor` as a fraction of the marker view; iOS takes
// `centerOffset` in points from the view's centre. Both are derived from the
// same LIFT so the platforms agree.
const BOX_ANCHOR = { x: 0.5, y: 1 + LIFT / BOX_HEIGHT };
const BOX_OFFSET = { x: 0, y: -(BOX_HEIGHT / 2 + LIFT) };

// The close button is a separate marker: a marker view is rasterised to a
// bitmap on Android, so a nested Pressable inside the box would never receive
// its own tap. Positioned on the box's top-right corner.
const CLOSE_ANCHOR = {
  x: (CLOSE_SIZE / 2 - BOX_WIDTH / 2) / CLOSE_SIZE,
  y: (CLOSE_SIZE / 2 + BOX_HEIGHT + LIFT) / CLOSE_SIZE,
};
const CLOSE_OFFSET = { x: BOX_WIDTH / 2, y: -(BOX_HEIGHT + LIFT) };

/**
 * Star glyphs rather than the Lucide icons used elsewhere in the app.
 *
 * Android rasterises a custom marker view to a bitmap once, on a one-shot
 * counter, and react-native-svg renders asynchronously relative to layout - so
 * SVG children are the most common cause of markers capturing blank. Text is
 * measured synchronously and always makes the snapshot.
 */
function starGlyphs(average: number): string {
  const rounded = Math.round(average * 2) / 2;
  const full = Math.floor(rounded);
  return '★'.repeat(full) + (rounded - full === 0.5 ? '½' : '');
}

function summarise(venue: NearbyVenue): string {
  const body = venue.latest_review_body?.trim();
  if (body) {
    return body.length > SNIPPET_CHARS ? `${body.slice(0, SNIPPET_CHARS).trimEnd()}...` : body;
  }
  return venue.review_count === 1 ? '1 review' : `${venue.review_count} reviews`;
}

type VenueMarkerProps = {
  venue: NearbyVenue;
  onPress: (venue: NearbyVenue) => void;
  onDismiss: (venueId: string) => void;
};

function VenueMarkerImpl({ venue, onPress, onDismiss }: VenueMarkerProps) {
  // Starts true so the view is captured once content has settled, then off:
  // leaving it on re-rasterises every marker every frame.
  const [tracksViewChanges, setTracksViewChanges] = React.useState(true);

  const markerRef = React.useRef<React.ComponentRef<typeof Marker>>(null);

  const coordinate = React.useMemo(
    () => ({ latitude: venue.lat, longitude: venue.lng }),
    [venue.lat, venue.lng]
  );

  // Re-capture when the content changes, or Android keeps showing the stale
  // bitmap. redraw() is the documented way to do this and is cheaper than
  // switching tracking back on for a frame.
  React.useEffect(() => {
    markerRef.current?.redraw();
  }, [venue.avg_stars, venue.review_count, venue.latest_review_body]);

  const zIndex = Math.round(-venue.lat * 1000);

  return (
    <>
      <Marker
        ref={markerRef}
        coordinate={coordinate}
        onPress={() => onPress(venue)}
        tracksViewChanges={tracksViewChanges}
        // Southern markers draw over northern ones, the usual map-label look.
        zIndex={zIndex}
        // anchor is Google-only and centerOffset Apple-only, and this map sets no
        // provider - so Android gets Google Maps and iOS gets Apple Maps.
        {...Platform.select({
          android: { anchor: BOX_ANCHOR },
          ios: { centerOffset: BOX_OFFSET },
          default: {},
        })}>
        {/*
          Fixed pixel size via style, not className: NativeWind resolves classes on
          a later pass that can land after Android has taken its snapshot.
        */}
        <View style={styles.box} onLayout={() => setTracksViewChanges(false)}>
          <Text style={styles.stars} numberOfLines={1}>
            {starGlyphs(Number(venue.avg_stars ?? 0))}{' '}
            <Text style={styles.average}>{Number(venue.avg_stars ?? 0).toFixed(1)}</Text>
          </Text>
          <Text style={styles.snippet} numberOfLines={1}>
            {summarise(venue)}
          </Text>
        </View>
      </Marker>

      <Marker
        coordinate={coordinate}
        onPress={() => onDismiss(venue.id)}
        tracksViewChanges={tracksViewChanges}
        zIndex={zIndex + 1}
        {...Platform.select({
          android: { anchor: CLOSE_ANCHOR },
          ios: { centerOffset: CLOSE_OFFSET },
          default: {},
        })}>
        <View style={styles.close}>
          <Text style={styles.closeGlyph}>x</Text>
        </View>
      </Marker>
    </>
  );
}

// Markers are the expensive unit to re-render; only redraw when what they show changes.
export const VenueMarker = React.memo(
  VenueMarkerImpl,
  (a, b) =>
    a.venue.id === b.venue.id &&
    a.onDismiss === b.onDismiss &&
    a.venue.avg_stars === b.venue.avg_stars &&
    a.venue.review_count === b.venue.review_count &&
    a.venue.latest_review_body === b.venue.latest_review_body
);

// StyleSheet rather than NativeWind for the same snapshot-timing reason as above.
// This is the one place in the app where that tradeoff is worth it.
const styles = StyleSheet.create({
  box: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    // Solid, because markers cannot occlude Google's own place labels; a fill
    // and shadow is what keeps the box readable where they overlap.
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  stars: {
    fontSize: 13,
    lineHeight: 16,
    color: '#f59e0b',
    fontWeight: '600',
  },
  average: {
    color: '#0a0a0a',
  },
  snippet: {
    fontSize: 11,
    lineHeight: 14,
    color: '#525252',
  },
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CLOSE_SIZE / 2,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#ffffff',
    elevation: 5,
  },
  closeGlyph: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: '#525252',
  },
});
