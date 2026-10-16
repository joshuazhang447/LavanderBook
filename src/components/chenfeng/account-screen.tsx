import { router } from 'expo-router';
import { useTabTrigger } from 'expo-router/ui';
import {
  Calendar,
  CalendarOff,
  CircleUser,
  DoorOpen,
  Map as MapIcon,
  Navigation,
  Palette,
  ShieldAlert,
  SquarePen,
  Trash2,
  TriangleAlert,
  User,
  VenetianMask,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { LargeTitleScreen } from '@/components/chenfeng/large-title-screen';
import { SignInSheet } from '@/components/chenfeng/sign-in-sheet';
import { SwipeRow } from '@/components/chenfeng/swipe-row';
import { useMyReviews, type MyReview } from '@/components/my-reviews-list';
import { OauBadge } from '@/components/oau-badge';
import { ReviewSheet } from '@/components/review-sheet';
import { StarRating } from '@/components/star-rating';
import { confirmActionSheet, confirmAlert } from '@/components/ui/confirm';
import { Icon } from '@/components/ui/icon';
import { EmptyState, List, Row, Section } from '@/components/ui/list';
import { Menu, measureAnchor, type MenuAnchor } from '@/components/ui/menu';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { lightImpact } from '@/lib/haptics';
import { focusMapOn } from '@/lib/map-focus';
import { useMapLocation } from '@/lib/map-location';
import {
  accountNameNote,
  DATES_OFF_WARNING,
  LEAVE_NOW_OFF_WARNING,
  NAMES_OFF_WARNING,
} from '@/lib/privacy-text';
import { reopenSafetyNotice, useSafety } from '@/lib/safety';
import { SKINS, useSkinChoice } from '@/lib/skin';
import { supabase } from '@/lib/supabase';
import type { SelectedPoi } from '@/lib/venues';

/**
 * Chenfeng's Account tab (guideline section 14.5): a grouped list under the
 * large title "Account", in place of Basic's folded card, chips and bordered
 * switch boxes - and with their purpose kept. Each privacy setting is a row
 * that states its value and opens a page of its own; a setting turned to its
 * less private side says so in red, with a warning symbol and, under the
 * section, what that exposes. Nothing about what the settings do changes.
 */
export function ChenfengAccountScreen() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-grouped">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <LargeTitleScreen title="Account" grouped>
      {session ? <SignedIn key={session.user.id} /> : <SignedOut />}
    </LargeTitleScreen>
  );
}

/** The 60 pt avatar: iOS's filled person, grey. */
function Avatar() {
  if (Platform.OS === 'ios') {
    return <Icon as={CircleUser} size={60} filled className="text-system-gray" />;
  }
  return (
    <View className="size-[60px] items-center justify-center rounded-full bg-system-gray">
      <Icon as={User} size={32} strokeWidth={2.25} className="text-white" />
    </View>
  );
}

function OnOff({ on, warn }: { on: boolean; warn?: boolean }) {
  if (on || !warn) {
    return (
      <Text textStyle="body" className="text-label-secondary">
        {on ? 'On' : 'Off'}
      </Text>
    );
  }
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon as={TriangleAlert} size={15} filled className="text-destructive" />
      <Text textStyle="body" className="text-destructive">
        Off
      </Text>
    </View>
  );
}

