import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Animated, { FadeIn } from 'react-native-reanimated';

import { deriveTagColors } from '@/lib/tag-colors';
import type { NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';

const BOX_WIDTH = 168;
/** Two lines: the name and its chip, then "Listed by LavenderBook". */
const BOX_HEIGHT = 44;
/** Three: the name and its chip, the rating, the latest quote. */
const REVIEWED_BOX_HEIGHT = 58;
const SNIPPET_CHARS = 40;
/** Clearance above the point, so the box does not sit on Google's own label. */
const LIFT = 35;
const CLOSE_SIZE = 26;
/**
 * How long the pop-in runs, and therefore how long the marker keeps
 * re-rasterising. Android snapshots the marker view to a bitmap, so an
 * animation is only visible while tracksViewChanges is on - and that is
 * expensive, so it is switched off the moment the animation lands.
 */
const ENTER_MS = 160;

/** A reviewed box is a line taller, so everything anchored to it moves with it. */
function boxHeight(venue: NearbyVenue): number {
  return venue.review_count > 0 ? REVIEWED_BOX_HEIGHT : BOX_HEIGHT;
}

// Android takes `anchor` as a fraction of the marker view; iOS takes
// `centerOffset` in points from the view's centre. Both are derived from the
// same LIFT so the platforms agree.
function boxPlacement(height: number) {
  return Platform.select({
    android: { anchor: { x: 0.5, y: 1 + LIFT / height } },
    ios: { centerOffset: { x: 0, y: -(height / 2 + LIFT) } },
    default: {},
  });
}

// The close button is a separate marker: a marker view is rasterised to a
// bitmap on Android, so a nested Pressable inside the box would never receive
// its own tap. Positioned on the box's top-right corner.
function closePlacement(height: number) {
  return Platform.select({
    android: {
      anchor: {
        x: (CLOSE_SIZE / 2 - BOX_WIDTH / 2) / CLOSE_SIZE,
        y: (CLOSE_SIZE / 2 + height + LIFT) / CLOSE_SIZE,
      },
    },
    ios: { centerOffset: { x: BOX_WIDTH / 2, y: -(height + LIFT) } },
    default: {},
  });
}

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

/**
 * Everything about the drawn tag, as one comparable string.
 *
 * Only the first tag reaches the box, so that is all the memo below has to
 * watch - but it has to watch the colours as well as the label, because
 * recolouring a tag changes the bitmap just as surely as renaming it.
 */
function tagFingerprint(venue: NearbyVenue): string {
  const tag = venueTags(venue)[0];
  return tag ? `${tag.slug}|${tag.label}|${tag.color}|${tag.textColor ?? ''}` : '';
}

function summarise(venue: NearbyVenue): string {
  const body = venue.latest_review_body?.trim();
  if (body) {
    return body.length > SNIPPET_CHARS ? `${body.slice(0, SNIPPET_CHARS).trimEnd()}...` : body;
  }
  // A tagged venue nobody has reviewed is here because WE listed it, so say so
  // rather than counting to zero. The tag itself sits on the line above.
  if (venue.review_count === 0) return 'Listed by LavenderBook';
  return venue.review_count === 1 ? '1 review' : `${venue.review_count} reviews`;
}

type VenueMarkerProps = {
  venue: NearbyVenue;
  onPress: (venue: NearbyVenue) => void;
};

type VenueCloseMarkerProps = {
  venue: NearbyVenue;
  onDismiss: (venueId: string) => void;
};

/**
 * Kept out of a shared Fragment with the close marker on purpose. MapView walks
 * its own children to track markers, and a component returning two of them
 * inside a Fragment left the close marker behind when the pair unmounted.
 */
function VenueMarkerImpl({ venue, onPress }: VenueMarkerProps) {
  // On through the entrance animation, then off: leaving it on re-rasterises
  // every marker every frame.
  const [tracksViewChanges, setTracksViewChanges] = React.useState(true);

  React.useEffect(() => {
    // A little past the animation so the final frame is the one that sticks.
    const timer = setTimeout(() => setTracksViewChanges(false), ENTER_MS + 120);
    return () => clearTimeout(timer);
  }, []);

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
  }, [venue.avg_stars, venue.review_count, venue.latest_review_body, venue.tags, venue.name]);

  const zIndex = Math.round(-venue.lat * 1000);
  const reviewed = venue.review_count > 0;
  // The box is white on every theme, so the chip always takes its light colours.
  const tag = venueTags(venue)[0] ?? null;
  const tagColors = deriveTagColors(tag?.color ?? '#e5e5e5', tag?.textColor).light;

  return (
    <Marker
      ref={markerRef}
      coordinate={coordinate}
      onPress={() => onPress(venue)}
      tracksViewChanges={tracksViewChanges}
      // Southern markers draw over northern ones, the usual map-label look.
      zIndex={zIndex}
      // anchor is Google-only and centerOffset Apple-only, and this map sets no
      // provider - so Android gets Google Maps and iOS gets Apple Maps.
      {...boxPlacement(boxHeight(venue))}>
      {/*
        Fixed pixel size via style, not className: NativeWind resolves classes on
        a later pass that can land after Android has taken its snapshot.
      */}
      <Animated.View
        entering={FadeIn.duration(ENTER_MS)}
        style={[styles.box, { height: boxHeight(venue) }]}>
        {/* The name always comes first: a box of stars alone could be any of
            the places around it. It may shrink - the chip beside it may not be
            pushed out, because the tag is often why the place is here. One chip
            even when a place carries several; the sheet lists them all. */}
        <View style={styles.line}>
          <Text style={styles.name} numberOfLines={1}>
            {venue.name}
          </Text>
          {tag ? (
            <View style={[styles.chip, { backgroundColor: tagColors.background }]}>
              <Text style={[styles.chipLabel, { color: tagColors.foreground }]} numberOfLines={1}>
                {tag.label}
              </Text>
            </View>
          ) : null}
        </View>
        {/*
          No star row at all when nobody has reviewed it.

          `avg_stars ?? 0` would draw an unreviewed venue as "0.0" with no stars,
          and a rating of zero out of five is very close to the worst thing this
          app can say about a place - especially one we listed ourselves because
          it is a shelter. An absent rating has to look absent.
        */}
        {reviewed ? (
          <Text style={styles.stars} numberOfLines={1}>
            {starGlyphs(Number(venue.avg_stars ?? 0))}{' '}
            <Text style={styles.average}>{Number(venue.avg_stars ?? 0).toFixed(1)}</Text>
          </Text>
        ) : null}
        <Text style={styles.snippet} numberOfLines={1}>
          {summarise(venue)}
        </Text>
      </Animated.View>
    </Marker>
  );
}

