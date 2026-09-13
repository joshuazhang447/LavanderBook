import { Portal } from '@rn-primitives/portal';
import { ChevronLeft, ChevronRight, CircleUser, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInLeft,
  SlideInRight,
  SlideOutDown,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';

import { AnswerSummaryCard } from '@/components/answer-summary';
import { DirectionsButton } from '@/components/directions-button';
import { StarRating } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { consensus } from '@/lib/answers';
import { useAuth } from '@/lib/auth';
import {
  fetchAnswerSummary,
  fetchNewQuestionCount,
  type AnswerSummaryRow,
} from '@/lib/questionnaire';
import { supabase } from '@/lib/supabase';
import type { NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';

type VenueReview = {
  id: string;
  author_id: string;
  stars: number;
  body: string | null;
  created_at: string;
  author: { display_name: string } | null;
};

/** An admin-written bullet about this venue. */
type Note = {
  id: string;
  body: string;
};

type Ratings = {
  review_count: number;
  avg_stars: number;
  trans_bathroom_yes: number;
  trans_bathroom_no: number;
  trans_bathroom_unsure: number;
};

/** The bathroom answer most reviewers gave, through the helper every yes/no tag question uses. */
function bathroomConsensus(ratings: Ratings): { label: string; tally: string } | null {
  const top = consensus({
    yes: ratings.trans_bathroom_yes,
    no: ratings.trans_bathroom_no,
    unsure: ratings.trans_bathroom_unsure,
  });
  return top ? { label: top.label, tally: `${top.count} of ${top.total}` } : null;
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

type VenueSheetProps = {
  venue: NearbyVenue;
  onClose: () => void;
  /** Hands off to the review form for this venue. */
  onWriteReview: () => void;
};

/**
 * Detail for a reviewed venue: everyone's reviews, read-only, with a single
 * button handing off to the review form.
 *
 * The sheet chrome mirrors ReviewSheet rather than sharing it: that one wraps a
 * keyboard-avoiding form, this one a scroll list, and the shared part is small.
 */
export function VenueSheet({ venue, onClose, onWriteReview }: VenueSheetProps) {
  const { session } = useAuth();
  const [ratings, setRatings] = React.useState<Ratings | null>(null);
  const [reviews, setReviews] = React.useState<VenueReview[] | null>(null);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [summary, setSummary] = React.useState<AnswerSummaryRow[]>([]);
  const [newQuestions, setNewQuestions] = React.useState(0);
  const [page, setPage] = React.useState<'reviews' | 'tag'>('reviews');
  /** The reviews page animates in only when it is being returned to. */
  const [returning, setReturning] = React.useState(false);
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

    // The embed names its foreign key. `profiles(...)` on its own was
    // unambiguous until admin_edited_by was added, which gave reviews a second
    // route to profiles; PostgREST then refuses the embed rather than guessing,
    // and every review silently disappeared behind "No written reviews yet".
    supabase
      .from('reviews')
      .select(
        'id, author_id, stars, body, created_at, author:profiles!reviews_author_id_fkey(display_name)'
      )
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        // An empty list and a failed request are not the same thing, and
        // rendering them the same way is what hid this for a day.
        if (error) console.error('Failed to load reviews', error);
        setReviews((data as VenueReview[] | null) ?? []);
      });

    // Public read: venue_notes is selectable by anyone, which is the point of
    // writing them. Fetched up front rather than when a tag is tapped, because
    // whether there is anything to show is what decides if the tag is tappable
    // at all.
    supabase
      .from('venue_notes')
      .select('id, body')
      .eq('venue_id', venue.id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (active) setNotes((data as Note[] | null) ?? []);
      });

    // Same reasoning as the notes: whether anyone has answered anything is what
    // decides whether the tag pill opens a page at all.
    fetchAnswerSummary(venue.id)
      .then((rows) => {
        if (active) setSummary(rows);
      })
      .catch(() => {
        if (active) setSummary([]);
      });

    return () => {
      active = false;
    };
  }, [venue.id]);

  const userId = session?.user.id ?? null;

  // Only a signed-in author can have new questions waiting; the function is
  // not even callable signed out.
  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchNewQuestionCount(venue.id)
      .then((n) => {
        if (active) setNewQuestions(n);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [venue.id, userId]);

  const average = Number(ratings?.avg_stars ?? venue.avg_stars ?? 0);
  const count = ratings?.review_count ?? venue.review_count;
  const bathroom = ratings ? bathroomConsensus(ratings) : null;
  // Signed out, we cannot know - the review sheet will ask them to sign in.
  const hasOwnReview = !!session && !!reviews?.some((r) => r.author_id === session.user.id);
  const tags = venueTags(venue);
  const nudge = userId ? newQuestions : 0;
  const hasTagPage = notes.length > 0 || summary.length > 0;

  function openTagPage() {
    setReturning(true);
    setPage('tag');
  }

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
        </Animated.View>
      </View>
    </Portal>
  );
}
