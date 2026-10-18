import { Map as MapIcon, MapPinOff, Search } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useChenfengControlsBottom } from '@/components/chenfeng/map-chrome';
import { ScrollEdge } from '@/components/chenfeng/large-title-screen';
import { SwipeRow } from '@/components/chenfeng/swipe-row';
import { StarRating } from '@/components/star-rating';
import { useTabBarOverlap } from '@/components/tab-bar';
import { TagPill } from '@/components/tag-pill';
import { EmptyState, Row, Section } from '@/components/ui/list';
import { Menu, measureAnchor, type MenuAnchor } from '@/components/ui/menu';
import { Text } from '@/components/ui/text';
import { formatDistance, useVenueRows } from '@/components/venue-list';
import { lightImpact } from '@/lib/haptics';
import type { Coords } from '@/lib/use-location';
import { isMapped, type NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';

type ChenfengVenueListProps = {
  venues: NearbyVenue[];
  /** Where distances are measured from, on the device. See VenueList. */
  origin: Coords | null;
  /** Typed into the tab bar's search field. */
  query: string;
  onSelectVenue: (venue: NearbyVenue) => void;
  onLocateVenue: (venue: NearbyVenue) => void;
  /** Pull to refresh. */
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * Chenfeng's List mode (guideline section 14.2): a plain list edge to edge
 * under the map's controls, nearest first. Tapping a row opens the place;
 * "Show on Map" is a swipe away and in the row's menu, rather than a button on
 * every row. The same reviewed places, the same free search, as VenueList.
 */
export function ChenfengVenueList({
  venues,
  origin,
  query,
  onSelectVenue,
  onLocateVenue,
  refreshing,
  onRefresh,
}: ChenfengVenueListProps) {
  const top = useChenfengControlsBottom() + 12;
  const tabBarOverlap = useTabBarOverlap();
  const { rows, loading, searching, trimmed } = useVenueRows(venues, origin, query);
  const [menu, setMenu] = React.useState<{ venue: NearbyVenue; anchor: MenuAnchor } | null>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  const edge = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 12], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View className="flex-1 bg-background">
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: top, paddingBottom: tabBarOverlap + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} progressViewOffset={top} />
        }>
        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator />
          </View>
        ) : rows && rows.length > 0 ? (
          <Section plain>
            {rows.map(({ venue, distance }) => {
              const row = (
                <VenueRow
                  venue={venue}
                  distance={distance}
                  onPress={() => onSelectVenue(venue)}
                  onLocate={isMapped(venue) ? () => onLocateVenue(venue) : undefined}
                  onLongPress={async (target) => {
                    const anchor = await measureAnchor(target);
                    if (!anchor) return;
                    lightImpact();
                    setMenu({ venue, anchor });
                  }}
                />
              );
              // An online organisation has no place on the map, so no swipe
              // action to show it there.
              return isMapped(venue) ? (
                <SwipeRow
                  key={venue.id}
                  actions={[
                    { label: 'Show on Map', icon: MapIcon, tone: 'tint', onPress: () => onLocateVenue(venue) },
                  ]}>
                  {row}
                </SwipeRow>
              ) : (
                <React.Fragment key={venue.id}>{row}</React.Fragment>
              );
            })}
          </Section>
        ) : searching ? (
          // Reviewed places only, and free; finding one nobody has reviewed is
          // the map's search, a billed call - so say where to look.
          <EmptyState
            icon={Search}
            title={`No Results for “${trimmed}”`}
            description="Search for it on the map to add the first review."
          />
        ) : (
          <EmptyState
            icon={MapPinOff}
            title="No Reviewed Places Here"
            description="Pan the map or zoom out to find some."
          />
        )}
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        className="absolute left-0 right-0 top-0"
        style={[{ height: top + 12 }, edge]}>
        <ScrollEdge position="top" tone="bg-background" />
      </Animated.View>
      {tabBarOverlap > 0 ? (
        <View
          pointerEvents="none"
          className="absolute bottom-0 left-0 right-0"
          style={{ height: tabBarOverlap + 24 }}>
          <ScrollEdge position="bottom" tone="bg-background" />
        </View>
      ) : null}

      <Menu
        anchor={menu?.anchor ?? null}
        contextual
        accessibilityLabel={menu ? `${menu.venue.name} actions` : 'Place actions'}
        onClose={() => setMenu(null)}
        groups={
          menu
            ? [
                [
                  { label: 'Open', onPress: () => onSelectVenue(menu.venue) },
                  ...(isMapped(menu.venue)
                    ? [{ label: 'Show on Map', icon: MapIcon, onPress: () => onLocateVenue(menu.venue) }]
                    : []),
                ],
              ]
            : []
        }
      />
    </View>
  );
}

function VenueRow({
  venue,
  distance,
  onPress,
  onLocate,
  onLongPress,
}: {
  venue: NearbyVenue;
  distance: number | null;
  onPress: () => void;
  /** Absent for a venue with no coordinates. */
  onLocate?: () => void;
  onLongPress: (target: View | null) => void;
}) {
  const ref = React.useRef<View>(null);
  const average = Number(venue.avg_stars ?? 0);
  // Listed by us, not yet reviewed: no stars, which would read as zero.
  const unreviewed = venue.review_count === 0;
  const tags = venueTags(venue);
  const count = venue.review_count === 1 ? '1 review' : `${venue.review_count} reviews`;
  const away = formatDistance(distance);

  return (
    <View ref={ref} collapsable={false}>
      <Row
        accessory="chevron"
        detail={
          away ? (
            <Text textStyle="subheadline" className="text-label-secondary">
              {away}
            </Text>
          ) : undefined
        }
        onPress={onPress}
        onLongPress={() => onLongPress(ref.current)}
        accessibilityLabel={
          unreviewed
            ? `${venue.name}, listed, not yet reviewed${away ? `, ${away}` : ''}`
            : `${venue.name}, ${average.toFixed(1)} out of 5, ${count}${away ? `, ${away}` : ''}`
        }
        accessibilityActions={onLocate ? [{ name: 'map', label: 'Show on Map' }] : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'map') onLocate?.();
        }}>
        <Text textStyle="headline" numberOfLines={1} className="text-foreground">
          {venue.name}
        </Text>
        <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {unreviewed ? (
            <Text textStyle="footnote" className="text-label-secondary">
              Listed by LavenderBook · no reviews yet
            </Text>
          ) : (
            <View className="flex-row items-center gap-1.5">
              <StarRating value={average} size="xs" />
              <Text textStyle="footnote" className="text-label-secondary" style={{ fontVariant: ['tabular-nums'] }}>
                {average.toFixed(1)} · {count}
              </Text>
            </View>
          )}
          {tags.map((tag) => (
            <TagPill key={tag.slug} tag={tag} />
          ))}
        </View>
      </Row>
    </View>
  );
}
