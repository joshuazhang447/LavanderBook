import { Map as MapIcon, MapPinOff, Search, TriangleAlert } from 'lucide-react-native';
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
import { DistanceMeter } from '@/components/distance-meter';
import { ListFilterControl } from '@/components/list-filter';
import { ScrollEdge } from '@/components/chenfeng/large-title-screen';
import { SwipeRow } from '@/components/chenfeng/swipe-row';
import { StarRating } from '@/components/star-rating';
import { useTabBarOverlap } from '@/components/tab-bar';
import { TagPill } from '@/components/tag-pill';
import { Button } from '@/components/ui/button';
import { EmptyState, Row, Section } from '@/components/ui/list';
import { Menu, measureAnchor, type MenuAnchor } from '@/components/ui/menu';
import { Text } from '@/components/ui/text';
import { formatDistance, useListRows } from '@/components/venue-list';
import { useOnlineFold, type PlaceRow } from '@/lib/directory';
import { LIST_FILTER_TEXT, LIST_TEXT, ONLINE_TEXT } from '@/lib/directory-text';
import { lightImpact } from '@/lib/haptics';
import type { Coords } from '@/lib/use-location';
import { isMapped, type NearbyVenue } from '@/lib/use-nearby-venues';

type ChenfengVenueListProps = {
  /** Where the list looks around and measures from, on the device. See VenueList. */
  origin: Coords | null;
  /** Typed into the tab bar's search field. */
  query: string;
  /** Changes when the list should ask again. */
  refreshKey: string;
  onSelectVenue: (venue: NearbyVenue) => void;
  onLocateVenue: (venue: NearbyVenue) => void;
  /** Pull to refresh. */
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * Chenfeng's List mode (guideline section 14.2): a plain list edge to edge
 * under the map's controls, nearest first, then the online organisations under
 * a header of their own. Tapping a row opens the place; "Show on Map" is a
 * swipe away and in the row's menu, rather than a button on every row. The
 * same places, the same free search, as VenueList (useListRows).
 */
export function ChenfengVenueList({
  origin,
  query,
  refreshKey,
  onSelectVenue,
  onLocateVenue,
  refreshing,
  onRefresh,
}: ChenfengVenueListProps) {
  const top = useChenfengControlsBottom() + 12;
  const tabBarOverlap = useTabBarOverlap();
  const { places, km, filter, counts, loading, failed, retry, searching, trimmed } = useListRows(
    origin,
    query,
    refreshKey
  );
  const any = !!places && places.nearby.length + places.online.length > 0;
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
        {/* How far the list looks: the same meter as the Directory's, and the
            same choice - move one and the other has moved. */}
        <View className="gap-4 px-4 pb-4">
          <DistanceMeter />
          <ListFilterControl counts={counts} />
        </View>
        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator />
          </View>
        ) : failed ? (
          <EmptyState
            icon={TriangleAlert}
            title={LIST_TEXT.failedTitle}
            description={LIST_TEXT.failed}
            action={
              <Button variant="secondary" onPress={retry}>
                <Text>{LIST_TEXT.retryTitle}</Text>
              </Button>
            }
          />
        ) : any && places ? (
          <View className="gap-7">
            {places.nearby.length > 0 ? (
              <ChenfengPlaceRows
                rows={places.nearby}
                onSelect={onSelectVenue}
                onLocate={onLocateVenue}
              />
            ) : null}
            {places.online.length > 0 ? (
              <ChenfengOnlineRows
                rows={places.online}
                open={searching}
                onSelect={onSelectVenue}
                onLocate={onLocateVenue}
              />
            ) : null}
          </View>
        ) : filter !== 'all' && counts.all > 0 ? (
          // There are places here; the filter is what hides them.
          <EmptyState
            icon={MapPinOff}
            title={LIST_FILTER_TEXT.empty(filter, km)}
            description={LIST_FILTER_TEXT.emptyHint}
          />
        ) : searching ? (
          // Listed and reviewed places only, and free; finding one nobody has
          // reviewed is the map's search, a billed call - so say where to look.
          <EmptyState
            icon={Search}
            title={`No Results for “${trimmed}”`}
            description={`Nothing within ${km} km matches. Search for it on the map to add the first review.`}
          />
        ) : (
          <EmptyState
            icon={MapPinOff}
            title={LIST_TEXT.emptyTitle}
            description={`${LIST_TEXT.empty(km)} ${LIST_TEXT.emptyHint}`}
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
    </View>
  );
}

type ChenfengPlaceRowsProps = {
  rows: PlaceRow[];
  /**
   * Edge to edge on the plain page (the list), or an inset rounded section on
   * the grouped one (the Directory).
   */
  plain?: boolean;
  header?: string;
  footer?: string;
  /** In the Directory, where every row is a listed place. See PlaceRowCard. */
  listed?: boolean;
  /** A last, tinted row that opens the rest of a folded section (useOnlineFold). */
  more?: { label: string; onPress: () => void };
  onSelect: (venue: NearbyVenue) => void;
  onLocate: (venue: NearbyVenue) => void;
};

