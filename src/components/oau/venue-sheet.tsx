import {
  ChevronRight,
  CircleUser,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  ListChecks,
  Route,
  SquarePen,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';

import { CONTACT_ICONS, contactSpoken } from '@/components/contact-list';
import { openDirections } from '@/components/directions-button';
import { LinkedText, openLink } from '@/components/linked-text';
import { FactChip, Note, NoteCheck } from '@/components/oau/note';
import { Ribbon } from '@/components/oau/ribbon';
import { ReportReviewPage } from '@/components/report-review';
import { StarRating } from '@/components/star-rating';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { VenueSheetProps } from '@/components/venue-sheet';
import { TagPage } from '@/components/venue-tag-page';
import {
  CONTACT_TEXT,
  DETAILS_TEXT,
  detailsTeaser,
  LIST_TEXT,
  VOICES_TEXT,
} from '@/lib/directory-text';
import { MASK_TEXT, moderationStatus, REPORT_TEXT, spokenMasked, STATUS_TEXT } from '@/lib/moderation-text';
import { postedLabel } from '@/lib/review-dates';
import { isMapped } from '@/lib/use-nearby-venues';
import { cn } from '@/lib/utils';
import { contactDisplay, contactHref, contactTitle, type VenueContact } from '@/lib/venue-contacts';
import { useVenueDetails, type VenueReview } from '@/lib/venue-details';

const PRESSABLE_WEB = Platform.select({ web: 'cursor-pointer' });

/** A small rounded tag beside a reviewer's name: "You", or the review's status. */
function NameTag({ label, box, text }: { label: string; box: string; text: string }) {
  return (
    <View className={cn('rounded-full px-2 py-0.5', box)}>
      <Text oauStyle="micro" className={text}>
        {label}
      </Text>
    </View>
  );
}

/**
 * One visitor's review, as a card of its own on the paper. The reader's own is
 * marked "You" in the flag's pink (with a different name on every review, they
 * cannot spot it by name); its status, when held or rejected, is shown to them
 * alone - nobody else's is ever sent. Same rules as every skin's review row.
 */
function OauReviewCard({ review, onReport }: { review: VenueReview; onReport: () => void }) {
  const posted = postedLabel(review.posted_period, review.posted_on);
  const status = review.is_mine ? moderationStatus(review.status) : null;
  const masked = !!review.unmasked_body;
  const [revealed, setRevealed] = React.useState(false);
  const body = masked && revealed ? review.unmasked_body : review.body;

  return (
    <View className="gap-2.5 rounded-[18px] border border-border bg-card p-4">
      <View className="flex-row items-center gap-2.5">
        <View className="size-9 items-center justify-center rounded-full bg-muted">
          <Icon as={CircleUser} className="size-5 text-muted-foreground" />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text oauStyle="label" numberOfLines={1} className="shrink text-foreground">
              {review.author_name ?? 'Someone'}
            </Text>
            {review.is_mine ? (
              <NameTag label="You" box="bg-oau-pink" text="text-oau-pink-foreground" />
            ) : null}
            {status === 'held' ? (
              <NameTag label={STATUS_TEXT.held.label} box="bg-muted" text="text-muted-foreground" />
            ) : status === 'rejected' ? (
              <NameTag
                label={STATUS_TEXT.rejected.label}
                box="bg-caution"
                text="text-caution-foreground"
              />
            ) : null}
          </View>
          {posted ? (
            <Text oauStyle="caption" className="text-muted-foreground">
              {posted}
            </Text>
          ) : null}
        </View>
        <StarRating value={review.stars} size="sm" />
        {/* A sibling of the row's text, never wrapping it: a button inside a
            button breaks the web. Not on your own review. */}
        {review.is_mine ? null : review.reported_by_me ? (
          <Text oauStyle="caption" className="text-muted-foreground">
            {REPORT_TEXT.reported}
          </Text>
        ) : (
          <Pressable
            onPress={onReport}
            accessibilityRole="button"
            accessibilityLabel={REPORT_TEXT.actionLabel}
            hitSlop={8}
            className={cn('rounded-full p-1.5 active:bg-muted', PRESSABLE_WEB)}>
            <Icon as={Flag} className="size-4 text-muted-foreground" />
          </Pressable>
        )}
      </View>
      {status === 'held' ? (
        <Text oauStyle="caption" className="text-muted-foreground">
          {STATUS_TEXT.held.line}
        </Text>
      ) : status === 'rejected' ? (
        <Text oauStyle="caption" className="text-destructive">
          {STATUS_TEXT.rejected.formLine}
        </Text>
      ) : null}
      {body ? (
        <Text
          oauStyle="body"
          className="text-foreground"
          accessibilityLabel={masked && !revealed ? spokenMasked(body) : undefined}>
          {body}
        </Text>
      ) : null}
      {masked ? (
        <Pressable
          onPress={() => setRevealed(!revealed)}
          accessibilityRole="button"
          className={cn('flex-row items-center gap-1.5 self-start py-1 active:opacity-60', PRESSABLE_WEB)}>
          <Icon as={revealed ? EyeOff : Eye} className="size-4 text-primary" />
          <Text oauStyle="label" className="text-primary">
            {revealed ? MASK_TEXT.hide : MASK_TEXT.show}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** How to reach the place: a card on the paper, a row per contact. */
function OauContactList({ contacts }: { contacts: readonly VenueContact[] }) {
  return (
    <View className="overflow-hidden rounded-[18px] border border-border bg-card">
      {contacts.map((contact, index) => {
        const web = contact.kind === 'website' || contact.kind === 'link';
        return (
          <Pressable
            key={contact.id}
            onPress={() => openLink(contactHref(contact))}
            accessibilityRole="link"
            accessibilityLabel={contactSpoken(contact)}
            className={cn(
              'flex-row items-center gap-3 px-4 py-2.5 active:bg-muted',
              index > 0 && 'border-t border-border',
              Platform.select({ web: 'cursor-pointer transition-colors hover:bg-muted' })
            )}>
            <View className="size-9 items-center justify-center rounded-full bg-wash">
              <Icon as={CONTACT_ICONS[contact.kind]} className="size-[18px] text-primary" />
            </View>
            <View className="flex-1">
              <Text oauStyle="caption" numberOfLines={1} className="text-muted-foreground">
                {contactTitle(contact)}
              </Text>
              <Text oauStyle="label" numberOfLines={1} className="text-foreground">
                {contactDisplay(contact)}
              </Text>
            </View>
            {web ? <Icon as={ExternalLink} className="size-4 text-muted-foreground" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The way in to what is behind the tags - what LavenderBook checked and what
 * visitors reported - as a card that says what is inside. Outside the note: the
 * page holds visitors' answers too, and the note is LavenderBook's alone.
 */
function DetailsLink({ line, onPress }: { line: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${DETAILS_TEXT.spoken}. ${line}`}
      className={cn(
        'flex-row items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3 active:bg-muted',
        Platform.select({ web: 'cursor-pointer transition-colors hover:bg-muted' })
      )}>
      <View className="size-9 items-center justify-center rounded-full bg-wash">
        <Icon as={ListChecks} className="size-[18px] text-primary" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text oauStyle="label" className="text-foreground">
          {DETAILS_TEXT.title}
        </Text>
        <Text oauStyle="caption" className="text-muted-foreground">
          {line}
        </Text>
      </View>
      <Icon as={ChevronRight} className="size-5 text-muted-foreground" />
    </Pressable>
  );
}

function SectionHeading({ title, line }: { title: string; line?: string }) {
  return (
    <View className="gap-0.5">
      <Text oauStyle="heading" role="heading" className="text-foreground">
        {title}
      </Text>
      {line ? (
        <Text oauStyle="caption" className="text-muted-foreground">
          {line}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * OAU's place card (LavenderBookStyle/oau-style-guide.md, section 13.6): paper
 * with the tab's colour washing in at the top, the place's kinds as ribbons
 * over its name, and the two voices kept apart under headings of their own -
 * LavenderBook's description and checks on a signed note, then how to reach
 * the place, then visitors' reviews as cards. Directions and the review action
 * stay at the foot as two stickers.
 *
 * The data and every rule about what is shown are the other skins' cards'
 * (useVenueDetails); the pages - reviews, the details behind the tags, a
 * report - and the two-step leave are Basic's, for the same reasons.
 */
export function OauVenueSheet({ venue, onClose, onWriteReview }: VenueSheetProps) {
  const {
    reviews,
    description,
    contacts,
    notes,
    summary,
    average,
    count,
    bathroom,
    hasOwnReview,
    tags,
    nudge,
    hasTagPage,
    refetch,
  } = useVenueDetails(venue);
  const [page, setPage] = React.useState<'reviews' | 'tag' | 'report'>('reviews');
  const [reporting, setReporting] = React.useState<VenueReview | null>(null);
  const [returning, setReturning] = React.useState(false);
  // Leaving takes two steps, as Basic's card explains: the pages lose their
  // exits first, so only the sheet's own slide down plays.
  const [leaving, setLeaving] = React.useState<'close' | 'review' | null>(null);
  const told = React.useRef(false);
  React.useEffect(() => {
    if (!leaving || told.current) return;
    told.current = true;
    if (leaving === 'close') onClose();
    else onWriteReview();
  }, [leaving, onClose, onWriteReview]);
  const close = React.useCallback(() => setLeaving('close'), []);

  function openTagPage() {
    setReturning(true);
    setPage('tag');
  }
  function openReport(review: VenueReview) {
    setReturning(true);
    setReporting(review);
    setPage('report');
  }

  const teaser = detailsTeaser(notes, summary[0]?.answeredReviews ?? 0);
  const action =
    nudge > 0
      ? nudge === 1
        ? 'Answer 1 new question'
        : `Answer ${nudge} new questions`
      : hasOwnReview
        ? 'Edit your review'
        : 'Post review';
  // Side by side while both labels fit; a long one stacks them, full width.
  const stacked = action.length > 12;
  const mapped = isMapped(venue);

  return (
    <BottomSheet
      name="venue-sheet"
      onClose={close}
      accessibilityLabel={venue.name}
      partial={0.62}
      keyboardAvoiding
      header={
        <View className="flex-row items-start gap-3 px-5 pb-3 pt-1">
          <View className="flex-1 gap-2">
            {tags.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Ribbon
                    key={tag.slug}
                    tag={tag}
                    onPress={hasTagPage && page === 'reviews' ? openTagPage : undefined}
                  />
                ))}
              </View>
            ) : null}
            <Text oauStyle="title" role="heading" className="text-foreground">
              {venue.name}
            </Text>
            {count === 0 ? (
              description ? null : (
                <Text oauStyle="callout" className="text-muted-foreground">
                  {LIST_TEXT.listedNoReviews}
                </Text>
              )
            ) : (
              <View className="flex-row items-center gap-2">
                <StarRating value={average} size="sm" />
                <Text oauStyle="label" className="text-star-foreground">
                  {average.toFixed(1)}
                </Text>
                <Text oauStyle="callout" className="text-muted-foreground">
                  {count === 1 ? '1 review' : `${count} reviews`}
                </Text>
              </View>
            )}
            {bathroom ? (
              <FactChip
                question="Trans-friendly bathroom:"
                answer={bathroom.label}
                tally={bathroom.tally}
              />
            ) : null}
          </View>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={6}
            className={cn(
              'size-9 items-center justify-center rounded-full border-[1.5px] border-outline-ink bg-card active:scale-95',
              PRESSABLE_WEB
            )}>
            <Icon as={X} className="size-[18px] text-foreground" />
          </Pressable>
        </View>
      }>
      <View className="flex-1">
        {page === 'reviews' ? (
          <Animated.View
            key="reviews"
            entering={returning ? SlideInLeft.duration(220) : undefined}
            exiting={leaving ? undefined : SlideOutLeft.duration(180)}
            className="absolute inset-0">
            <ScrollView className="flex-1" contentContainerClassName="gap-5 px-5 pb-6 pt-1">
              {description || teaser.points.length > 0 ? (
                <Note>
                  {description ? (
                    <Text oauStyle="body" className="text-foreground">
                      <LinkedText text={description} />
                    </Text>
                  ) : null}
                  {teaser.points.length > 0 ? (
                    <View className={cn('gap-1.5', description && 'mt-3')}>
                      {teaser.points.map((point, index) => (
                        <NoteCheck key={index} numberOfLines={2}>
                          {point}
                        </NoteCheck>
                      ))}
                    </View>
                  ) : null}
                </Note>
              ) : null}

              {/* The same destination as a ribbon's chevron, gated the same way. */}
              {hasTagPage ? <DetailsLink line={teaser.line} onPress={openTagPage} /> : null}

              {contacts.length > 0 ? (
                <View className="gap-2">
                  <SectionHeading title={CONTACT_TEXT.heading} />
                  <OauContactList contacts={contacts} />
                </View>
              ) : null}

              <View className="gap-3">
                <SectionHeading title={VOICES_TEXT.fromVisitors} line={VOICES_TEXT.visitorsLine} />
                {reviews === null ? (
                  <View className="items-center py-6">
                    <ActivityIndicator />
                  </View>
                ) : reviews.length === 0 ? (
                  <Text oauStyle="callout" className="py-4 text-center text-muted-foreground">
                    No written reviews yet.
                  </Text>
                ) : (
                  reviews.map((review) => (
                    <OauReviewCard
                      key={review.id}
                      review={review}
                      onReport={() => openReport(review)}
                    />
                  ))
                )}
              </View>
            </ScrollView>
          </Animated.View>
        ) : page === 'report' && reporting ? (
          <Animated.View
            key="report"
            entering={SlideInRight.duration(220)}
            exiting={leaving ? undefined : SlideOutRight.duration(180)}
            className="absolute inset-0">
            <ReportReviewPage
              key={reporting.id}
              reviewId={reporting.id}
              authorName={reporting.author_name ?? 'Someone'}
              onBack={() => setPage('reviews')}
              onSent={refetch}
            />
          </Animated.View>
        ) : (
          <Animated.View
            key="tag"
            entering={SlideInRight.duration(220)}
            exiting={leaving ? undefined : SlideOutRight.duration(180)}
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

      {page === 'report' ? null : (
        <View
          className={cn(
            'gap-3 border-t border-border px-5 pb-6 pt-4',
            stacked ? 'flex-col' : 'flex-row'
          )}>
          {/* An online organisation has nowhere to route to. */}
          {mapped ? (
            <Button
              size="lg"
              className={cn(!stacked && 'flex-1')}
              accessibilityLabel={VOICES_TEXT.directionsSpoken(venue.name)}
              onPress={() =>
                openDirections({
                  latitude: venue.lat,
                  longitude: venue.lng,
                  placeId: venue.google_place_id,
                })
              }>
              <Icon as={Route} className="size-5 text-sticker-foreground" />
              <Text>{VOICES_TEXT.directions}</Text>
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={mapped ? 'secondary' : 'default'}
            className={cn(!stacked && 'flex-1')}
            onPress={() => setLeaving('review')}>
            <Icon
              as={SquarePen}
              className={cn('size-5', mapped ? 'text-foreground' : 'text-sticker-foreground')}
            />
            <Text>{action}</Text>
          </Button>
        </View>
      )}
    </BottomSheet>
  );
}
