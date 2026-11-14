import { router } from 'expo-router';
import { useTabTrigger } from 'expo-router/ui';
import {
  Calendar,
  CalendarOff,
  Check,
  CircleUser,
  Clock,
  Lock,
  MapPin,
  ShieldAlert,
  SquarePen,
  TriangleAlert,
  VenetianMask,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLeaveNowReserve } from '@/components/leave-now';
import { LogoImage } from '@/components/logo-image';
import { statusLine, useMyReviews, type MyReview } from '@/components/my-reviews-list';
import { BookTile, IconSticker, OauCard, OauHeading, OauRow } from '@/components/oau/card';
import { PaperBackdrop } from '@/components/oau/paper';
import { PrideFlag, PrideRibbon } from '@/components/oau/pride-flag';
import { OauBadge } from '@/components/oau-badge';
import { LeaveNowSetting, LocationSetting, PrivacySettings } from '@/components/privacy-settings';
import { ReviewSheet } from '@/components/review-sheet';
import { StarRating } from '@/components/star-rating';
import { useIsWideViewport, useTabBarOverlap } from '@/components/tab-bar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { BOOK_LARGE } from '@/lib/logos';
import { focusMapOn } from '@/lib/map-focus';
import { STATUS_TEXT } from '@/lib/moderation-text';
import { OAU_ACCOUNT_TEXT as T, shownAs } from '@/lib/oau-text';
import { PAGING_TEXT, REVIEWS_PAGE, usePaging } from '@/lib/paging';
import { accountNameNote, SIGN_IN_PITCH } from '@/lib/privacy-text';
import { reopenSafetyNotice } from '@/lib/safety';
import { chooseSkin, DEFAULT_SKIN, SKINS, useSkinChoice, type Skin } from '@/lib/skin';
import { skinColor } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { SelectedPoi } from '@/lib/venues';

/**
 * OAU's My Account (LavenderBookStyle/oau-style-guide.md, section 14.9): pink
 * paper; the profile card with a monogram and the intersex-inclusive Progress
 * Pride flag hanging from it as a book's ribbon; "Your privacy" as one open
 * card of the same switches every skin has (PrivacyToggle, its confirmations
 * and explanations unchanged); the look as four small previews; your reviews
 * as rows; and at the foot the colophon - the book, OAU's credit, and the flag.
 */
