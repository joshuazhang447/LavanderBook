import { useFocusEffect } from 'expo-router';
import {
  Calendar,
  CalendarOff,
  ChevronDown,
  ChevronUp,
  CircleUser,
  DoorClosed,
  DoorOpen,
  LocateFixed,
  MapPin,
  VenetianMask,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { PrivacySettings } from '@/components/privacy-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { useMapLocation } from '@/lib/map-location';
import { useSafety } from '@/lib/safety';
import { cn } from '@/lib/utils';

type ChipProps = {
  icon: LucideIcon;
  label: string;
  /** Red: this setting is off and something is less private because of it. */
  warn?: boolean;
};

function Chip({ icon, label, warn }: ChipProps) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-full border px-2 py-0.5',
        warn ? 'border-destructive' : 'border-border'
      )}>
      <Icon as={icon} className={cn('size-3', warn ? 'text-destructive' : 'text-muted-foreground')} />
      <Text className={cn('text-xs', warn ? 'text-destructive' : 'text-muted-foreground')}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The folded card's second line: every setting in one glance.
 *
 * Folding the settings away must not hide what they are set to. These are
 * safety settings, so one switched off weeks ago shows here, in red, every
 * time the tab is opened - not only to someone who thinks to unfold the card.
 */
function SettingsSummary() {
  const { profile } = useAuth();
  const { usingDevice, place } = useMapLocation();
  const { leaveButton } = useSafety();
  if (!profile) return null;

  return (
    <View className="flex-row flex-wrap gap-1.5">
      <Chip
        icon={usingDevice ? LocateFixed : MapPin}
        label={usingDevice ? 'Near me' : (place?.label ?? 'No place set')}
      />
      {/* The phone app has no button to show or hide. */}
      {Platform.OS === 'web' ? (
        <Chip
          icon={leaveButton ? DoorOpen : DoorClosed}
          label={leaveButton ? 'Leave now button' : 'Leave now hidden'}
          warn={!leaveButton}
        />
      ) : null}
      <Chip
        icon={profile.per_place_names ? VenetianMask : CircleUser}
        label={profile.per_place_names ? 'Random names' : 'Account name shown'}
        warn={!profile.per_place_names}
      />
      <Chip
        icon={profile.hide_dates ? CalendarOff : Calendar}
        label={profile.hide_dates ? 'Rough dates' : 'Dates shown'}
        warn={!profile.hide_dates}
      />
    </View>
  );
}

type AccountSettingsCardProps = {
  busy: boolean;
  onSignOut: () => void;
  /** After a switch turned on that changes how the account's reviews are shown. */
  onReviewsChanged: () => void;
};

/**
 * The signed-in account: its name and a one-line summary of its settings,
 * unfolding to the switches and Sign out.
 *
 * Folded every time the tab is opened: the switches are changed rarely, and
 * the summary already says how each is set.
 */
export function AccountSettingsCard({ busy, onSignOut, onReviewsChanged }: AccountSettingsCardProps) {
  const { profile } = useAuth();
  const [open, setOpen] = React.useState(false);

  // Fold on the way out, so the next visit - to the map and back, say - opens
  // on the name and the summary rather than a page of switches.
  useFocusEffect(React.useCallback(() => () => setOpen(false), []));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {/* The card's own padding moves into the header, so the whole folded
          card is the target and not just the middle of it. */}
      <Card className="gap-0 py-0">
        {/* Only text in here: the switches are in the content below, siblings
            rather than children, so no button ends up inside another. */}
        <CollapsibleTrigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? 'Hide account settings' : 'Show account settings'}
            accessibilityState={{ expanded: open }}
            className={cn(
              'rounded-xl py-6 active:opacity-80',
              Platform.select({ web: 'cursor-pointer' })
            )}>
            <CardHeader className="gap-3">
              <View className="flex-row items-center gap-2">
                <CardTitle className="flex-1">{profile?.display_name ?? 'Loading name...'}</CardTitle>
                <Icon
                  as={open ? ChevronUp : ChevronDown}
                  className="size-5 text-muted-foreground"
                />
              </View>
              <SettingsSummary />
            </CardHeader>
          </Pressable>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="gap-4 pb-6">
            <CardDescription>
              {/* Unknown until the profile arrives, so say only what is true
                  either way rather than guess at the switch. */}
              {profile === null
                ? 'Your account name. Your email is never public.'
                : profile.per_place_names
                  ? 'Your account name. Your reviews never show it: each one has its own. Your email is never public.'
                  : 'Your account name, shown on reviews you post from now on. Your email is never public.'}
            </CardDescription>
            <PrivacySettings onReviewsChanged={onReviewsChanged} />
            <Button variant="outline" disabled={busy} onPress={onSignOut}>
              <Text>Sign out</Text>
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
