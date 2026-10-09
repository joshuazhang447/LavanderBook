import { useFocusEffect } from 'expo-router';
import { useTabTrigger } from 'expo-router/ui';
import { CircleUser, MapPin, VenetianMask } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { ReviewSheet } from '@/components/review-sheet';
import { StarRating } from '@/components/star-rating';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { focusMapOn } from '@/lib/map-focus';
import { supabase } from '@/lib/supabase';
import type { SelectedPoi } from '@/lib/venues';

type MyReview = {
  stars: number;
  updated_at: string;
  /** The name readers see on this review. Null: the account's display name. */
  alias: string | null;
  venue: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    google_place_id: string | null;
  };
};

type MyReviewsListProps = {
  /**
   * Bumped when the account's reviews were renamed while this list was on
   * screen - turning per-place names on does that without leaving the tab, so
   * refetching on focus alone would never notice.
   */
  renames?: number;
};

/** The signed-in account's reviews. my_reviews() knows who is asking, so no id is passed in. */
export function MyReviewsList({ renames = 0 }: MyReviewsListProps) {
  // switchTab rather than router.navigate: this is the mechanism the tab bar
  // itself uses, so it lands on the tab rather than pushing over it.
  const { switchTab } = useTabTrigger({ name: 'map' });
  const [reviews, setReviews] = React.useState<MyReview[] | null>(null);
  const [open, setOpen] = React.useState<MyReview | null>(null);
  const refetch = React.useCallback(() => {
    let active = true;

    // Through my_reviews() rather than the table, which can no longer be
    // filtered by author_id. Most recently saved first, as the server sends it.
    supabase.rpc('my_reviews').then(({ data }) => {
      if (!active) return;
      setReviews(
        (data ?? []).map((row) => ({
          stars: row.stars,
          updated_at: row.updated_at,
          // The generator cannot see that a RETURNS TABLE column is nullable.
          alias: (row.alias as string | null) ?? null,
          venue: {
            id: row.venue_id,
            name: row.venue_name,
            lat: row.venue_lat,
            lng: row.venue_lng,
            google_place_id: row.venue_google_place_id,
          },
        }))
      );
    });

    return () => {
      active = false;
    };
  }, []);

  // On focus rather than only on mount: the tab navigator keeps screens mounted,
  // so a review posted over on the Map tab would otherwise leave this stale.
  useFocusEffect(refetch);

  React.useEffect(() => {
    if (renames === 0) return;
    return refetch();
  }, [renames, refetch]);

  if (reviews === null) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text className="font-medium text-foreground">
        Your reviews{reviews.length > 0 ? ` (${reviews.length})` : ''}
      </Text>

      {reviews.length === 0 ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          className="rounded-lg border border-dashed border-border p-6">
          <Text className="text-center text-sm text-muted-foreground">
            No reviews yet. Tap a place on the map to add your first.
          </Text>
        </Animated.View>
      ) : (
        <Animated.View
          // Rows settle into place when one is deleted instead of jumping.
          layout={LinearTransition.duration(220)}
          className="overflow-hidden rounded-lg border border-border">
          {reviews.map((review, index) => (
            // The row and Locate are siblings, not nested pressables:
            // react-native-web renders each as a <button>, and a button inside a
            // button is invalid HTML that breaks hydration.
            <Animated.View
              key={review.venue.id}
              // Staggered so the list arrives as a sequence, not a slab.
              entering={FadeInDown.duration(220).delay(index * 45)}
              layout={LinearTransition.duration(220)}
              className={`flex-row items-center bg-card ${
                index > 0 ? 'border-t border-border' : ''
              }`}>
              <Pressable
                onPress={() => setOpen(review)}
                accessibilityRole="button"
                accessibilityLabel={`${review.venue.name}, ${review.stars} of 5, shown as ${
                  review.alias ?? 'your account name'
                }`}
                className="flex-1 gap-1 p-4 active:bg-accent">
                {/* numberOfLines truncates with an ellipsis rather than wrapping
                    a long venue name across the row. */}
                <Text numberOfLines={1} className="font-medium text-foreground">
                  {review.venue.name}
                </Text>
                <StarRating value={review.stars} size="sm" />
                {/* Readers see a different name on each review, so this is the
                    only place the author can match one up with what they wrote. */}
                <View className="flex-row items-center gap-1">
                  <Icon
                    as={review.alias ? VenetianMask : CircleUser}
                    className="size-3.5 text-muted-foreground"
                  />
                  <Text numberOfLines={1} className="flex-1 text-xs text-muted-foreground">
                    {review.alias ? `Shown as ${review.alias}` : 'Shown under your account name'}
                  </Text>
                </View>
              </Pressable>

              {review.venue.lat !== null && review.venue.lng !== null ? (
                <Pressable
                  onPress={() => {
                    focusMapOn({
                      latitude: review.venue.lat as number,
                      longitude: review.venue.lng as number,
                    });
                    switchTab('map', {});
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${review.venue.name} on the map`}
                  className="mr-4 flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5 active:bg-accent">
                  <Icon as={MapPin} className="size-3.5 text-muted-foreground" />
                  <Text className="text-xs font-medium text-foreground">Locate</Text>
                </Pressable>
              ) : null}
            </Animated.View>
          ))}
        </Animated.View>
      )}

      {open ? (
        <ReviewSheet
          poi={
            {
              placeId: open.venue.google_place_id ?? undefined,
              name: open.venue.name,
              latitude: open.venue.lat ?? 0,
              longitude: open.venue.lng ?? 0,
            } satisfies SelectedPoi
          }
          venueId={open.venue.id}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setOpen(null);
            refetch();
          }}
        />
      ) : null}
    </View>
  );
}