/**
 * The online organisations as their own section, folded to the first few with
 * a "Show All" row while `open` is false (useOnlineFold): a search or a single
 * kind shows everything.
 */
export function ChenfengOnlineRows({
  rows,
  open,
  heading = true,
  plain,
  listed,
  onSelect,
  onLocate,
}: {
  rows: PlaceRow[];
  open: boolean;
  /** False under the Online kind, whose own heading has said all of this. */
  heading?: boolean;
  plain?: boolean;
  listed?: boolean;
  onSelect: (venue: NearbyVenue) => void;
  onLocate: (venue: NearbyVenue) => void;
}) {
  const fold = useOnlineFold(rows, open);
  return (
    <ChenfengPlaceRows
      plain={plain}
      header={heading ? ONLINE_TEXT.headingTitle : undefined}
      footer={heading ? ONLINE_TEXT.lead : undefined}
      rows={fold.rows}
      listed={listed}
      more={
        fold.hiddenOf !== null
          ? { label: ONLINE_TEXT.showAllTitle(fold.hiddenOf), onPress: fold.expand }
          : undefined
      }
      onSelect={onSelect}
      onLocate={onLocate}
    />
  );
}

/**
 * A run of places as plain rows, with what goes with them: "Show on Map" as a
 * swipe and in the menu a long press opens. Chenfeng's rows in the list and in
 * the Directory.
 */
export function ChenfengPlaceRows({
  rows,
  plain = true,
  header,
  footer,
  listed,
  more,
  onSelect,
  onLocate,
}: ChenfengPlaceRowsProps) {
  const [menu, setMenu] = React.useState<{ venue: NearbyVenue; anchor: MenuAnchor } | null>(null);

  return (
    <>
      <Section plain={plain} header={header} footer={footer}>
        {rows.map((place) => {
          const { venue } = place;
          const row = (
            <PlaceListRow
              place={place}
              listed={listed}
              onPress={() => onSelect(venue)}
              onLocate={isMapped(venue) ? () => onLocate(venue) : undefined}
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
                { label: 'Show on Map', icon: MapIcon, tone: 'tint', onPress: () => onLocate(venue) },
              ]}>
              {row}
            </SwipeRow>
          ) : (
            <React.Fragment key={venue.id}>{row}</React.Fragment>
          );
        })}
        {more ? <Row title={more.label} tone="tint" onPress={more.onPress} /> : null}
      </Section>

      <Menu
        anchor={menu?.anchor ?? null}
        contextual
        accessibilityLabel={menu ? `${menu.venue.name} actions` : 'Place actions'}
        onClose={() => setMenu(null)}
        groups={
          menu
            ? [
                [
                  { label: 'Open', onPress: () => onSelect(menu.venue) },
                  ...(isMapped(menu.venue)
                    ? [{ label: 'Show on Map', icon: MapIcon, onPress: () => onLocate(menu.venue) }]
                    : []),
                ],
              ]
            : []
        }
      />
    </>
  );
}

function PlaceListRow({
  place,
  listed,
  onPress,
  onLocate,
  onLongPress,
}: {
  place: PlaceRow;
  listed?: boolean;
  onPress: () => void;
  /** Absent for a venue with no coordinates. */
  onLocate?: () => void;
  onLongPress: (target: View | null) => void;
}) {
  const { venue, tags, distance } = place;
  const ref = React.useRef<View>(null);
  const average = Number(venue.avg_stars ?? 0);
  // Listed by us, not yet reviewed: no stars, which would read as zero.
  const unreviewed = venue.review_count === 0;
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
        accessibilityLabel={[
          venue.name,
          unreviewed ? 'listed, not yet reviewed' : `${average.toFixed(1)} out of 5, ${count}`,
          tags.length === 0 ? LIST_TEXT.foundByVisitorsSpoken : null,
          away,
          venue.description,
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityActions={onLocate ? [{ name: 'map', label: 'Show on Map' }] : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'map') onLocate?.();
        }}>
        <Text textStyle="headline" numberOfLines={1} className="text-foreground">
          {venue.name}
        </Text>
        {/* What the place is, in LavenderBook's words: two lines, the rest is
            on its card. Only rows from venues_directory carry one. */}
        {venue.description ? (
          <Text textStyle="subheadline" numberOfLines={2} className="mt-0.5 text-label-secondary">
            {venue.description}
          </Text>
        ) : null}
        <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {unreviewed ? (
            <Text textStyle="footnote" className="text-label-secondary">
              {listed ? LIST_TEXT.noReviews : LIST_TEXT.listedNoReviews}
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
          {/* Not one of ours: LavenderBook has not checked it. */}
          {tags.length === 0 ? (
            <Text textStyle="footnote" className="text-label-secondary">
              {LIST_TEXT.foundByVisitors}
            </Text>
          ) : null}
        </View>
      </Row>
    </View>
  );
}