export function OauAccountScreen() {
  const { session, loading, signInWithGoogle, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  const { top: leaveNow } = useLeaveNowReserve();
  const topInset = (isWide ? 0 : insets.top) + leaveNow;
  const tabBarOverlap = useTabBarOverlap();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Bumped when turning per-place names on renamed the reviews listed below. */
  const [reviewChanges, setReviewChanges] = React.useState(0);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      <PaperBackdrop tab="account" washHeight={260} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        // Bottom padding only - the tab bar owns the bottom inset itself.
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-12"
          contentContainerStyle={tabBarOverlap ? { paddingBottom: 48 + tabBarOverlap } : undefined}>
          <View className="w-full max-w-[680px] gap-7 self-center px-4 pt-7 sm:px-6">
            <Text oauStyle="display" role="heading" className="text-foreground">
              {T.title}
            </Text>

            {session ? (
              <ProfileCard />
            ) : (
              <WelcomeCard busy={busy} onSignIn={() => run(signInWithGoogle)} />
            )}

            <View className="gap-3">
              <OauHeading title={T.privacy} line={T.privacyLine} />
              <OauCard>
                {/* Each switch draws a hairline under itself; the card's edge
                    hides the last one. */}
                <View className="-mb-px">
                  {session ? (
                    <PrivacySettings onReviewsChanged={() => setReviewChanges((n) => n + 1)} />
                  ) : (
                    <>
                      <LocationSetting />
                      <LeaveNowSetting />
                    </>
                  )}
                </View>
              </OauCard>
            </View>

            <AppearanceCards />

            {session ? <ReviewsSection key={session.user.id} changes={reviewChanges} /> : null}

            <View className="gap-3">
              <OauHeading title={T.more} />
              <OauCard>
                <OauRow
                  first
                  icon={ShieldAlert}
                  title={T.safetyNotice}
                  chevron
                  // The notice is the same in every skin.
                  onPress={reopenSafetyNotice}
                />
                <OauRow
                  icon={Lock}
                  title={T.privacyPolicy}
                  chevron
                  onPress={() => router.push('/account/privacy')}
                />
              </OauCard>
            </View>

            {session ? (
              <View className="items-start gap-2">
                <Button variant="secondary" disabled={busy} onPress={() => run(signOut)}>
                  <Text>{T.signOut}</Text>
                </Button>
              </View>
            ) : null}

            {error ? (
              <Text oauStyle="callout" className="text-destructive" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Colophon />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Two letters from the account's name - "Quiet Heron" or "QuietHeron42" is
 * QH - for the monogram. Never a photo: the name is anonymous by design.
 */
function initials(name: string | null | undefined): string {
  if (!name) return '';
  const words = name.match(/[A-Z][a-z]*|[a-z]+/g) ?? [];
  const letters = words.slice(0, 2).map((word) => word[0].toUpperCase());
  return letters.join('') || name.slice(0, 1).toUpperCase();
}

function Monogram({ name }: { name: string | null | undefined }) {
  return (
    <View className="size-14 items-center justify-center rounded-full border-[1.5px] border-outline-ink bg-oau-pink">
      {name ? (
        <Text oauStyle="heading" className="text-oau-pink-foreground">
          {initials(name)}
        </Text>
      ) : (
        <Icon as={CircleUser} className="size-7 text-oau-pink-foreground" />
      )}
    </View>
  );
}

/** The card the ribbon hangs from: rising 6 above its top edge, 20 in from its end. */
function RibbonCard({ children }: React.PropsWithChildren) {
  return (
    <View>
      <OauCard className="overflow-visible px-4 pb-4 pt-[18px]">{children}</OauCard>
      <View className="absolute -top-1.5 right-5">
        <PrideRibbon />
      </View>
    </View>
  );
}

function ProfileCard() {
  const { profile } = useAuth();
  return (
    <RibbonCard>
      {/* Clear of the ribbon at the card's end. */}
      <View className="flex-row items-center gap-3 pr-12">
        <Monogram name={profile?.display_name} />
        <View className="flex-1 gap-0.5">
          <Text oauStyle="heading" numberOfLines={2} className="text-foreground">
            {profile?.display_name ?? T.loadingName}
          </Text>
          <Text oauStyle="callout" className="text-muted-foreground">
            {T.signedInWith}
          </Text>
        </View>
      </View>
      <Text oauStyle="caption" className="mt-3 pr-12 text-muted-foreground">
        {accountNameNote(profile ? profile.per_place_names : null)}
      </Text>
    </RibbonCard>
  );
}

function WelcomeCard({ busy, onSignIn }: { busy: boolean; onSignIn: () => void }) {
  return (
    <RibbonCard>
      <View className="gap-4 pr-12">
        <BookTile />
        <Text oauStyle="heading" role="heading" className="text-foreground">
          {T.welcome}
        </Text>
        <Text oauStyle="body" className="text-muted-foreground">
          {SIGN_IN_PITCH}
        </Text>
        <View className="items-start">
          <Button disabled={busy} onPress={onSignIn}>
            <Text>{busy ? T.signingIn : T.continueWithGoogle}</Text>
          </Button>
        </View>
      </View>
    </RibbonCard>
  );
}

/** A small picture of a skin: its page, a card, a button and a tab bar, in its own colours. */
function SkinPreview({ skin }: { skin: Skin }) {
  const color = (name: Parameters<typeof skinColor>[2]) => skinColor(skin, 'light', name);
  return (
    <View
      className="h-[72px] overflow-hidden rounded-[12px] px-2.5 pt-2.5"
      style={{ backgroundColor: color('background') }}>
      <View
        className="h-7 justify-center rounded-[6px] px-2"
        style={{ backgroundColor: color('card'), borderColor: color('border'), borderWidth: 1 }}>
        <View className="h-1.5 w-12 rounded-full" style={{ backgroundColor: color('muted-foreground') }} />
      </View>
      <View className="mt-1.5 h-3.5 w-14 rounded-full" style={{ backgroundColor: color('primary') }} />
      <View
        className="absolute bottom-0 left-0 right-0 h-3"
        style={{ backgroundColor: color(skin === 'oau' ? 'band' : 'card'), borderTopColor: color('border'), borderTopWidth: 1 }}
      />
    </View>
  );
}

/**
 * The four looks as small previews, two by two, OAU first; choosing one
 * applies it at once. The chosen card carries a check sticker in the tab's
 * pink (section 14.11).
 */
function AppearanceCards() {
  const { skin } = useSkinChoice();
  return (
    <View className="gap-3">
      <OauHeading title={T.look} line={T.lookLine} />
      <View role="radiogroup" aria-label="Appearance" className="flex-row flex-wrap gap-3">
        {SKINS.map((option) => {
          const chosen = option.id === skin;
          return (
            <Pressable
              key={option.id}
              role="radio"
              aria-checked={chosen}
              accessibilityLabel={chosen ? T.chosen(option.label) : option.label}
              onPress={() => void chooseSkin(option.id)}
              className={cn(
                'min-w-[140px] flex-1 basis-[40%] gap-2 rounded-[18px] bg-card p-2.5 active:scale-[0.98]',
                chosen ? 'border-[1.5px] border-outline-ink' : 'border border-border',
                Platform.select({ web: 'cursor-pointer transition-transform' })
              )}>
              <SkinPreview skin={option.id} />
              <View className="flex-row items-center gap-2 px-1">
                <Text oauStyle="label" className="flex-1 text-foreground">
                  {option.label}
                </Text>
                {option.id === DEFAULT_SKIN ? (
                  <Text oauStyle="caption" className="text-muted-foreground">
                    {T.default}
                  </Text>
                ) : null}
                {chosen ? (
                  <View className="size-6 items-center justify-center rounded-full border-[1.5px] border-outline-ink bg-sticker">
                    <Icon as={Check} className="size-3.5 text-sticker-foreground" />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One of your reviews: the place, its stars, the name and date readers see, and its status. */
function ReviewRow({
  review,
  first,
  onPress,
  onShowOnMap,
}: {
  review: MyReview;
  first: boolean;
  onPress: () => void;
  onShowOnMap?: () => void;
}) {
  const status = statusLine(review);
  const dated = review.posted
    ? review.hideDate
      ? `Dated "${review.posted}"`
      : `Dated ${review.posted}`
    : null;

  return (
    // The row and its map sticker are siblings: a button inside a button
    // breaks the web.
    <View className={cn('flex-row items-center', !first && 'border-t border-border')}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${review.venue.name}, ${review.stars} of 5, ${shownAs(review.alias)}${
          dated ? `, ${dated}` : ''
        }${status ? `. ${status}` : ''}`}
        accessibilityHint="Opens the review to edit it."
        className={cn(
          'flex-1 gap-1 py-3.5 pl-4 pr-3 active:bg-muted',
          Platform.select({ web: 'cursor-pointer transition-colors hover:bg-muted/60' })
        )}>
        <View className="flex-row items-center gap-2">
          <Text oauStyle="subheading" numberOfLines={1} className="shrink text-foreground">
            {review.venue.name}
          </Text>
          {review.status === 'held' || review.status === 'rejected' ? (
            <View
              className={cn(
                'rounded-full px-2 py-0.5',
                review.status === 'held' ? 'bg-muted' : 'bg-caution'
              )}>
              <Text
                oauStyle="micro"
                className={review.status === 'held' ? 'text-muted-foreground' : 'text-caution-foreground'}>
                {STATUS_TEXT[review.status].label}
              </Text>
            </View>
          ) : null}
        </View>
        <StarRating value={review.stars} size="sm" />
        {/* Readers see a different name on each review: this is the one place
            its author can match them up, and check what readers see for the date. */}
        <View className="flex-row items-center gap-1.5">
          <Icon
            as={review.alias ? VenetianMask : CircleUser}
            className="size-3.5 text-muted-foreground"
          />
          <Text oauStyle="caption" numberOfLines={1} className="flex-1 text-muted-foreground">
            {shownAs(review.alias)}
          </Text>
        </View>
        {dated ? (
          <View className="flex-row items-center gap-1.5">
            <Icon
              as={review.hideDate ? CalendarOff : Calendar}
              className="size-3.5 text-muted-foreground"
            />
            <Text oauStyle="caption" numberOfLines={1} className="flex-1 text-muted-foreground">
              {dated}
            </Text>
          </View>
        ) : null}
        {status ? (
          <View className="flex-row items-start gap-1.5">
            <Icon
              as={review.status === 'held' ? Clock : TriangleAlert}
              className={cn(
                'mt-0.5 size-3.5',
                review.status === 'held' ? 'text-muted-foreground' : 'text-destructive'
              )}
            />
            <Text
              oauStyle="caption"
              className={cn(
                'flex-1',
                review.status === 'held' ? 'text-muted-foreground' : 'text-destructive'
              )}>
              {status}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {onShowOnMap ? (
        <IconSticker
          icon={MapPin}
          label={`Show ${review.venue.name} on the map`}
          onPress={onShowOnMap}
          className="mr-4"
        />
      ) : null}
    </View>
  );
}

function ReviewsSection({ changes }: { changes: number }) {
  // switchTab, as the tab bar does: it lands on the tab rather than pushing over it.
  const { switchTab } = useTabTrigger({ name: 'map' });
  const { reviews, refetch } = useMyReviews(changes);
  const [open, setOpen] = React.useState<MyReview | null>(null);
  const page = usePaging(reviews, REVIEWS_PAGE);

  return (
    <View className="gap-3">
      <OauHeading
        title={T.reviews}
        trailing={
          reviews && reviews.length > 0 ? (
            <Text oauStyle="callout" className="text-muted-foreground">
              {reviews.length}
            </Text>
          ) : null
        }
      />
      {reviews === null || page.shown === null ? (
        <View className="items-center py-6">
          <ActivityIndicator />
        </View>
      ) : reviews.length === 0 ? (
        <OauCard>
          <OauRow first icon={SquarePen} title={T.noReviews} detail={T.noReviewsLine} />
        </OauCard>
      ) : (
        <OauCard>
          {page.shown.map((review, index) => (
            <ReviewRow
              key={review.venue.id}
              review={review}
              first={index === 0}
              onPress={() => setOpen(review)}
              onShowOnMap={
                review.venue.lat !== null && review.venue.lng !== null
                  ? () => {
                      focusMapOn({
                        latitude: review.venue.lat as number,
                        longitude: review.venue.lng as number,
                      });
                      switchTab('map', {});
                    }
                  : undefined
              }
            />
          ))}
          {page.remaining > 0 ? (
            <Pressable
              onPress={page.showMore}
              accessibilityRole="button"
              className={cn(
                'min-h-12 justify-center border-t border-border px-4 py-3 active:bg-muted',
                Platform.select({ web: 'cursor-pointer' })
              )}>
              <Text oauStyle="label" className="text-primary">
                {PAGING_TEXT.more(page.next)}
              </Text>
              <Text oauStyle="caption" className="text-muted-foreground">
                {PAGING_TEXT.showing(page.shown.length, page.total)}
              </Text>
            </Pressable>
          ) : null}
        </OauCard>
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

/**
 * The foot of the page (section 13.21): the book, LavenderBook's name, OAU's
 * credit (which opens oneamongus.ca), and last the intersex-inclusive Progress
 * Pride flag, which opens nothing.
 */
function Colophon() {
  return (
    <View className="items-center gap-1.5 pt-4">
      <LogoImage logo={BOOK_LARGE} />
      <Text oauStyle="heading" className="text-foreground">
        LavenderBook
      </Text>
      <OauBadge />
      <View className="mt-1">
        <PrideFlag />
      </View>
    </View>
  );
}
