import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { NearbyVenue } from '@/lib/use-nearby-venues';

const BOX_WIDTH = 168;
const BOX_HEIGHT = 44;
const SNIPPET_CHARS = 40;

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
};

function VenueMarkerImpl({ venue, onPress }: VenueMarkerProps) {
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

  return (
    <Marker
      ref={markerRef}
      coordinate={coordinate}
      onPress={() => onPress(venue)}
      tracksViewChanges={tracksViewChanges}
      // Southern markers draw over northern ones, the usual map-label look.
      zIndex={Math.round(-venue.lat * 1000)}
      // anchor is Google-only and centerOffset Apple-only, and this map sets no
      // provider - so Android gets Google Maps and iOS gets Apple Maps.
      {...Platform.select({
        android: { anchor: { x: 0.5, y: 1.2 } },
        ios: { centerOffset: { x: 0, y: -(BOX_HEIGHT / 2 + 14) } },
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
  );
}

// Markers are the expensive unit to re-render; only redraw when what they show changes.
export const VenueMarker = React.memo(
  VenueMarkerImpl,
  (a, b) =>
    a.venue.id === b.venue.id &&
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
});
