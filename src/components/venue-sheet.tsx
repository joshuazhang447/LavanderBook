import {
  ChevronRight,
  CircleUser,
  Eye,
  EyeOff,
  Flag,
  ListChecks,
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

import { AboutPill, aboutPillLabel } from '@/components/about-pill';
import { ChenfengVenueSheet } from '@/components/chenfeng/venue-sheet';
import { ContactList } from '@/components/contact-list';
import { DirectionsButton } from '@/components/directions-button';
import { BUTTON_LABEL, DIALOG_WIDTH, useDialogMaxHeight } from '@/components/info-dialog';
import { LinkedText } from '@/components/linked-text';
import { OauVenueSheet } from '@/components/oau/venue-sheet';
import { ReportReviewPage } from '@/components/report-review';
import { StarRating } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { Badge } from '@/components/ui/badge';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TagPage } from '@/components/venue-tag-page';
import { ABOUT_TEXT, CONTACT_TEXT, DETAILS_TEXT, detailsTeaser } from '@/lib/directory-text';
import { MASK_TEXT, moderationStatus, REPORT_TEXT, spokenMasked, STATUS_TEXT } from '@/lib/moderation-text';
import { postedLabel } from '@/lib/review-dates';
import { useSkin } from '@/lib/skin';
import { isMapped, type NearbyVenue } from '@/lib/use-nearby-venues';
import { cn } from '@/lib/utils';
import type { VenueContact } from '@/lib/venue-contacts';
import { useVenueDetails, type Note, type VenueReview } from '@/lib/venue-details';

