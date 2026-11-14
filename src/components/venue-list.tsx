import { CircleX, MapPin, Search } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DistanceMeter } from '@/components/distance-meter';
import { useLeaveNowReserve } from '@/components/leave-now';
import { MAP_CONTROLS_CLEARANCE } from '@/components/map-controls';
import { StarRating } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useIsWideViewport } from '@/components/tab-bar';
import {
  arrangePlaces,
  matching,
  useAreaVenues,
  type ArrangedPlaces,
  type PlaceRow,
} from '@/lib/directory';
import { LIST_TEXT, ONLINE_TEXT } from '@/lib/directory-text';
import { useSearchDistance } from '@/lib/search-distance';
import type { Coords } from '@/lib/use-location';
import { isMapped, type NearbyVenue } from '@/lib/use-nearby-venues';
import { cn } from '@/lib/utils';

/** Raw metres stop being readable past a few hundred. */
export function formatDistance(meters: number | null): string {
  if (meters === null) return '';
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

type PlaceRowCardProps = {
  row: PlaceRow;
  first: boolean;
  /**
   * In the Directory, where every row is a listed place: an unreviewed one
   * then says only that, rather than repeating who listed it on every row.
   */
  listed?: boolean;
  onSelect: (venue: NearbyVenue) => void;
  onLocate: (venue: NearbyVenue) => void;
};

/**
 * One place: its name and tags, what it is, how it is rated, how far away.
 * Basic's and Material's row, in the list and in the Directory.
 *
 * Deliberately still. The rows used to slide in one after another and animate
 * every change of size, so opening the list, switching tab or loading a
 * description made the whole column jump; a list somebody is reading should
 * stay where it is.
 */
export function PlaceRowCard({ row, first, listed, onSelect, onLocate }: PlaceRowCardProps) {
  const { venue, tags, distance } = row;
  const average = Number(venue.avg_stars ?? 0);
  // Listed by us, not yet reviewed by anyone. Drawing an empty star row here
  // would read as a rating of zero rather than as no rating at all.
  const unreviewed = venue.review_count === 0;
  const away = formatDistance(distance);

  return (
    // The row and Locate are siblings, not nested pressables: react-native-web
    // renders each as a <button>, and a button inside a button is invalid HTML
    // that breaks hydration.
    <View className={cn('flex-row items-center bg-card', !first && 'border-t border-border')}>
      <Pressable
        onPress={() => onSelect(venue)}
        accessibilityRole="button"
        accessibilityLabel={[
          venue.name,
          unreviewed ? 'listed, not yet reviewed' : `${average.toFixed(1)} of 5`,
          away,
          venue.description,
        ]
          .filter(Boolean)
          .join(', ')}
        className={cn(
          'flex-1 gap-1.5 p-4 active:bg-accent',
          Platform.select({ web: 'cursor-pointer transition-colors hover:bg-accent' })
        )}>
        <View className="flex-row items-start gap-2">
          <Text numberOfLines={2} className="flex-1 font-medium text-foreground">
            {venue.name}
          </Text>
          {away ? <Text className="pt-0.5 text-xs text-muted-foreground">{away}</Text> : null}
        </View>
        {/* What the place is, in LavenderBook's words: two lines, the rest is
            on its card. Only rows from venues_directory carry one. */}
        {venue.description ? (
          <Text numberOfLines={2} className="text-sm leading-5 text-muted-foreground">
            {venue.description}
          </Text>
        ) : null}
        {/* A line of their own, wrapping as they need: beside a long name each
            pill ended up on a line by itself. Not pressable here - the whole
            row already is, and react-native-web renders both as <button>.
            Shown whether or not anyone has reviewed the place: being a
            shelter is not a fact that stops mattering once a venue has stars. */}
        {tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {tags.map((tag) => (
              <TagPill key={tag.slug} tag={tag} />
            ))}
          </View>
        ) : null}
        <View className="flex-row items-center gap-2">
          {unreviewed ? (
            <Text numberOfLines={1} className="flex-1 text-xs text-muted-foreground">
              {listed ? LIST_TEXT.noReviews : LIST_TEXT.listedNoReviews}
            </Text>
          ) : (
            <>
              <StarRating value={average} size="sm" />
              <Text numberOfLines={1} className="flex-1 text-xs text-muted-foreground">
                {venue.review_count === 1 ? '1 review' : `${venue.review_count} reviews`}
              </Text>
            </>
          )}
        </View>
      </Pressable>

      {/* An online organisation has no place on the map to locate. */}
      {isMapped(venue) ? (
        <Pressable
          onPress={() => onLocate(venue)}
          accessibilityRole="button"
          accessibilityLabel={`Show ${venue.name} on the map`}
          className={cn(
            'mr-4 flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5 active:bg-accent',
            Platform.select({ web: 'cursor-pointer' })
          )}>
          <Icon as={MapPin} className="size-3.5 text-muted-foreground" />
          <Text className="text-xs font-medium text-foreground">Locate</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type PlaceGroupProps = {
  rows: PlaceRow[];
  listed?: boolean;
  onSelect: (venue: NearbyVenue) => void;
  onLocate: (venue: NearbyVenue) => void;
};

/** A run of rows in one bordered box. */
export function PlaceGroup({ rows, listed, onSelect, onLocate }: PlaceGroupProps) {
  return (
    <View className="overflow-hidden rounded-lg border border-border">
      {rows.map((row, index) => (
        <PlaceRowCard
          key={row.venue.id}
          row={row}
          first={index === 0}
          listed={listed}
          onSelect={onSelect}
          onLocate={onLocate}
        />
      ))}
    </View>
  );
}

/**
 * Over the organisations with no place to visit, which come after everything
 * with a distance: they are not further away, they are nowhere, and a list
 * that ran straight on would look as if it were still sorted by distance.
 */
export function OnlineHeading() {
  return (
    <View className="gap-0.5 px-1">
      <Text role="heading" className="text-sm font-medium text-foreground">
        {ONLINE_TEXT.heading}
      </Text>
      <Text className="text-xs text-muted-foreground">{ONLINE_TEXT.lead}</Text>
    </View>
  );
}

/**
 * A search field for a list of places: the magnifier, the field, and a clear
 * button while there is something to clear. Basic's and Material's, in the
 * list and the Directory.
 */
export function PlaceSearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-border bg-card pl-3 pr-1">
      <Icon as={Search} className="size-4 text-muted-foreground" />
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        returnKeyType="search"
        autoCorrect={false}
        className="flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          className={cn('p-2 active:opacity-60', Platform.select({ web: 'cursor-pointer' }))}>
          <Icon as={CircleX} className="size-4 text-muted-foreground" />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The rows the list shows: every listed or reviewed place within the meter's
 * distance of `origin` - places you can go to, nearest first, then the online
 * ones - narrowed by whatever is typed, which looks in names, descriptions and
 * kinds. Shared with Chenfeng's list, whose search field is the tab bar's.
 *
 * The list used to show whatever the map had fetched for its markers, which is
 * nothing at all once the map is zoomed out to a city - and it said "zoom out"
 * to whoever was looking at the empty result. It now asks for the area itself
 * (useAreaVenues), out to the distance on the meter, so it does not depend on
 * how the map is zoomed; and searching it costs nothing, because what it
 * searches is already here.
 */
export function useListRows(origin: Coords | null, query: string, refreshKey: string) {
  const km = useSearchDistance();
  const area = useAreaVenues(origin, km * 1000, refreshKey);

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const places = React.useMemo<ArrangedPlaces | null>(() => {
    if (!area.venues) return null;
    const all = arrangePlaces(area.venues, origin, km * 1000);
    return searching
      ? { nearby: matching(all.nearby, trimmed), online: matching(all.online, trimmed) }
      : all;
  }, [area.venues, origin, km, searching, trimmed]);

  // A failed load with nothing to show is an error; with rows already on
  // screen it is only a refresh that did not happen.
  const failed = area.failed && area.venues === null;

  return {
    places,
    km,
    loading: places === null && !failed,
    failed,
    retry: area.retry,
    searching,
    trimmed,
  };
}

type VenueListProps = {
  /**
   * Where the list looks around, and where distances are measured from: the
   * user's own position while the map follows them, otherwise the middle of
   * the map. Exact, and used only here, on the device - the server is sent the
   * square it falls in, so `distance_meters` from the server is never shown.
   */
  origin: Coords | null;
  /** Changes when the list should ask again: a review was posted, or refresh. */
  refreshKey: string;
  onSelectVenue: (venue: NearbyVenue) => void;
  onLocateVenue: (venue: NearbyVenue) => void;
};

/**
 * Every listed or reviewed place around what the map is showing, nearest
 * first, out to the distance on the meter, with a search over them. See
 * useListRows.
 */
export function VenueList({ origin, refreshKey, onSelectVenue, onLocateVenue }: VenueListProps) {
  const insets = useSafeAreaInsets();
  // The map's controls sit a row lower under a phone browser's "Leave now".
  const leaveNow = useLeaveNowReserve();
  // Wide viewports get a header row that already clears the status bar; narrow
  // ones run under the notch, so the screen pays its own inset.
  const { isWide } = useIsWideViewport();
  const [query, setQuery] = React.useState('');
  const { places, km, loading, failed, retry, searching, trimmed } = useListRows(
    origin,
    query,
    refreshKey
  );
  const any = !!places && places.nearby.length + places.online.length > 0;

  return (
    <View className="flex-1 bg-background">
      <View
        className="w-full max-w-2xl gap-3 self-center px-4 pb-3"
        style={{ paddingTop: (isWide ? 0 : insets.top) + MAP_CONTROLS_CLEARANCE + leaveNow.top }}>
        <PlaceSearchField value={query} onChangeText={setQuery} placeholder={LIST_TEXT.search} />
        <DistanceMeter />
      </View>

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      ) : failed ? (
        <View className="items-center gap-3 px-8 py-10">
          <Text className="text-center text-sm text-muted-foreground">{LIST_TEXT.failed}</Text>
          <Button variant="outline" size="sm" onPress={retry}>
            <Text>{LIST_TEXT.retry}</Text>
          </Button>
        </View>
      ) : any && places ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="w-full max-w-2xl gap-4 self-center px-4 pb-6">
          {places.nearby.length > 0 ? (
            <PlaceGroup rows={places.nearby} onSelect={onSelectVenue} onLocate={onLocateVenue} />
          ) : null}
          {places.online.length > 0 ? (
            <View className="gap-2">
              <OnlineHeading />
              <PlaceGroup rows={places.online} onSelect={onSelectVenue} onLocate={onLocateVenue} />
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <View className="gap-2 px-8 py-10">
          {searching ? (
            <>
              <Text className="text-center text-sm text-muted-foreground">
                No place within {km} km matches “{trimmed}”.
              </Text>
              {/*
                This list is listed and reviewed venues only, and free because
                it never leaves the device. Finding somewhere nobody has
                reviewed means a billed Places call, which is what Map view's
                search box is for - so point at it rather than pretending there
                is no answer.
              */}
              <Text className="text-center text-sm text-muted-foreground">
                Not here? Search for it in Map view, or tap its label on the map, to add the first
                review.
              </Text>
            </>
          ) : (
            <>
              <Text className="text-center text-sm text-muted-foreground">
                {LIST_TEXT.empty(km)}
              </Text>
              <Text className="text-center text-sm text-muted-foreground">{LIST_TEXT.emptyHint}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}
