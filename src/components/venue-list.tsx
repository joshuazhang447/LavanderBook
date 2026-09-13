import { MapPin, Search } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAP_CONTROLS_CLEARANCE } from '@/components/map-controls';
import { StarRating } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useIsWideViewport } from '@/components/tab-bar';
import { supabase } from '@/lib/supabase';
import type { Coords } from '@/lib/use-location';
import type { NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';

/** Long enough that typing a word is one query, short enough to feel immediate. */
const SEARCH_DEBOUNCE_MS = 300;

/** Raw metres stop being readable past a few hundred. */
function formatDistance(meters: number | null): string {
  if (meters === null) return '';
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

type VenueRowProps = {
  venue: NearbyVenue;
  index: number;
  onSelect: (venue: NearbyVenue) => void;
  onLocate: (venue: NearbyVenue) => void;
};

function VenueRow({ venue, index, onSelect, onLocate }: VenueRowProps) {
  const average = Number(venue.avg_stars ?? 0);
  // Listed by us, not yet reviewed by anyone. Drawing an empty star row here
  // would read as a rating of zero rather than as no rating at all.
  const unreviewed = venue.review_count === 0;
  // Shown whether or not anyone has reviewed the place: being a shelter is not
  // a fact that stops mattering once a venue has stars, and the map box and the
  // sheet both say so. Same pills as the sheet, so a tag looks like one thing
  // wherever it appears.
  const tags = venueTags(venue);

  return (
    // The row and Locate are siblings, not nested pressables: react-native-web
    // renders each as a <button>, and a button inside a button is invalid HTML
    // that breaks hydration.
    <Animated.View
      entering={FadeInDown.duration(200).delay(Math.min(index, 8) * 35)}
      layout={LinearTransition.duration(200)}
      className={`flex-row items-center bg-card ${index > 0 ? 'border-t border-border' : ''}`}>
      <Pressable
        onPress={() => onSelect(venue)}
        accessibilityRole="button"
        accessibilityLabel={
          unreviewed
            ? `${venue.name}, listed, not yet reviewed, ${formatDistance(venue.distance_meters)}`
            : `${venue.name}, ${average.toFixed(1)} of 5, ${formatDistance(venue.distance_meters)}`
        }
        className="flex-1 gap-1 p-4 active:bg-accent">
        <View className="flex-row items-center gap-2">
          {/* The pills sit beside the name and wrap under it when the name is
              long, rather than squeezing it. Not pressable here: the whole row
              already is, and react-native-web renders both as <button>. */}
          <View className="flex-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {/* Truncates rather than wrapping a long venue name across the row. */}
            <Text numberOfLines={1} className="shrink font-medium text-foreground">
              {venue.name}
            </Text>
            {tags.map((tag) => (
              <TagPill key={tag.slug} tag={tag} />
            ))}
          </View>
          <Text className="text-xs text-muted-foreground">
            {formatDistance(venue.distance_meters)}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {unreviewed ? (
            <Text numberOfLines={1} className="flex-1 text-xs text-muted-foreground">
              Listed by LavenderBook · no reviews yet
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

      <Pressable
        onPress={() => onLocate(venue)}
        accessibilityRole="button"
        accessibilityLabel={`Show ${venue.name} on the map`}
        className="mr-4 flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5 active:bg-accent">
        <Icon as={MapPin} className="size-3.5 text-muted-foreground" />
        <Text className="text-xs font-medium text-foreground">Locate</Text>
      </Pressable>
    </Animated.View>
  );
}

type VenueListProps = {
  /** Already fetched for the visible map region - rendering these costs nothing. */
  venues: NearbyVenue[];
  /** Where distances are measured from, and where search results are ordered from. */
  origin: Coords | null;
  onSelectVenue: (venue: NearbyVenue) => void;
  onLocateVenue: (venue: NearbyVenue) => void;
};

/**
 * Reviewed venues around what the map is showing, nearest first.
 *
 * Opening this fires no query: the map has already fetched the venues for the
 * visible region, and that answer is reused. Only typing hits the database, and
 * only for rated venues - an unrated place is found by tapping its label on the
 * map, which costs nothing where a Places search would.
 */
export function VenueList({ venues, origin, onSelectVenue, onLocateVenue }: VenueListProps) {
  const insets = useSafeAreaInsets();
  // Wide viewports get a header row that already clears the status bar; narrow
  // ones run under the notch, so the screen pays its own inset.
  const { isWide } = useIsWideViewport();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<NearbyVenue[] | null>(null);

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  React.useEffect(() => {
    if (!searching || !origin) return;

    let active = true;
    const timer = setTimeout(() => {
      supabase
        .rpc('venues_search', {
          p_query: trimmed,
          p_lat: origin.latitude,
          p_lng: origin.longitude,
        })
        .then(({ data }) => {
          if (active) setResults((data as NearbyVenue[] | null) ?? []);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed, searching, origin]);

  // While a new search is in flight the previous results stay put rather than
  // flashing empty, which reads as "no matches" for a moment.
  const rows = searching ? results : venues;
  const loading = searching && results === null;

  return (
    <View className="flex-1 bg-background">
      <View
        className="gap-3 px-4 pb-3"
        style={{ paddingTop: (isWide ? 0 : insets.top) + MAP_CONTROLS_CLEARANCE }}>
        <View className="flex-row items-center gap-2 rounded-lg border border-border bg-card px-3">
          <Icon as={Search} className="size-4 text-muted-foreground" />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search reviewed places"
            returnKeyType="search"
            autoCorrect={false}
            className="flex-1 border-0 bg-transparent px-0"
          />
        </View>
      </View>

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      ) : rows && rows.length > 0 ? (
        <ScrollView contentContainerClassName="px-4 pb-6">
          <Animated.View
            layout={LinearTransition.duration(200)}
            className="overflow-hidden rounded-lg border border-border">
            {rows.map((venue, index) => (
              <VenueRow
                key={venue.id}
                venue={venue}
                index={index}
                onSelect={onSelectVenue}
                onLocate={onLocateVenue}
              />
            ))}
          </Animated.View>
        </ScrollView>
      ) : (
        <Animated.View entering={FadeIn.duration(200)} className="gap-2 px-8 py-10">
          {searching ? (
            <>
              <Text className="text-center text-sm text-muted-foreground">
                No reviewed places match “{trimmed}”.
              </Text>
              {/*
                This list is reviewed venues only, and free because it never
                leaves Postgres. Finding somewhere nobody has reviewed means a
                billed Places call, which is what Map view's search box is for -
                so point at it rather than pretending there is no answer.
              */}
              <Text className="text-center text-sm text-muted-foreground">
                Not here? Search for it in Map view, or tap its label on the map, to
                add the first review.
              </Text>
            </>
          ) : (
            <Text className="text-center text-sm text-muted-foreground">
              No reviewed places in view. Pan the map or zoom out to find some.
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}