function ReviewRow({ review, onReport }: { review: VenueReview; onReport: () => void }) {
  // A period ("A few weeks ago"), or the day when the author shows dates. The
  // server sends nothing finer, so nothing here can be finer either.
  const posted = postedLabel(review.posted_period, review.posted_on);
  // Only ever set on the reader's own review: nobody else's status is sent.
  const status = review.is_mine ? moderationStatus(review.status) : null;
  // A slur the reviewer quoted, masked until the reader asks to see it.
  const masked = !!review.unmasked_body;
  const [revealed, setRevealed] = React.useState(false);
  const body = masked && revealed ? review.unmasked_body : review.body;

  return (
    <View className="gap-2 border-t border-border py-4">
      <View className="flex-row items-center gap-2">
        <View className="size-8 items-center justify-center rounded-full bg-muted">
          <Icon as={CircleUser} className="size-5 text-muted-foreground" />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-2">
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
            {status === 'held' || status === 'rejected' ? (
              <Badge variant={status === 'rejected' ? 'destructive' : 'outline'}>
                <Text>{STATUS_TEXT[status].label}</Text>
              </Badge>
            ) : null}
          </View>
          {posted ? <Text className="text-xs text-muted-foreground">{posted}</Text> : null}
        </View>
        <StarRating value={review.stars} size="sm" />
        {/* A sibling of the row's text, never wrapping it: a button inside a
            button breaks the web. Not on your own review - edit or delete it. */}
        {review.is_mine ? null : review.reported_by_me ? (
          <Text className="text-xs text-muted-foreground">{REPORT_TEXT.reported}</Text>
        ) : (
          <Pressable
            onPress={onReport}
            accessibilityRole="button"
            accessibilityLabel={REPORT_TEXT.actionLabel}
            hitSlop={8}
            className="rounded-full p-1.5 active:bg-accent">
            <Icon as={Flag} className="size-4 text-muted-foreground" />
          </Pressable>
        )}
      </View>
      {status === 'held' ? (
        <Text className="text-xs text-muted-foreground">{STATUS_TEXT.held.line}</Text>
      ) : status === 'rejected' ? (
        <Text className="text-xs text-destructive">{STATUS_TEXT.rejected.formLine}</Text>
      ) : null}
      {body ? (
        <Text
          className="text-sm leading-5 text-muted-foreground"
          accessibilityLabel={masked && !revealed ? spokenMasked(body) : undefined}>
          {body}
        </Text>
      ) : null}
      {masked ? (
        <Pressable
          onPress={() => setRevealed(!revealed)}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 self-start rounded-full py-1 active:opacity-60">
          <Icon as={revealed ? EyeOff : Eye} className="size-3.5 text-muted-foreground" />
          <Text className="text-xs font-medium text-muted-foreground">
            {revealed ? MASK_TEXT.hide : MASK_TEXT.show}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The way in to the page behind the tags, made hard to miss.
 *
 * It was a small outlined "More details" pill in the header, which read as a
 * label and was mostly not pressed - while what is behind it (which door to
 * use, who a clinic cannot take) is often the most useful thing on the card.
 * So it is a card of its own at the top of the scroll: a filled symbol, a
 * title, a line counting what is inside, the first two things we checked as
 * headlines, and something that looks like a button. One Pressable; the
 * "button" is only drawn, because a button inside a button breaks the web.
 */
function DetailsCard({
  notes,
  answeredReviews,
  onPress,
}: {
  notes: Note[];
  answeredReviews: number;
  onPress: () => void;
}) {
  const teaser = detailsTeaser(notes, answeredReviews);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${DETAILS_TEXT.spoken}. ${teaser.line}`}
      className={cn(
        'mb-4 flex-row items-start gap-3 rounded-xl bg-secondary p-4 active:opacity-80',
        Platform.select({ web: 'cursor-pointer transition-opacity hover:opacity-90' })
      )}>
      <View className="size-9 items-center justify-center rounded-full bg-primary">
        <Icon as={ListChecks} className="size-5 text-primary-foreground" />
      </View>
      <View className="flex-1 gap-1.5">
        <View className="gap-0.5">
          <Text className="font-semibold text-secondary-foreground">{DETAILS_TEXT.title}</Text>
          <Text className="text-xs text-muted-foreground">{teaser.line}</Text>
        </View>
        {teaser.points.map((point, index) => (
          <View key={index} className="flex-row gap-2">
            <Text className="text-sm leading-5 text-muted-foreground">{'\u2022'}</Text>
            <Text numberOfLines={1} className="flex-1 text-sm leading-5 text-secondary-foreground">
              {point}
            </Text>
          </View>
        ))}
        <View className="mt-1 flex-row items-center gap-1 self-start rounded-full bg-primary py-1.5 pl-3 pr-2">
          <Text className="text-xs font-medium text-primary-foreground">{DETAILS_TEXT.action}</Text>
          <Icon as={ChevronRight} className="size-3.5 text-primary-foreground" />
        </View>
      </View>
    </Pressable>
  );
}

type AboutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string | null;
  contacts: readonly VenueContact[];
};

/**
 * A place's description in full (the card shows two lines of it) and how to
 * reach the place: its website, phone, text line, email and the links to its
 * own services, as rows to press. What LavenderBook checked there stays on the
 * card's Good to know - this window is for what the place is and how to get
 * in touch, and is kept short enough to read at a glance.
 *
 * A dialog rather than another page inside the sheet: it opens from the
 * card's header, which stays put under it, and it is read and closed - there
 * is nothing in it to come back to. Sized like the app's other windows
 * (info-dialog), whose middle scrolls while the title and button stay.
 */
function AboutDialog({ open, onOpenChange, name, description, contacts }: AboutDialogProps) {
  const maxHeight = useDialogMaxHeight();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_WIDTH, 'gap-3')} style={{ maxHeight }}>
        <DialogHeader>
          {/* Clear of the window's own close button, top right. */}
          <DialogTitle className="pr-6 leading-6">{name}</DialogTitle>
        </DialogHeader>

        <ScrollView className="shrink grow-0" contentContainerClassName="gap-4">
          {description ? (
            <View className="gap-1.5">
              <Text className="text-sm leading-5 text-foreground">
                <LinkedText text={description} />
              </Text>
              <Text className="text-xs text-muted-foreground">{ABOUT_TEXT.attribution}</Text>
            </View>
          ) : null}

          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">{CONTACT_TEXT.heading}</Text>
            {contacts.length > 0 ? (
              <ContactList contacts={contacts} />
            ) : (
              <Text className="text-sm text-muted-foreground">{CONTACT_TEXT.none}</Text>
            )}
          </View>
        </ScrollView>

        <DialogFooter>
          <Button onPress={() => onOpenChange(false)}>
            <Text className={BUTTON_LABEL}>{ABOUT_TEXT.done}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  // Chenfeng's place card is a sheet with detents and a page pushed inside,
  // OAU's keeps LavenderBook's words and visitors' apart on paper (each its own
  // file); Basic and Material keep this one. Same data, same hook.
  if (skin === 'chenfeng') return <ChenfengVenueSheet {...props} />;
  if (skin === 'oau') return <OauVenueSheet {...props} />;
  return <BasicVenueSheet {...props} />;
}

function BasicVenueSheet({ venue, onClose, onWriteReview }: VenueSheetProps) {
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
  /** The review being reported, while the report page is open. */
  const [reporting, setReporting] = React.useState<VenueReview | null>(null);
  /** The reviews page animates in only when it is being returned to. */
  const [returning, setReturning] = React.useState(false);
  /**
   * Set when the whole sheet is about to go: closed, or handed over to the
   * review form. The pages below slide in and out as they are swapped, and
   * Reanimated plays a view's exit when it unmounts for any reason - so
   * closing the card from the details page sent that page sliding off
   * sideways on its own while the sheet dropped. On the website it was worse:
   * the page is re-attached outside the sheet to play its exit, so it hung
   * over the header as it went.
   *
   * So leaving takes two steps. First the pages lose their exits; then, once
   * that has rendered, the parent is told and unmounts the sheet, whose own
   * slide down is the only thing left to play.
   */
  const [leaving, setLeaving] = React.useState<'close' | 'review' | null>(null);
  const told = React.useRef(false);
  React.useEffect(() => {
    if (!leaving || told.current) return;
    told.current = true;
    if (leaving === 'close') onClose();
    else onWriteReview();
  }, [leaving, onClose, onWriteReview]);
  const close = React.useCallback(() => setLeaving('close'), []);
  /** The description's window. While it is open the sheet under it stays. */
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const stay = React.useCallback(() => {}, []);

  function openTagPage() {
    setReturning(true);
    setPage('tag');
  }
  function openReport(review: VenueReview) {
    setReturning(true);
    setReporting(review);
    setPage('report');
  }

  return (
    // Opens most of the way up; its handle and top row drag it to full height.
    // Escape closes whatever is on top: the description's window while that is
    // open, and only then the sheet.
    <BottomSheet
      name="venue-sheet"
      onClose={aboutOpen ? stay : close}
      accessibilityLabel={venue.name}
      partial={0.62}
      // For the report page's note: the keyboard lifts the sheet rather than
      // covering the field. Nothing else here takes typing.
      keyboardAvoiding
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
                // With a description, that is what goes under the name: it
                // says what the place is, which "listed, no reviews yet" does
                // not, and the reviews below say there are none.
                description ? null : (
                  <Text className="text-sm text-muted-foreground">
                    Listed by LavenderBook · no reviews yet
                  </Text>
                )
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

            {/* Two lines of what the place is, cut with an ellipsis, and the
                way in to the rest and to how to reach them. One pressable:
                the words are the button, and "Read more" is there so that it
                looks like one. A place with contacts and no description gets
                the way in alone. */}
            {description || contacts.length > 0 ? (
              <Pressable
                onPress={() => setAboutOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={
                  description
                    ? `${description} ${ABOUT_TEXT.moreSpoken}`
                    : aboutPillLabel(contacts, false, false)
                }
                className={cn(
                  'gap-2 active:opacity-70',
                  Platform.select({ web: 'cursor-pointer' })
                )}>
                {description ? (
                  <Text numberOfLines={2} className="text-sm leading-5 text-foreground">
                    {description}
                  </Text>
                ) : null}
                <AboutPill contacts={contacts} hasDescription={!!description} />
              </Pressable>
            ) : null}

          </View>
          {/* An online organisation has nowhere to route to. */}
          {isMapped(venue) ? (
            <DirectionsButton
              name={venue.name}
              latitude={venue.lat}
              longitude={venue.lng}
              placeId={venue.google_place_id}
            />
          ) : null}
          <Pressable
            onPress={close}
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
            exiting={leaving ? undefined : SlideOutLeft.duration(180)}
            className="absolute inset-0">
            <ScrollView className="flex-1" contentContainerClassName="px-5 pb-4">
              {/* The same destination as a tag pill's chevron, and gated on the
                  same condition, so the two can never disagree about whether
                  there is a page. */}
              {hasTagPage ? (
                <DetailsCard
                  notes={notes}
                  answeredReviews={summary[0]?.answeredReviews ?? 0}
                  onPress={openTagPage}
                />
              ) : null}
              {reviews === null ? (
                <View className="items-center py-8">
                  <ActivityIndicator />
                </View>
              ) : reviews.length === 0 ? (
                <Text className="py-8 text-center text-sm text-muted-foreground">
                  No written reviews yet.
                </Text>
              ) : (
                reviews.map((review) => (
                  <ReviewRow key={review.id} review={review} onReport={() => openReport(review)} />
                ))
              )}
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

      {/* Pinned below the list rather than inside it, so it stays reachable
          however many reviews a venue has. Not under the report page, which
          has its own button. */}
      {page === 'report' ? null : (
        <View className="border-t border-border px-5 pb-6 pt-4">
          {/* "New" means asked since this author last saved - not merely
              unanswered, which would nag anyone who skipped an optional one. */}
          <Button onPress={() => setLeaving('review')}>
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
      )}

      {/* A window of its own, through the dialog's portal: where it sits in
          this tree does not matter, only that it lives as long as the sheet. */}
      {description || contacts.length > 0 ? (
        <AboutDialog
          open={aboutOpen}
          onOpenChange={setAboutOpen}
          name={venue.name}
          description={description}
          contacts={contacts}
        />
      ) : null}
    </BottomSheet>
  );
}
