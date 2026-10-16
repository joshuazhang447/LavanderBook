import { Route, SquarePen } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AnswerSummaryCard } from '@/components/answer-summary';
import { openDirections } from '@/components/directions-button';
import { StarRating } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { List, Row, Section } from '@/components/ui/list';
import {
  Sheet,
  SheetBackButton,
  SheetCloseButton,
  SheetPush,
  SheetScrollView,
  SheetToolbar,
} from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import type { VenueSheetProps } from '@/components/venue-sheet';
import type { AnswerSummaryRow } from '@/lib/questionnaire';
import { postedLabel } from '@/lib/review-dates';
import { cn } from '@/lib/utils';
import { useVenueDetails, type Note, type VenueReview } from '@/lib/venue-details';

/**
 * Chenfeng's place card (guideline section 14.3): a sheet at medium height with
 * the map still usable around it, large on a drag. The place's name, its tags,
 * its rating and the bathroom answer; Directions and the review action as two
 * equal buttons; More Details pushed inside the sheet, with a back chevron and
 * a swipe; everyone's reviews as one section, the reader's own marked "You".
 *
 * The data, and every rule about what is shown, is the other skins' card's
 * (useVenueDetails).
 */
export function ChenfengVenueSheet({ venue, onClose, onWriteReview }: VenueSheetProps) {
  const details = useVenueDetails(venue);
  const [pushed, setPushed] = React.useState(false);
  const [popToken, setPopToken] = React.useState(0);

  return (
    <Sheet
      name="venue-sheet"
      detents={['medium', 'large']}
      undimmedThrough="medium"
      grouped
      accessibilityLabel={venue.name}
      onClose={onClose}>
      <SheetPush
        base={
          <PlaceCard
            details={details}
            name={venue.name}
            onDirections={() =>
              openDirections({
                latitude: venue.lat,
                longitude: venue.lng,
                placeId: venue.google_place_id,
              })
            }
            onWriteReview={onWriteReview}
            onMoreDetails={() => setPushed(true)}
          />
        }
        pushed={
          pushed ? (
            <DetailsPage
              name={venue.name}
              notes={details.notes}
              summary={details.summary}
              reviewCount={details.count}
              onBack={() => setPopToken((token) => token + 1)}
            />
          ) : null
        }
        popToken={popToken}
        onPopped={() => setPushed(false)}
      />
    </Sheet>
  );
}

type Details = ReturnType<typeof useVenueDetails>;

function PlaceCard({
  details,
  name,
  onDirections,
  onWriteReview,
  onMoreDetails,
}: {
  details: Details;
  name: string;
  onDirections: () => void;
  onWriteReview: () => void;
  onMoreDetails: () => void;
}) {
  const { reviews, average, count, bathroom, hasOwnReview, tags, nudge, hasTagPage } = details;
  // "New" means asked since this author last saved - not merely unanswered,
  // which would nag anyone who skipped an optional one.
  const action =
    nudge > 0
      ? nudge === 1
        ? 'Answer 1 New Question'
        : `Answer ${nudge} New Questions`
      : hasOwnReview
        ? 'Edit Review'
        : 'Write Review';
  const stacked = action.length > 12;

  return (
    <SheetScrollView contentContainerClassName="pb-10">
      <View className="flex-row items-start gap-3 px-4 pb-1 pt-5">
        <View className="flex-1 gap-1.5 pt-1">
          {/* One wrapping row: a tag says what kind of place this is, so it
              belongs beside the name, and wraps under a long one. */}
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text textStyle="title2" emphasized role="heading" className="text-foreground">
              {name}
            </Text>
            {tags.map((tag) => (
              <TagPill key={tag.slug} tag={tag} onPress={hasTagPage ? onMoreDetails : undefined} />
            ))}
          </View>
          {/* No stars before anyone has rated it: an empty row reads as zero
              out of five, not as "not rated yet". */}
          {count === 0 ? (
            <Text textStyle="subheadline" className="text-label-secondary">
              Listed by LavenderBook · no reviews yet
            </Text>
          ) : (
            <View
              className="flex-row items-center gap-2"
              accessible
              accessibilityLabel={`${average.toFixed(1)} out of 5 stars, ${
                count === 1 ? '1 review' : `${count} reviews`
              }`}>
              <StarRating value={average} size="md" />
              <Text textStyle="subheadline" className="text-label-secondary" style={{ fontVariant: ['tabular-nums'] }}>
                <Text textStyle="subheadline" className="text-foreground">
                  {average.toFixed(1)}
                </Text>
                {' · '}
                {count === 1 ? '1 review' : `${count} reviews`}
              </Text>
            </View>
          )}
          {bathroom ? (
            <Text textStyle="subheadline" className="text-label-secondary">
              Trans-friendly bathroom:{' '}
              <Text textStyle="subheadline" className="text-foreground">
                {bathroom.label}
              </Text>{' '}
              ({bathroom.tally})
            </Text>
          ) : null}
        </View>
        <SheetCloseButton />
      </View>

      {/* Side by side while both labels fit; a long one ("Answer 2 New
          Questions") stacks them, full width, rather than cutting it short. */}
      <View className={cn('gap-3 px-4 pb-6 pt-4', stacked ? 'flex-col' : 'flex-row')}>
        <Button size="lg" className={cn('px-4', !stacked && 'flex-1')} onPress={onDirections}>
          <Icon as={Route} size={19} filled weight="semibold" className="text-primary-foreground" />
          <Text>Directions</Text>
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className={cn('px-4', !stacked && 'flex-1')}
          onPress={onWriteReview}>
          <Icon as={SquarePen} size={19} weight="semibold" className="text-primary" />
          <Text>{action}</Text>
        </Button>
      </View>

      <List>
        {/* The same way in as the tag's chevron, gated on the same thing, so
            the two can never disagree about whether there is a page. */}
        {hasTagPage ? (
          <Section>
            <Row
              title="More Details"
              accessory="chevron"
              accessibilityHint="What LavenderBook checked, and what visitors reported."
              onPress={onMoreDetails}
            />
          </Section>
        ) : null}

        {reviews === null ? (
          <View className="items-center py-8">
            <ActivityIndicator />
          </View>
        ) : reviews.length === 0 ? (
          <Text textStyle="subheadline" className="py-6 text-center text-label-secondary">
            No written reviews yet.
          </Text>
        ) : (
          <Section header="Reviews">
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </Section>
        )}
      </List>
    </SheetScrollView>
  );
}