function PrivacySection() {
  const { profile } = useAuth();
  const { usingDevice } = useMapLocation();
  const { leaveButton } = useSafety();
  const web = Platform.OS === 'web';

  // What is weakened, in the words its own page warns with.
  const warnings = [
    web && !leaveButton ? LEAVE_NOW_OFF_WARNING : null,
    profile && !profile.per_place_names ? NAMES_OFF_WARNING : null,
    profile && !profile.hide_dates ? DATES_OFF_WARNING : null,
  ].filter((warning): warning is string => !!warning);

  return (
    <Section
      header="Privacy"
      footer={warnings.length > 0 ? warnings.join(' ') : undefined}
      footerTone="destructive">
      <Row
        title="Use My Location"
        tile={{ icon: Navigation, className: 'bg-primary' }}
        detail={<OnOff on={usingDevice} />}
        accessory="chevron"
        accessibilityLabel={`Use My Location, ${usingDevice ? 'On' : 'Off'}`}
        onPress={() => router.push('/account/location')}
      />
      {/* The phone app has no button to show or hide. */}
      {web ? (
        <Row
          title="Leave Now Button"
          tile={{ icon: DoorOpen, className: 'bg-destructive' }}
          detail={<OnOff on={leaveButton} warn />}
          accessory="chevron"
          accessibilityLabel={`Leave Now Button, ${leaveButton ? 'On' : 'Off'}`}
          onPress={() => router.push('/account/leave-now')}
        />
      ) : null}
      {/* Nothing to show until the profile arrives: drawn "off" while the real
          value is in flight, it would claim the reviews are exposed. */}
      {profile ? (
        <Row
          title="Per-Place Names"
          tile={{ icon: VenetianMask, className: 'bg-system-purple' }}
          detail={<OnOff on={profile.per_place_names} warn />}
          accessory="chevron"
          accessibilityLabel={`Per-Place Names, ${profile.per_place_names ? 'On' : 'Off'}`}
          onPress={() => router.push('/account/names')}
        />
      ) : null}
      {profile ? (
        <Row
          title="Hide Exact Dates"
          tile={{ icon: CalendarOff, className: 'bg-star' }}
          detail={<OnOff on={profile.hide_dates} warn />}
          accessory="chevron"
          accessibilityLabel={`Hide Exact Dates, ${profile.hide_dates ? 'On' : 'Off'}`}
          onPress={() => router.push('/account/dates')}
        />
      ) : null}
    </Section>
  );
}

function GuestPrivacySection() {
  const { usingDevice } = useMapLocation();
  const { leaveButton } = useSafety();
  const web = Platform.OS === 'web';

  return (
    <Section
      header="Privacy"
      footer={web && !leaveButton ? LEAVE_NOW_OFF_WARNING : undefined}
      footerTone="destructive">
      <Row
        title="Use My Location"
        tile={{ icon: Navigation, className: 'bg-primary' }}
        detail={<OnOff on={usingDevice} />}
        accessory="chevron"
        accessibilityLabel={`Use My Location, ${usingDevice ? 'On' : 'Off'}`}
        onPress={() => router.push('/account/location')}
      />
      {web ? (
        <Row
          title="Leave Now Button"
          tile={{ icon: DoorOpen, className: 'bg-destructive' }}
          detail={<OnOff on={leaveButton} warn />}
          accessory="chevron"
          accessibilityLabel={`Leave Now Button, ${leaveButton ? 'On' : 'Off'}`}
          onPress={() => router.push('/account/leave-now')}
        />
      ) : null}
    </Section>
  );
}

function AppearanceSection() {
  const { skin } = useSkinChoice();
  const label = SKINS.find((option) => option.id === skin)?.label ?? '';
  return (
    <Section>
      <Row
        title="Appearance"
        tile={{ icon: Palette, className: 'bg-system-indigo' }}
        detail={label}
        accessory="chevron"
        onPress={() => router.push('/account/appearance')}
      />
    </Section>
  );
}

function SafetySection() {
  return (
    <Section>
      <Row
        title="Safety Notice"
        tile={{ icon: ShieldAlert, className: 'bg-system-gray' }}
        accessory="chevron"
        // The notice itself is the same in every skin.
        onPress={reopenSafetyNotice}
      />
    </Section>
  );
}

