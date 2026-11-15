import {
  ChevronLeft,
  ChevronRight,
  CircleUser,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  MapPin,
  Navigation,
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

import { AnswerSummaryCard } from '@/components/answer-summary';
import { CONTACT_ICONS, contactSpoken } from '@/components/contact-list';
import { openDirections } from '@/components/directions-button';
import { LinkedText, openLink } from '@/components/linked-text';
import { IconSticker, OauCard } from '@/components/oau/card';
import { CautionPaper } from '@/components/oau/caution';
import { FactChip, Note, NoteCheck } from '@/components/oau/note';
import { Ribbon } from '@/components/oau/ribbon';
import { ReportReviewPage } from '@/components/report-review';
import { StarRating } from '@/components/star-rating';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatDistance } from '@/components/venue-list';
import type { VenueSheetProps } from '@/components/venue-sheet';
import { TagPage } from '@/components/venue-tag-page';
import { ABOUT_TEXT, detailsTeaser, SHOW_ON_MAP_TEXT, VOICES_TEXT } from '@/lib/directory-text';
import { MASK_TEXT, moderationStatus, REPORT_TEXT, spokenMasked, STATUS_TEXT } from '@/lib/moderation-text';
import { OAU_DETAILS_TEXT } from '@/lib/oau-text';
import { postedLabel } from '@/lib/review-dates';
import { isMapped } from '@/lib/use-nearby-venues';
import { cn } from '@/lib/utils';
import { contactDisplay, contactHref, contactTitle, type VenueContact } from '@/lib/venue-contacts';
import { useVenueDetails, type VenueReview } from '@/lib/venue-details';

/** The tag LavenderBook gives a place it lists as a warning (src/lib/directory.ts). */
const WARNING_KIND = 'dangerous';

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

/** A quiet action in the tab's colour, with a chevron: "See everything we checked ›". */
function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      className={cn('flex-row items-center gap-0.5 self-start py-1 active:opacity-60', PRESSABLE_WEB)}>
      <Text oauStyle="label" className="text-primary">
        {label}
      </Text>
      <Icon as={ChevronRight} className="size-4 text-primary" />
    </Pressable>
  );
}

/** The description: four lines, then "Read more" in place. */
function Description({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false);
  // A short paragraph needs no fold; a long one is cut at four lines.
  const long = text.length > 220;
  return (
    <View className="gap-1">
      <Text oauStyle="body" numberOfLines={open || !long ? undefined : 4} className="text-foreground">
        <LinkedText text={text} />
      </Text>
      {long && !open ? <QuietLink label={ABOUT_TEXT.more} onPress={() => setOpen(true)} /> : null}
    </View>
  );
}

export type OauPlaceCardProps = VenueSheetProps & {
  /** How far, measured on the device, for the rating line. Null: not known, or nowhere. */
  distance?: number | null;
  /** In the Map tab's panel: the way back to its list ("28 places"). */
  back?: { label: string; onPress: () => void };
  /**
   * Show on map keeps the card open: in the Map tab's panel, where the map is
   * right there and only moves. A sheet closes first instead.
   */
  staysForMap?: boolean;
  /** Lays the card's two parts out: its header (what a sheet drags by) and the rest. */
  children: (parts: {
    header: React.ReactNode;
    content: React.ReactNode;
    close: () => void;
  }) => React.ReactElement;
};

/**
 * OAU's place card (LavenderBookStyle/oau-style-guide.md, section 14.4), as
 * two parts any container can hold: a bottom sheet (the Directory, My Account)
 * or the Map tab's places panel. The header: the place's kinds as ribbons, its
 * name, its rating with how far it is, the bathroom answer. Then a warning
 * place's banner; LavenderBook's note (the description, four lines then Read
 * more, and what it checked); how to get in touch, right there; visitors'
 * answers and reviews under a heading of their own; and the dock - Directions
 * and the review action, or a place's first contact when it has nowhere to go.
 *
 * The data and every rule about what is shown are useVenueDetails', as for
 * every skin; the pages and the two-step leave are Basic's.
 */