function ReviewRow({ review }: { review: VenueReview }) {
  // A period, or the day when the author shows dates: nothing finer exists.
  const posted = postedLabel(review.posted_period, review.posted_on);
  const [expanded, setExpanded] = React.useState(false);
  const [long, setLong] = React.useState(false);
  const name = review.author_name ?? 'Someone';

  return (
    <Row
      accessibilityLabel={[
        name,
        `${review.stars} stars`,
        posted,
        review.is_mine ? 'You' : null,
        review.body,
      ]
        .filter(Boolean)
        .join(', ')}>
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          {/* The alias when the review has one; venue_reviews decides. */}
          <Text textStyle="headline" numberOfLines={1} className="shrink text-foreground">
            {name}
          </Text>
          {/* With a different name on every review, the author cannot spot
              their own by name: is_mine marks it for them alone. */}
          {review.is_mine ? (
            <View className="rounded-full bg-tint-fill px-2 py-0.5">
              <Text textStyle="caption1" emphasized className="text-primary">
                You
              </Text>
            </View>
          ) : null}
        </View>
        <StarRating value={review.stars} size="xs" />
      </View>
      {posted ? (
        <Text textStyle="footnote" className="text-label-secondary">
          {posted}
        </Text>
      ) : null}
      {review.body ? (
        <View className="mt-1">
          <Text
            textStyle="body"
            numberOfLines={expanded ? undefined : 6}
            onTextLayout={(event) => {
              if (!expanded && event.nativeEvent.lines.length >= 6) setLong(true);
            }}
            className="text-foreground">
            {review.body}
          </Text>
          {long && !expanded ? (
            <Pressable
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="Read the whole review"
              hitSlop={8}
              className="self-end active:opacity-30">
              <Text textStyle="body" className="text-primary">
                more
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Row>
  );
}

/**
 * What LavenderBook asserts about this place, and what visitors reported - in
 * that order, and never blurred together: two sections, each with a header
 * saying who is speaking.
 */
function DetailsPage({
  name,
  notes,
  summary,
  reviewCount,
  onBack,
}: {
  name: string;
  notes: Note[];
  summary: AnswerSummaryRow[];
  reviewCount: number;
  onBack: () => void;
}) {
  // Grouped under the tag now asking, in the server's order; questions no tag
  // asks any more come last.
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
    <View className="flex-1 bg-grouped">
      <SheetToolbar
        belowGrabber
        leading={<SheetBackButton onPress={onBack} />}
        title={name}
      />
      <SheetScrollView contentContainerClassName="pb-10 pt-2">
        <List>
          {notes.length > 0 ? (
            <Section header="What LavenderBook Checked" footer="Written by LavenderBook, not by visitors.">
              {notes.map((note) => (
                <Row key={note.id} title={note.body} />
              ))}
            </Section>
          ) : null}

          {summary.length > 0 ? (
            <View className="gap-3">
              <View className="gap-1 px-4">
                <Text textStyle="headline" role="heading" className="text-label-secondary">
                  What Visitors Reported
                </Text>
                {/* Coverage, so "7 of 9 said yes" is read against how many
                    reviews had answers at all. */}
                <Text textStyle="footnote" className="text-label-secondary">
                  Answers from {answered} of {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}.
                  Visitors&apos; own accounts, not checked by LavenderBook.
                </Text>
              </View>
              {groups.map((group) => (
                <View key={group.key} className="gap-2">
                  {groups.length > 1 || !group.tag ? (
                    <View className="flex-row px-4">
                      {group.tag ? (
                        <TagPill tag={group.tag} />
                      ) : (
                        <Text textStyle="footnote" className="text-label-secondary">
                          No longer asked here
                        </Text>
                      )}
                    </View>
                  ) : null}
                  <Section>
                    {group.rows.map((row) => (
                      <Row key={row.questionId} className="py-3.5">
                        <AnswerSummaryCard row={row} />
                      </Row>
                    ))}
                  </Section>
                </View>
              ))}
            </View>
          ) : null}
        </List>
      </SheetScrollView>
    </View>
  );
}
