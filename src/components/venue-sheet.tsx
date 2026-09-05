import { Portal } from '@rn-primitives/portal';
import { CircleUser, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { StarRating } from '@/components/star-rating';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { NearbyVenue } from '@/lib/use-nearby-venues';

type Answer = Database['public']['Enums']['answer'];

type VenueReview = {
  id: string;
  stars: number;
  body: string | null;
  created_at: string;
  author: { display_name: string } | null;
};

type Ratings = {
  review_count: number;
  avg_stars: number;
  trans_bathroom_yes: number;
  trans_bathroom_no: number;
  trans_bathroom_unsure: number;
};

const ANSWER_LABEL: Record<Answer, string> = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Not sure',
};

/**
 * The answer most reviewers gave, with how many of them agreed.
 *
 * The tally matters here more than usual: for a safety question, 3 of 4 reads
 * very differently from 3 of 3, and a bare "Yes" hides that difference.
 */
function bathroomConsensus(ratings: Ratings): { label: string; tally: string } | null {
  const counts: [Answer, number][] = [
    ['yes', ratings.trans_bathroom_yes],
    ['no', ratings.trans_bathroom_no],
    ['unsure', ratings.trans_bathroom_unsure],
  ];
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  if (total === 0) return null;

  const [answer, count] = counts.reduce((best, current) => (current[1] > best[1] ? current : best));
  return { label: ANSWER_LABEL[answer], tally: `${count} of ${total}` };
}

function ReviewRow({ review }: { review: VenueReview }) {
  return (
    <View className="gap-2 border-t border-border py-4">
      <View className="flex-row items-center gap-2">
        <View className="size-8 items-center justify-center rounded-full bg-muted">
          <Icon as={CircleUser} className="size-5 text-muted-foreground" />
        </View>
        <Text numberOfLines={1} className="flex-1 font-medium text-foreground">
          {review.author?.display_name ?? 'Someone'}
        </Text>
        <StarRating value={review.stars} size="sm" />
      </View>
      {review.body ? (
        <Text className="text-sm leading-5 text-muted-foreground">{review.body}</Text>
      ) : null}
    </View>
  );
}

type VenueSheetProps = {
  venue: NearbyVenue;
  onClose: () => void;
};

/**
 * Read-only detail for a reviewed venue. Writing happens from the Google place
 * label, which opens the review form instead - this sheet never edits.
 *
 * The sheet chrome mirrors ReviewSheet rather than sharing it: that one wraps a
 * keyboard-avoiding form, this one a scroll list, and the shared part is small.
 */
export function VenueSheet({ venue, onClose }: VenueSheetProps) {
  const [ratings, setRatings] = React.useState<Ratings | null>(null);
  const [reviews, setReviews] = React.useState<VenueReview[] | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  // A definite height for the ScrollView to flex into; maxHeight alone would let
  // it collapse.
  const sheetHeight = Math.round(windowHeight * 0.62);

  React.useEffect(() => {
    let active = true;

    supabase
      .from('venue_ratings')
      .select('review_count, avg_stars, trans_bathroom_yes, trans_bathroom_no, trans_bathroom_unsure')
      .eq('venue_id', venue.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setRatings(data as Ratings | null);
      });

    supabase
      .from('reviews')
      .select('id, stars, body, created_at, author:profiles(display_name)')
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (active) setReviews((data as VenueReview[] | null) ?? []);
      });

    return () => {
      active = false;
    };
  }, [venue.id]);

  const average = Number(ratings?.avg_stars ?? venue.avg_stars ?? 0);
  const count = ratings?.review_count ?? venue.review_count;
  const bathroom = ratings ? bathroomConsensus(ratings) : null;

  return (
    <Portal name="venue-sheet">
      <View className="absolute inset-0 justify-end">
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          className="absolute inset-0">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="flex-1 bg-black/50"
          />
        </Animated.View>

        <Animated.View
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(200)}
          style={{ height: sheetHeight }}
          className="overflow-hidden rounded-t-3xl border-t border-border bg-background">
          <View className="flex-row items-start gap-3 px-5 pb-3 pt-5">
            <View className="flex-1 gap-2">
              <Text className="text-xl font-semibold text-foreground">{venue.name}</Text>
              <View className="flex-row items-center gap-2">
                <StarRating value={average} size="sm" />
                <Text className="text-sm font-medium text-foreground">{average.toFixed(1)}</Text>
                <Text className="text-sm text-muted-foreground">
                  {count === 1 ? '1 review' : `${count} reviews`}
                </Text>
              </View>
              {bathroom ? (
                <Text className="text-sm text-muted-foreground">
                  Trans-friendly bathroom:{' '}
                  <Text className="font-medium text-foreground">{bathroom.label}</Text>{' '}
                  <Text className="text-xs">({bathroom.tally})</Text>
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="rounded-full p-2 active:bg-accent">
              <Icon as={X} className="size-5 text-muted-foreground" />
            </Pressable>
          </View>

          {reviews === null ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator />
            </View>
          ) : (
            <ScrollView className="flex-1" contentContainerClassName="px-5 pb-6">
              {reviews.length === 0 ? (
                <Text className="py-8 text-center text-sm text-muted-foreground">
                  No written reviews yet.
                </Text>
              ) : (
                reviews.map((review) => <ReviewRow key={review.id} review={review} />)
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Portal>
  );
}
