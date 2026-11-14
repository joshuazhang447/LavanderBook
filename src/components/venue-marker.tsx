import { Star } from 'lucide-react-native';
import * as React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  groupGeometry,
  groupSize,
  PIN_SIZE,
  PIN_TAIL,
  placeGeometry,
  quoteText,
  ratingText,
  spokenPlace,
  type GroupItem,
  type MarkerGeometry,
  type PlaceItem,
} from '@/lib/map-layout';
import { kindIcon } from '@/lib/kind-icons';
import { deriveTagColors } from '@/lib/tag-colors';
import type { NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';

/**
 * How long the pop-in runs, and therefore how long the marker keeps
 * re-rasterising. Android snapshots the marker view to a bitmap, so an
 * animation is only visible while tracksViewChanges is on - and that is
 * expensive, so it is switched off the moment the animation lands.
 */
const ENTER_MS = 160;

/** A reviewed place nobody has tagged: somewhere visitors added, not one we list. */
const UNTAGGED_PIN = '#475569';
/**
 * How long a place's marker keeps re-rasterising. Longer than the fade: the
 * kind's symbol is an SVG, which react-native-svg draws after layout, and a
 * snapshot taken before it lands captures a blank head.
 */
const CAPTURE_MS = 600;
/** The pin's point: a square turned on its corner, behind the head. */
const TIP_SIDE = 10;

/**
 * Where the place's true spot sits in the drawing. Android takes it as a
 * fraction of the marker view; iOS as the view centre's offset from the spot,
 * in points. Both from the same geometry, so the platforms agree.
 */
function anchorProps(geometry: MarkerGeometry) {
  return Platform.select({
    android: {
      anchor: { x: geometry.anchor.x / geometry.width, y: geometry.anchor.y / geometry.height },
    },
    ios: {
      centerOffset: {
        x: geometry.width / 2 - geometry.anchor.x,
        y: geometry.height / 2 - geometry.anchor.y,
      },
    },
    default: {},
  });
}

/** On through the entrance, then off: left on, every marker re-rasterises every frame. */
function useTracksViewChanges(ms = ENTER_MS + 120): boolean {
  const [tracks, setTracks] = React.useState(true);
  React.useEffect(() => {
    // A little past the animation, so the final frame is the one that sticks.
    const timer = setTimeout(() => setTracks(false), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return tracks;
}

/**
 * Everything about the drawn tag, as one comparable string. Only the first
 * tag is drawn, but its colours count as much as its label: recolouring a tag
 * changes the bitmap just as surely as renaming it.
 */
function tagFingerprint(venue: NearbyVenue): string {
  const tag = venueTags(venue)[0];
  return tag ? `${tag.slug}|${tag.label}|${tag.color}|${tag.textColor ?? ''}` : '';
}

/**
 * The kind's own symbol in white, as the Directory draws it; a star for a
 * place only visitors have added, which has a rating and no kind.
 */
function kindGlyph(slug: string | null) {
  return React.createElement(slug ? kindIcon(slug) : Star, {
    color: '#ffffff',
    size: 15,
    strokeWidth: 2.4,
  });
}

type PlaceMarkerProps = {
  item: PlaceItem;
  onPress: (venue: NearbyVenue) => void;
};

/**
 * One place: a pin on its spot, and its label where the layout found room
 * (map-layout.ts). The parent keys it by its layout, so a label that moves or
 * grows remounts the marker, which is what re-captures Android's bitmap.
 */
function PlaceMarkerImpl({ item, onPress }: PlaceMarkerProps) {
  const tracksViewChanges = useTracksViewChanges(CAPTURE_MS);
  const markerRef = React.useRef<React.ComponentRef<typeof Marker>>(null);
  const { venue } = item;

  const coordinate = React.useMemo(
    () => ({ latitude: venue.lat, longitude: venue.lng }),
    [venue.lat, venue.lng]
  );

  // Re-capture when what it says changes, or Android keeps the stale bitmap.
  React.useEffect(() => {
    markerRef.current?.redraw();
  }, [venue.avg_stars, venue.review_count, venue.latest_review_body, venue.tags, venue.name]);

  const geometry = placeGeometry(item);
  // White on every theme, like the map under it, so a chip always takes its
  // light-mode colours.
  const tag = venueTags(venue)[0] ?? null;
  const colors = tag ? deriveTagColors(tag.color, tag.textColor).light : null;
  const rating = ratingText(venue);
  const quote = item.label?.size === 'full' ? quoteText(venue) : null;
  const fill = colors?.foreground ?? UNTAGGED_PIN;

  return (
    <Marker
      ref={markerRef}
      coordinate={coordinate}
      onPress={() => onPress(venue)}
      tracksViewChanges={tracksViewChanges}
      zIndex={item.z}
      accessibilityLabel={spokenPlace(venue)}
      // anchor is Google-only and centerOffset Apple-only, and this map sets no
      // provider - so Android gets Google Maps and iOS gets Apple Maps.
      {...anchorProps(geometry)}>
      {/*
        Fixed pixel sizes via style, not className: NativeWind resolves classes
        on a later pass that can land after Android has taken its snapshot.
      */}
      <Animated.View
        entering={FadeIn.duration(ENTER_MS)}
        style={{ width: geometry.width, height: geometry.height }}>
        {/* Filled in the tag's strong colour, with its symbol: Google's and
            Apple's own place icons are pale, and ours have to stand out from
            them. The point first, so the head covers its top half; its
            bottom corner lands on the tip, half a diagonal below its centre.
            Lucide directly rather than Icon: the pin looks the same in every
            skin, as the map under it does. */}
        <View
          style={[
            styles.tip,
            {
              left: geometry.pin.x + (PIN_SIZE - TIP_SIDE) / 2,
              top: geometry.pin.y + PIN_SIZE + PIN_TAIL - TIP_SIDE / 2 - (TIP_SIDE * Math.SQRT2) / 2,
              backgroundColor: fill,
            },
          ]}
        />
        <View
          style={[styles.head, { left: geometry.pin.x, top: geometry.pin.y, backgroundColor: fill }]}>
          {kindGlyph(tag?.slug ?? null)}
        </View>

        {geometry.label ? (
          <View
            style={[
              styles.label,
              {
                left: geometry.label.x,
                top: geometry.label.y,
                width: geometry.label.width,
                height: geometry.label.height,
              },
            ]}>
            <Text style={styles.name} numberOfLines={1}>
              {venue.name}
            </Text>
            {rating || tag ? (
              <View style={styles.meta}>
                {/* Star glyphs, not an icon: react-native-svg draws after
                    layout, and Android's snapshot can land before it. */}
                {rating ? (
                  <Text style={styles.rating} numberOfLines={1}>
                    <Text style={styles.star}>★</Text>
                    {rating.slice(1)}
                  </Text>
                ) : null}
                {tag && colors ? (
                  <View style={[styles.chip, { backgroundColor: colors.background }]}>
                    <Text style={[styles.chipLabel, { color: colors.foreground }]} numberOfLines={1}>
                      {tag.label}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {quote ? (
              <Text style={styles.quote} numberOfLines={1}>
                “{quote}”
              </Text>
            ) : null}
          </View>
        ) : null}
      </Animated.View>
    </Marker>
  );
}

type GroupMarkerProps = {
  item: GroupItem;
  onPress: (group: GroupItem) => void;
};

/** Places whose pins would touch, as one count. Pressed, it zooms in or fans out. */
function GroupMarkerImpl({ item, onPress }: GroupMarkerProps) {
  const tracksViewChanges = useTracksViewChanges();
  const geometry = groupGeometry(item.venues.length);
  const size = groupSize(item.venues.length);
  const coordinate = React.useMemo(
    () => ({ latitude: item.lat, longitude: item.lng }),
    [item.lat, item.lng]
  );

  return (
    <Marker
      coordinate={coordinate}
      onPress={() => onPress(item)}
      tracksViewChanges={tracksViewChanges}
      zIndex={item.z}
      accessibilityLabel={`${item.venues.length} places here: ${item.venues
        .slice(0, 12)
        .map((venue) => venue.name)
        .join(', ')}${item.venues.length > 12 ? `, and ${item.venues.length - 12} more` : ''}`}
      {...anchorProps(geometry)}>
      <Animated.View
        entering={FadeIn.duration(ENTER_MS)}
        style={{ width: geometry.width, height: geometry.height }}>
        {/* A soft halo of itself, the way map apps draw a cluster: it reads
            as "several", where one more disc would read as one more place. */}
        <View
          style={[
            styles.groupHalo,
            {
              left: geometry.pin.x - HALO,
              top: geometry.pin.y - HALO,
              width: size + HALO * 2,
              height: size + HALO * 2,
              borderRadius: size / 2 + HALO,
            },
          ]}
        />
        <View
          style={[
            styles.group,
            {
              left: geometry.pin.x,
              top: geometry.pin.y,
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}>
          <Text style={styles.groupCount}>{item.venues.length}</Text>
        </View>
      </Animated.View>
    </Marker>
  );
}

// Markers are the expensive unit to re-render: only when what they draw changes.
/** The group's halo, inside the drawing's shadow margin. */
const HALO = 4;

export const PlaceMarker = React.memo(
  PlaceMarkerImpl,
  (a, b) =>
    a.onPress === b.onPress &&
    a.item.z === b.item.z &&
    a.item.venue.id === b.item.venue.id &&
    a.item.venue.name === b.item.venue.name &&
    a.item.venue.avg_stars === b.item.venue.avg_stars &&
    a.item.venue.review_count === b.item.venue.review_count &&
    a.item.venue.latest_review_body === b.item.venue.latest_review_body &&
    // Tagging a place changes what it draws, so a stale bitmap would keep
    // showing the old chip until something else forced a redraw.
    tagFingerprint(a.item.venue) === tagFingerprint(b.item.venue)
);

export const GroupMarker = React.memo(
  GroupMarkerImpl,
  (a, b) =>
    a.onPress === b.onPress &&
    a.item.z === b.item.z &&
    a.item.lat === b.item.lat &&
    a.item.lng === b.item.lng &&
    a.item.venues.length === b.item.venues.length &&
    a.item.venues.every((venue, index) => venue.id === b.item.venues[index]?.id)
);

/**
 * The key a place's marker is mounted under: its layout as well as its id,
 * since a label that moved or grew is a different bitmap.
 */
export function placeMarkerKey(item: PlaceItem): string {
  const label = item.label ? `${item.label.side}-${item.label.size}-${item.label.width}` : 'pin';
  return `${item.key}:${label}:${Math.round(item.offset.x)},${Math.round(item.offset.y)}`;
}

// StyleSheet rather than NativeWind for the same snapshot-timing reason as
// above. This is the one place in the app where that trade is worth it.
const styles = StyleSheet.create({
  head: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tip: {
    position: 'absolute',
    width: TIP_SIDE,
    height: TIP_SIDE,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#ffffff',
    borderBottomRightRadius: 2,
    transform: [{ rotate: '45deg' }],
    elevation: 2,
  },
  label: {
    position: 'absolute',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    // Solid, because markers cannot hide Google's own place labels; a fill and
    // a shadow keep it readable where they overlap.
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  name: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 14,
  },
  rating: {
    flexShrink: 0,
    fontSize: 11,
    lineHeight: 14,
    color: '#525252',
    fontVariant: ['tabular-nums'],
  },
  star: {
    color: '#f59e0b',
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
  quote: {
    fontSize: 11,
    lineHeight: 14,
    color: '#525252',
    fontStyle: 'italic',
  },
  groupHalo: {
    position: 'absolute',
    backgroundColor: 'rgba(38,38,38,0.2)',
  },
  group: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  groupCount: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: '#ffffff',
    fontVariant: ['tabular-nums'],
  },
});