/** The box's close button, a marker of its own: a marker view is rasterised to a
 * bitmap on Android, so a Pressable nested in the box never gets its own tap. */
function VenueCloseMarkerImpl({ venue, onDismiss }: VenueCloseMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), ENTER_MS + 120);
    return () => clearTimeout(timer);
  }, []);

  const coordinate = React.useMemo(
    () => ({ latitude: venue.lat, longitude: venue.lng }),
    [venue.lat, venue.lng]
  );

  return (
    <Marker
      coordinate={coordinate}
      onPress={() => onDismiss(venue.id)}
      tracksViewChanges={tracksViewChanges}
      zIndex={Math.round(-venue.lat * 1000) + 1}
      {...closePlacement(boxHeight(venue))}>
      <Animated.View entering={FadeIn.duration(ENTER_MS)} style={styles.close}>
        <Text style={styles.closeGlyph}>x</Text>
      </Animated.View>
    </Marker>
  );
}

// Markers are the expensive unit to re-render; only redraw when what they show changes.
export const VenueMarker = React.memo(
  VenueMarkerImpl,
  (a, b) =>
    a.venue.id === b.venue.id &&
    a.venue.name === b.venue.name &&
    a.venue.avg_stars === b.venue.avg_stars &&
    a.venue.review_count === b.venue.review_count &&
    // Tagging a venue changes what the box says, so a stale bitmap would keep
    // showing the old chip until something else forced a redraw.
    tagFingerprint(a.venue) === tagFingerprint(b.venue) &&
    a.venue.latest_review_body === b.venue.latest_review_body
);

export const VenueCloseMarker = React.memo(
  VenueCloseMarkerImpl,
  (a, b) =>
    a.venue.id === b.venue.id &&
    a.onDismiss === b.onDismiss &&
    // A first review makes the box a line taller, and the button has to follow
    // its corner up.
    boxHeight(a.venue) === boxHeight(b.venue)
);

// StyleSheet rather than NativeWind for the same snapshot-timing reason as above.
// This is the one place in the app where that tradeoff is worth it.
const styles = StyleSheet.create({
  box: {
    width: BOX_WIDTH,
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
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stars: {
    fontSize: 13,
    lineHeight: 16,
    color: '#f59e0b',
    fontWeight: '600',
  },
  chip: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 84,
    borderRadius: 5,
    paddingHorizontal: 4,
  },
  chipLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  average: {
    color: '#0a0a0a',
  },
  name: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 16,
    color: '#0a0a0a',
    fontWeight: '600',
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
