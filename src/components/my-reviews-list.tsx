import { useFocusEffect } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ReviewSheet } from '@/components/review-sheet';
import { StarRating } from '@/components/star-rating';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import type { SelectedPoi } from '@/lib/venues';

type MyReview = {
  stars: number;
  updated_at: string;
  venue: {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    google_place_id: string | null;
  };
};

type MyReviewsListProps = {
  userId: string;
};

export function MyReviewsList({ userId }: MyReviewsListProps) {
  const [reviews, setReviews] = React.useState<MyReview[] | null>(null);
  const [open, setOpen] = React.useState<MyReview | null>(null);
  const refetch = React.useCallback(() => {
    let active = true;

    supabase
      .from('reviews')
      .select('stars, updated_at, venue:venues(id, name, lat, lng, google_place_id)')
      .eq('author_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (active) setReviews((data as MyReview[] | null) ?? []);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // On focus rather than only on mount: the tab navigator keeps screens mounted,
  // so a review posted over on the Map tab would otherwise leave this stale.
  useFocusEffect(refetch);

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
        <View className="rounded-lg border border-dashed border-border p-6">
          <Text className="text-center text-sm text-muted-foreground">
            No reviews yet. Tap a place on the map to add your first.
          </Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-lg border border-border">
          {reviews.map((review, index) => (
            <Pressable
              key={review.venue.id}
              onPress={() => setOpen(review)}
              accessibilityRole="button"
              accessibilityLabel={`${review.venue.name}, ${review.stars} of 5`}
              className={`flex-row items-center gap-3 bg-card p-4 active:bg-accent ${
                index > 0 ? 'border-t border-border' : ''
              }`}>
              <View className="flex-1 gap-1">
                {/* numberOfLines truncates with an ellipsis rather than wrapping
                    a long venue name across the row. */}
                <Text numberOfLines={1} className="font-medium text-foreground">
                  {review.venue.name}
                </Text>
                <StarRating value={review.stars} size="sm" />
              </View>
            </Pressable>
          ))}
        </View>
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