export function OauPlaceCard({
  venue,
  onClose,
  onWriteReview,
  onShowOnMap,
  distance = null,
  back,
  staysForMap = false,
  children,
}: OauPlaceCardProps) {
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
  // exits first, so only the container's own move plays.
  const [leaving, setLeaving] = React.useState<'close' | 'review' | 'map' | null>(null);
  const told = React.useRef(false);
  React.useEffect(() => {
    if (!leaving || told.current) return;
    told.current = true;
    if (leaving === 'close') onClose();
    else if (leaving === 'map') onShowOnMap?.();
    else onWriteReview();
  }, [leaving, onClose, onWriteReview, onShowOnMap]);
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
  const warning = tags.some((tag) => tag.slug === WARNING_KIND);
  const away = formatDistance(distance);
  const action =
    nudge > 0
      ? nudge === 1
        ? 'Answer 1 new question'
        : `Answer ${nudge} new questions`
      : hasOwnReview
        ? 'Edit your review'
        : VOICES_TEXT.writeReview;
  const mapped = isMapped(venue);
  // Somewhere with no public address has nowhere to route to: its first
  // contact is the main thing to do instead, as a verb.
  const reach = !mapped ? (contacts[0] ?? null) : null;
  const primaryLabel = mapped ? VOICES_TEXT.directions : reach ? VOICES_TEXT.contactVerb[reach.kind] : null;
  // Side by side while both fit half the dock; a long one stacks them.
  const stacked = action.length > 16 || (primaryLabel?.length ?? 0) > 16;
  const answered = summary[0]?.answeredReviews ?? 0;

  // Its pin, beside the close: never for an online group, which has none.
  const closeSticker = (
    <View className="flex-row items-center gap-2">
      {mapped && onShowOnMap ? (
        <IconSticker
          icon={MapPin}
          label={SHOW_ON_MAP_TEXT.spoken(venue.name)}
          onPress={staysForMap ? onShowOnMap : () => setLeaving('map')}
        />
      ) : null}
      <IconSticker icon={X} label="Close" onPress={close} />
    </View>
  );
  const ribbons =
    tags.length > 0 ? (
      <View className="flex-1 flex-row flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Ribbon
            key={tag.slug}
            tag={tag}
            onPress={hasTagPage && page === 'reviews' ? openTagPage : undefined}
          />
        ))}
      </View>
    ) : (
      <View className="flex-1" />
    );

  const header = (
    <View className="gap-2 px-5 pb-3 pt-1">
      {back ? (
        <>
          <View className="flex-row items-center gap-2">
            <Button variant="secondary" size="sm" onPress={back.onPress}>
              <Icon as={ChevronLeft} className="size-4 text-foreground" />
              <Text>{back.label}</Text>
            </Button>
            <View className="flex-1" />
            {closeSticker}
          </View>
          {tags.length > 0 ? <View className="mt-1 flex-row">{ribbons}</View> : null}
        </>
      ) : (
        <View className="flex-row items-start gap-3">
          {ribbons}
          {closeSticker}
        </View>
      )}
      <Text oauStyle="title" role="heading" className="text-foreground">
        {venue.name}
      </Text>
      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        {count === 0 ? (
          <Text oauStyle="note" className="text-muted-foreground">
            {VOICES_TEXT.noReviewsYet}
          </Text>
        ) : (
          <>
            <StarRating value={average} size="sm" />
            <Text oauStyle="label" className="text-star-foreground">
              {average.toFixed(1)}
            </Text>
            <Text oauStyle="callout" className="text-muted-foreground">
              {count === 1 ? '· 1 review' : `· ${count} reviews`}
            </Text>
          </>
        )}
        {away ? (
          <Text
            oauStyle="callout"
            className="text-muted-foreground"
            style={{ fontVariant: ['tabular-nums'] }}>
            · {away}
          </Text>
        ) : null}
      </View>
      {bathroom ? (
        <FactChip question="Trans-friendly bathroom:" answer={bathroom.label} tally={bathroom.tally} />
      ) : null}
    </View>
  );

  const reviewsPage = (
    <ScrollView className="flex-1" contentContainerClassName="gap-6 px-5 pb-6 pt-1">
      {warning ? (
        <CautionPaper title={VOICES_TEXT.warning}>
          <Text oauStyle="callout" className="text-foreground">
            {VOICES_TEXT.warningLine}
          </Text>
        </CautionPaper>
      ) : null}

      {description || teaser.points.length > 0 ? (
        <Note>
          {description ? <Description text={description} /> : null}
          {teaser.points.length > 0 ? (
            <View className={cn('gap-1.5', description && 'mt-3')}>
              {teaser.points.map((point, index) => (
                <NoteCheck key={index} numberOfLines={2}>
                  {point}
                </NoteCheck>
              ))}
            </View>
          ) : null}
          {notes.length > 0 ? (
            <View className="mt-1.5">
              <QuietLink label={VOICES_TEXT.seeChecked} onPress={openTagPage} />
            </View>
          ) : null}
        </Note>
      ) : null}

      {contacts.length > 0 ? (
        <View className="gap-2.5">
          <SectionHeading title={VOICES_TEXT.getInTouch} />
          <OauContactList contacts={contacts} />
        </View>
      ) : null}

      <View className="gap-3">
        <SectionHeading
          title={VOICES_TEXT.fromVisitors}
          line={
            summary.length > 0
              ? OAU_DETAILS_TEXT.reportedLine(answered, count)
              : VOICES_TEXT.visitorsLine
          }
        />
        {summary.length > 0 ? (
          <View className="gap-1.5">
            <OauCard className="px-4">
              {summary.slice(0, 3).map((row, index) => (
                <View
                  key={row.questionId}
                  className={cn('py-3.5', index > 0 && 'border-t border-border')}>
                  <AnswerSummaryCard row={row} />
                </View>
              ))}
            </OauCard>
            {summary.length > 3 || notes.length === 0 ? (
              <QuietLink label={VOICES_TEXT.seeAnswers} onPress={openTagPage} />
            ) : null}
          </View>
        ) : null}
        {reviews === null ? (
          <View className="items-center py-6">
            <ActivityIndicator />
          </View>
        ) : reviews.length === 0 ? (
          <OauCard className="items-center gap-1 p-4">
            <Text oauStyle="subheading" className="text-center text-foreground">
              {VOICES_TEXT.noWritten}
            </Text>
            <Text oauStyle="note" className="text-center text-muted-foreground">
              {VOICES_TEXT.haveYouBeen}
            </Text>
          </OauCard>
        ) : (
          reviews.map((review) => (
            <OauReviewCard key={review.id} review={review} onReport={() => openReport(review)} />
          ))
        )}
      </View>
    </ScrollView>
  );

  const content = (
    <>
      <View className="flex-1">
        {page === 'reviews' ? (
          <Animated.View
            key="reviews"
            entering={returning ? SlideInLeft.duration(220) : undefined}
            exiting={leaving ? undefined : SlideOutLeft.duration(180)}
            className="absolute inset-0">
            {reviewsPage}
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
            'gap-2.5 border-t border-border bg-band px-5 pb-6 pt-3.5',
            stacked ? 'flex-col' : 'flex-row'
          )}>
          {mapped ? (
            <Button
              size="lg"
              // Its own width side by side: the review action takes the rest,
              // so "Write a review" fits a phone without being cut short.
              className="px-3"
              accessibilityLabel={VOICES_TEXT.directionsSpoken(venue.name)}
              onPress={() =>
                openDirections({
                  latitude: venue.lat,
                  longitude: venue.lng,
                  placeId: venue.google_place_id,
                })
              }>
              <Icon as={Navigation} className="size-5 text-sticker-foreground" />
              <Text numberOfLines={1}>{VOICES_TEXT.directions}</Text>
            </Button>
          ) : reach ? (
            <Button
              size="lg"
              className="px-3"
              accessibilityLabel={contactSpoken(reach)}
              onPress={() => openLink(contactHref(reach))}>
              <Icon as={CONTACT_ICONS[reach.kind]} className="size-5 text-sticker-foreground" />
              <Text numberOfLines={1}>{VOICES_TEXT.contactVerb[reach.kind]}</Text>
            </Button>
          ) : null}
          <View className={cn(!stacked && 'flex-1')}>
            <Button
              size="lg"
              className="px-3"
              variant={mapped || reach ? 'secondary' : 'default'}
              accessibilityLabel={nudge > 0 ? `${action}. ${VOICES_TEXT.newSpoken}` : undefined}
              onPress={() => setLeaving('review')}>
              <Icon
                as={SquarePen}
                className={cn('size-5', mapped || reach ? 'text-foreground' : 'text-sticker-foreground')}
              />
              <Text numberOfLines={1}>{action}</Text>
            </Button>
            {/* Something new to answer: a flag-pink dot on the sticker's corner. */}
            {nudge > 0 ? (
              <View
                pointerEvents="none"
                className="absolute -right-1 -top-1 size-3 rounded-full border-[1.5px] border-outline-ink bg-flag-trans-pink"
              />
            ) : null}
          </View>
        </View>
      )}
    </>
  );

  return children({ header, content, close });
}

/** OAU's place card as a bottom sheet: the Directory's, My Account's. */
export function OauVenueSheet(props: VenueSheetProps) {
  return (
    <OauPlaceCard {...props}>
      {({ header, content, close }) => (
        <BottomSheet
          name="venue-sheet"
          onClose={close}
          accessibilityLabel={props.venue.name}
          partial={0.62}
          keyboardAvoiding
          header={header}>
          {content}
        </BottomSheet>
      )}
    </OauPlaceCard>
  );
}