function SignedIn() {
  const { profile, signOut } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <List>
      <Section footer={accountNameNote(profile ? profile.per_place_names : null)}>
        <Row leading={<Avatar />} leadingWidth={60} className="py-3">
          <Text textStyle="title3" emphasized numberOfLines={2} className="text-foreground">
            {profile?.display_name ?? 'Loading Name…'}
          </Text>
          <Text textStyle="subheadline" className="text-label-secondary">
            Signed in with Google
          </Text>
        </Row>
      </Section>

      <PrivacySection />
      <AppearanceSection />
      <ReviewsSection />
      <SafetySection />

      <Section footer={error ?? undefined} footerTone="destructive">
        <Row
          title="Sign Out"
          tone="destructive"
          centered
          disabled={busy}
          onPress={async () => {
            setError(null);
            setBusy(true);
            try {
              await signOut();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Something went wrong.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </Section>
      <OauBadge className="mt-2" />
    </List>
  );
}

function SignedOut() {
  const [signingIn, setSigningIn] = React.useState(false);

  return (
    <>
      <List>
        <Section>
          <Row
            leading={<Avatar />}
            leadingWidth={60}
            className="py-3"
            accessory="chevron"
            accessibilityLabel="Sign In. Post reviews under a name of their own."
            onPress={() => setSigningIn(true)}>
            <Text textStyle="title3" emphasized className="text-foreground">
              Sign In
            </Text>
            <Text textStyle="subheadline" className="text-label-secondary">
              Post reviews under a name of their own.
            </Text>
          </Row>
        </Section>
        <GuestPrivacySection />
        <AppearanceSection />
        <SafetySection />
        <OauBadge className="mt-2" />
      </List>
      {signingIn ? <SignInSheet onClose={() => setSigningIn(false)} /> : null}
    </>
  );
}

/**
 * The account's reviews: tap one to edit it; swipe it, or hold it, for Show on
 * Map and Delete Review - the same actions three ways, and to VoiceOver too.
 */
function ReviewsSection() {
  const { switchTab } = useTabTrigger({ name: 'map' });
  const { reviews, refetch } = useMyReviews();
  const [open, setOpen] = React.useState<MyReview | null>(null);
  const [menu, setMenu] = React.useState<{ review: MyReview; anchor: MenuAnchor } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function showOnMap(review: MyReview) {
    if (review.venue.lat === null || review.venue.lng === null) return;
    focusMapOn({ latitude: review.venue.lat, longitude: review.venue.lng });
    switchTab('map', {});
  }

  async function remove(review: MyReview) {
    const choice = await confirmActionSheet({
      message: "This review will be removed from LavenderBook. This can't be undone.",
      actions: [{ label: 'Delete Review', style: 'destructive' }],
    });
    if (choice !== 0) return;
    setError(null);
    const { error: deleteError } = await supabase.rpc('delete_my_review', {
      p_venue_id: review.venue.id,
    });
    if (deleteError) {
      setError(deleteError.message);
      void confirmAlert({
        title: "Couldn't Delete the Review",
        message: deleteError.message,
        buttons: [{ label: 'OK', style: 'cancel' }],
      });
      return;
    }
    refetch();
  }

  if (reviews === null) {
    return (
      <Section header="Reviews">
        <View className="items-center py-6">
          <ActivityIndicator />
        </View>
      </Section>
    );
  }

  if (reviews.length === 0) {
    return (
      <View>
        <Section header="Reviews" />
        <EmptyState
          icon={SquarePen}
          title="No Reviews Yet"
          description="Tap a place on the map to write the first one."
          className="py-6"
        />
      </View>
    );
  }

  return (
    <>
      <Section
        header="Reviews"
        headerTrailing={String(reviews.length)}
        footer={error ?? undefined}
        footerTone="destructive">
        {reviews.map((review) => {
          const located = review.venue.lat !== null && review.venue.lng !== null;
          return (
            <SwipeRow
              key={review.venue.id}
              actions={[
                ...(located
                  ? [{ label: 'Show on Map', icon: MapIcon, tone: 'tint' as const, onPress: () => showOnMap(review) }]
                  : []),
                { label: 'Delete Review', icon: Trash2, tone: 'destructive' as const, onPress: () => void remove(review) },
              ]}>
              <ReviewRow
                review={review}
                onPress={() => setOpen(review)}
                onLongPress={async (target) => {
                  const anchor = await measureAnchor(target);
                  if (!anchor) return;
                  lightImpact();
                  setMenu({ review, anchor });
                }}
                onShowOnMap={located ? () => showOnMap(review) : undefined}
                onDelete={() => void remove(review)}
              />
            </SwipeRow>
          );
        })}
      </Section>

      <Menu
        anchor={menu?.anchor ?? null}
        contextual
        accessibilityLabel={menu ? `${menu.review.venue.name} actions` : 'Review actions'}
        onClose={() => setMenu(null)}
        groups={
          menu
            ? [
                [
                  { label: 'Edit Review', icon: SquarePen, onPress: () => setOpen(menu.review) },
                  ...(menu.review.venue.lat !== null
                    ? [{ label: 'Show on Map', icon: MapIcon, onPress: () => showOnMap(menu.review) }]
                    : []),
                ],
                [
                  {
                    label: 'Delete Review',
                    icon: Trash2,
                    destructive: true,
                    onPress: () => void remove(menu.review),
                  },
                ],
              ]
            : []
        }
      />

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
    </>
  );
}

function ReviewRow({
  review,
  onPress,
  onLongPress,
  onShowOnMap,
  onDelete,
}: {
  review: MyReview;
  onPress: () => void;
  onLongPress: (target: View | null) => void;
  onShowOnMap?: () => void;
  onDelete: () => void;
}) {
  const ref = React.useRef<View>(null);
  const shownAs = review.alias ? `Shown as ${review.alias}` : 'Shown under your account name';
  const dated = review.posted
    ? review.hideDate
      ? `Dated "${review.posted}"`
      : `Dated ${review.posted}`
    : null;

  return (
    <View ref={ref} collapsable={false}>
      <Row
        accessory="chevron"
        onPress={onPress}
        onLongPress={() => onLongPress(ref.current)}
        // One element, read as one sentence.
        accessibilityLabel={`${review.venue.name}, ${review.stars} of 5 stars, ${shownAs}${
          dated ? `, ${dated}` : ''
        }`}
        accessibilityHint="Opens the review to edit it."
        accessibilityActions={[
          { name: 'edit', label: 'Edit Review' },
          ...(onShowOnMap ? [{ name: 'map', label: 'Show on Map' }] : []),
          { name: 'delete', label: 'Delete Review' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'edit') onPress();
          if (event.nativeEvent.actionName === 'map') onShowOnMap?.();
          if (event.nativeEvent.actionName === 'delete') onDelete();
        }}>
        <View className="flex-row items-center gap-2">
          <Text textStyle="body" numberOfLines={1} className="flex-1 text-foreground">
            {review.venue.name}
          </Text>
          <StarRating value={review.stars} size="xs" />
        </View>
        {/* Readers see a different name on each review, so this is the only
            place the author can match one with what they wrote; and what
            readers see for the date, so "hidden" can be checked. */}
        <View className="mt-0.5 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Icon
              as={review.alias ? VenetianMask : CircleUser}
              size={13}
              className="text-label-secondary"
            />
            <Text textStyle="footnote" numberOfLines={1} className="flex-1 text-label-secondary">
              {shownAs}
            </Text>
          </View>
          {dated ? (
            <View className="flex-row items-center gap-1.5">
              <Icon
                as={review.hideDate ? CalendarOff : Calendar}
                size={13}
                className="text-label-secondary"
              />
              <Text textStyle="footnote" numberOfLines={1} className="flex-1 text-label-secondary">
                {dated}
              </Text>
            </View>
          ) : null}
        </View>
      </Row>
    </View>
  );
}
