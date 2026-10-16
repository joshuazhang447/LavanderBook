import { ChevronLeft, ChevronRight, CircleUser, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';

import { AnswerSummaryCard } from '@/components/answer-summary';
import { ChenfengVenueSheet } from '@/components/chenfeng/venue-sheet';
import { DirectionsButton } from '@/components/directions-button';
import { StarRating } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import type { AnswerSummaryRow } from '@/lib/questionnaire';
import { postedLabel } from '@/lib/review-dates';
import { useSkin } from '@/lib/skin';
import type { NearbyVenue } from '@/lib/use-nearby-venues';
import { useVenueDetails, type Note, type VenueReview } from '@/lib/venue-details';

function ReviewRow({ review }: { review: VenueReview }) {
  // A period ("A few weeks ago"), or the day when the author shows dates. The
  // server sends nothing finer, so nothing here can be finer either.
  const posted = postedLabel(review.posted_period, review.posted_on);

  return (
    <View className="gap-2 border-t border-border py-4">
      <View className="flex-row items-center gap-2">
        <View className="size-8 items-center justify-center rounded-full bg-muted">
          <Icon as={CircleUser} className="size-5 text-muted-foreground" />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            {/* The alias when the review has one - venue_reviews decides, and
                says nothing about which it is. */}
            <Text numberOfLines={1} className="shrink font-medium text-foreground">
              {review.author_name ?? 'Someone'}
            </Text>
            {/* With a different name on every review, the author cannot spot
                their own by name any more. is_mine is answered for the caller
                alone, so this marks it for them and for nobody else. */}
            {review.is_mine ? (
              <Badge variant="secondary">
                <Text>You</Text>
              </Badge>
            ) : null}
          </View>
          {posted ? <Text className="text-xs text-muted-foreground">{posted}</Text> : null}
        </View>
        <StarRating value={review.stars} size="sm" />
      </View>
      {review.body ? (
        <Text className="text-sm leading-5 text-muted-foreground">{review.body}</Text>
      ) : null}
    </View>
  );
}

type TagPageProps = {
  notes: Note[];
  summary: AnswerSummaryRow[];
  reviewCount: number;
  onBack: () => void;
};

/**
 * Everything behind the tag pill: what we assert about this place, and what
 * visitors reported about it - in that order, and never blurred together.
 *
 * The two sections make different claims. "We confirmed this shelter is
 * staffed overnight" and "some visitors thought it was" are not the same
 * sentence, and the design doc treats keeping them visibly apart as a
 * correctness requirement, not a layout preference. Hence two headings that
 * each say who is speaking, and a rule between them.
 */
function TagPage({ notes, summary, reviewCount, onBack }: TagPageProps) {
  // Grouped under the tag currently asking, in the order the server sent them;
  // the tagless group - questions nothing here asks any more - comes last.
  const groups: { key: string; tag: AnswerSummaryRow['tag']; rows: AnswerSummaryRow[] }[] = [];
  for (const row of summary) {
    const key = row.tag?.id ?? 'none';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, tag: row.tag, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  const answered = summary[0]?.answeredReviews ?? 0;

  return (
    <View className="flex-1">
      <View className="flex-row items-center px-4 pb-1">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to reviews"
          className="flex-row items-center gap-0.5 rounded-full py-1.5 pl-1 pr-3 active:bg-accent">
          <Icon as={ChevronLeft} className="size-5 text-muted-foreground" />
          <Text className="text-sm text-muted-foreground">Reviews</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-5 pb-6">
        {notes.length > 0 ? (
          <View className="gap-3">
            <View className="gap-0.5">
              <Text className="font-medium text-foreground">What we checked</Text>
              <Text className="text-xs text-muted-foreground">
                Written by LavenderBook, not by visitors.
              </Text>
            </View>
            {notes.map((note) => (
              <View key={note.id} className="flex-row gap-2">
                <Text className="text-sm leading-5 text-muted-foreground">{'\u2022'}</Text>
                <Text className="flex-1 text-sm leading-5 text-foreground">{note.body}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {notes.length > 0 && summary.length > 0 ? <Separator /> : null}

        {summary.length > 0 ? (
          <View className="gap-4">
            <View className="gap-0.5">
              <Text className="font-medium text-foreground">What visitors reported</Text>
              {/* Coverage, so "7 of 9 said yes" further down is read against how
                  many reviews had any answers at all - reviews written before
                  a question existed are not in any tally, and are not gaps. */}
              <Text className="text-xs text-muted-foreground">
                Answers from {answered} of {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}.
                Visitors&apos; own accounts, not checked by LavenderBook.
              </Text>
            </View>
            {groups.map((group) => (
              <View key={group.key} className="gap-4">
                {group.tag ? (
                  <View className="flex-row">
                    <TagPill tag={group.tag} />
                  </View>
                ) : (
                  <Text className="text-xs text-muted-foreground">No longer asked here</Text>
                )}
                {group.rows.map((row) => (
                  <AnswerSummaryCard key={row.questionId} row={row} />
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

export type VenueSheetProps = {
  venue: NearbyVenue;
  onClose: () => void;
  /** Hands off to the review form for this venue. */
  onWriteReview: () => void;
};

export function VenueSheet(props: VenueSheetProps) {
  const { skin } = useSkin();
  // Chenfeng's place card is a sheet with detents and a page pushed inside
  // (its own file); Basic and Material keep this one. Same data, same hook.
  return skin === 'chenfeng' ? <ChenfengVenueSheet {...props} /> : <BasicVenueSheet {...props} />;
}

function BasicVenueSheet({ venue, onClose, onWriteReview }: VenueSheetProps) {
  const { reviews, notes, summary, average, count, bathroom, hasOwnReview, tags, nudge, hasTagPage } =
    useVenueDetails(venue);
  const [page, setPage] = React.useState<'reviews' | 'tag'>('reviews');
  /** The reviews page animates in only when it is being returned to. */
  const [returning, setReturning] = React.useState(false);
  function openTagPage() {
    setReturning(true);
    setPage('tag');
  }

  return (
    // Opens most of the way up; its handle and top row drag it to full height.
    <BottomSheet
      name="venue-sheet"
      onClose={onClose}
      accessibilityLabel={venue.name}
      partial={0.62}
      header={
        <View className="flex-row items-start gap-3 px-5 pb-3 pt-2">
          <View className="flex-1 gap-2">
            {/* One wrapping row: a tag says what kind of place this is, so it
                belongs beside the name. Nothing is given shrink-0 - flex-wrap
                moves the pills to their own line when the name is long, which
                is what should happen, and a non-shrinkable name would instead
                overflow the sheet. */}
            <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <Text className="text-xl font-semibold text-foreground">{venue.name}</Text>
              {tags.map((tag) => (
                <TagPill
                  key={tag.slug}
                  tag={tag}
                  // No chevron while the page is already open, and none when
                  // there is nothing behind the tag to open.
                  onPress={hasTagPage && page === 'reviews' ? openTagPage : undefined}
                />
              ))}
            </View>
            <View className="flex-row items-center gap-2">
              {/* No star row before anyone has rated it. An empty one reads as
                  zero out of five rather than as "not rated yet", and this
                  sheet is where someone decides whether to go somewhere. */}
              {count === 0 ? (
                <Text className="text-sm text-muted-foreground">
                  Listed by LavenderBook · no reviews yet
                </Text>
              ) : (
                <>
                  <StarRating value={average} size="sm" />
                  <Text className="text-sm font-medium text-foreground">
                    {average.toFixed(1)}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {count === 1 ? '1 review' : `${count} reviews`}
                  </Text>
                </>
              )}
            </View>
            {bathroom ? (
              <Text className="text-sm text-muted-foreground">
                Trans-friendly bathroom:{' '}
                <Text className="font-medium text-foreground">{bathroom.label}</Text>{' '}
                <Text className="text-xs">({bathroom.tally})</Text>
              </Text>
            ) : null}

            {/* The same destination as the tag pill's chevron, and gated on
                the same condition so the two can never disagree about whether
                there is a page. The pill is easy to miss - it reads as a
                label first - so the way in says so in words as well.

                Borrowed from the Locate row in venue-list: a rounded outline
                row is this app's small secondary action. A coloured link
                would not work here, because --primary is near-black in light
                mode and near-white in dark; colour carries no meaning. */}
            {hasTagPage && page === 'reviews' ? (
              <Pressable
                onPress={openTagPage}
                accessibilityRole="button"
                accessibilityLabel="More details: what LavenderBook checked, and what visitors reported"
                className="mt-0.5 flex-row items-center gap-1 self-start rounded-full border border-border py-1.5 pl-3 pr-2 active:bg-accent">
                <Text className="text-xs font-medium text-foreground">More details</Text>
                <Icon as={ChevronRight} className="size-3.5 text-muted-foreground" />
              </Pressable>
            ) : null}
          </View>
          <DirectionsButton
            name={venue.name}
            latitude={venue.lat}
            longitude={venue.lng}
            placeId={venue.google_place_id}
          />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="rounded-full p-2 active:bg-accent">
            <Icon as={X} className="size-5 text-muted-foreground" />
          </Pressable>
        </View>
      }>
      {/* Two pages, one at a time, both absolutely filling this box so the
          one leaving does not shove the one arriving around while they
          cross. Each always enters and leaves on the same side, so the
          motion reads as a push out and a pop back. */}
      <View className="flex-1">
        {page === 'reviews' ? (
          <Animated.View
            key="reviews"
            entering={returning ? SlideInLeft.duration(220) : undefined}
            exiting={SlideOutLeft.duration(180)}
            className="absolute inset-0">
            {reviews === null ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : (
              <ScrollView className="flex-1" contentContainerClassName="px-5 pb-4">
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
        ) : (
          <Animated.View
            key="tag"
            entering={SlideInRight.duration(220)}
            exiting={SlideOutRight.duration(180)}
            className="absolute inset-0">
            <TagPage
              notes={notes}
              summary={summary}
              reviewCount={count}
              onBack={() => setPage('reviews')}
            />
          </Animated.View>
        )}
      </View>

      {/* Pinned below the list rather than inside it, so it stays reachable
          however many reviews a venue has. */}
      <View className="border-t border-border px-5 pb-6 pt-4">
        {/* "New" means asked since this author last saved - not merely
            unanswered, which would nag anyone who skipped an optional one. */}
        <Button onPress={onWriteReview}>
          <Text>
            {nudge > 0
              ? nudge === 1
                ? 'Answer 1 new question'
                : `Answer ${nudge} new questions`
              : hasOwnReview
                ? 'Edit your review'
                : 'Post review'}
          </Text>
        </Button>
      </View>
    </BottomSheet>
  );
}
