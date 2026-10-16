import {
  CalendarOff,
  DoorOpen,
  Info,
  LocateFixed,
  VenetianMask,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { CityPicker } from '@/components/city-picker';
import { BUTTON_LABEL, InfoDialog, InfoPoint } from '@/components/info-dialog';
import { LocationBlockedNotice } from '@/components/location-choice';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import {
  chooseDeviceLocation,
  stopUsingDeviceLocation,
  useMapLocation,
} from '@/lib/map-location';
import {
  DATES_CONFIRM_OFF,
  DATES_EXPLAINED,
  DATES_OFF_WARNING,
  datesSummary,
  EXPLANATION_HEADINGS,
  LEAVE_NOW_EXPLAINED,
  LEAVE_NOW_OFF_WARNING,
  leaveNowSummary,
  LOCATION_DENIED,
  LOCATION_EXPLAINED,
  locationSummary,
  namesConfirmOff,
  namesExplained,
  NAMES_OFF_WARNING,
  namesSummary,
  type Explained,
} from '@/lib/privacy-text';
import { setLeaveNowButton, useSafety } from '@/lib/safety';
import { cn } from '@/lib/utils';

/**
 * For a container drawn over a pressable: touches pass through it to whatever
 * is underneath, but its children can still take them.
 *
 * Native has a value for exactly that, box-none. The web does not:
 * react-native-web drops box-none given as an inline style, and in CSS the same
 * effect is none on the container with auto restored on the child that should
 * respond - see SWITCH_TARGET.
 */
const PASS_THROUGH: ViewStyle = { pointerEvents: Platform.OS === 'web' ? 'none' : 'box-none' };

/** The one thing inside a PASS_THROUGH container that takes touches itself. */
const SWITCH_TARGET: ViewStyle = { pointerEvents: 'auto' };

/** Content drawn over a pressable that must never take a touch from it. */
const IGNORE_TOUCHES: ViewStyle = { pointerEvents: 'none' };


type ExplanationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  explained: Explained;
};

/**
 * What a switch is for, in the reader's terms rather than the schema's.
 *
 * It says plainly what the feature cannot do as well as what it does: someone
 * relying on it for their safety needs to know what can still identify them,
 * and that moderators can still see more than the public does. Overselling a
 * privacy control is how people get hurt by one.
 */
function Explanation({ open, onOpenChange, icon, title, explained }: ExplanationProps) {
  return (
    <InfoDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={icon}
      title={title}
      lead={explained.lead}>
      <InfoPoint title={EXPLANATION_HEADINGS.sentence.whyItMatters}>{explained.whyItMatters}</InfoPoint>
      <InfoPoint title={EXPLANATION_HEADINGS.sentence.whatItDoes}>{explained.whatItDoes}</InfoPoint>
      <InfoPoint title={EXPLANATION_HEADINGS.sentence.whatItCantHide}>
        {explained.whatItCantHide}
      </InfoPoint>
      <InfoPoint title={EXPLANATION_HEADINGS.sentence.ifTurnedOff}>{explained.ifTurnedOff}</InfoPoint>
    </InfoDialog>
  );
}

type PrivacyToggleProps = {
  icon: LucideIcon;
  title: string;
  enabled: boolean;
  /** One line under the title, for the state it is in now. */
  summary: string;
  /**
   * Shown in red under the row while the switch is off. Only for a switch
   * whose off side is the less private one.
   */
  offWarning?: string;
  explained: Explained;
  /**
   * Asked before switching off. Only for a switch whose off side is the less
   * private one; without it, off applies at once.
   */
  confirmOff?: { title: string; body: string; keep: string; confirm: string };
  /**
   * More of the box, under the row. Drawn over the box's own pressable like the
   * rest, so it has to say which parts take touches: IGNORE_TOUCHES on text,
   * SWITCH_TARGET on anything pressable.
   */
  extra?: React.ReactNode;
  /** Saves the new value; rejects with a message worth showing if it cannot. */
  onChange: (next: boolean) => Promise<void>;
};

/**
 * One privacy switch: the row, its explanation, and - for a switch whose off
 * side exposes something - the question asked before turning it off.
 *
 * For per-place names and hidden dates, on is the private side: turning them
 * on applies at once, and turning them off asks first, because what that
 * exposes cannot be taken back by turning them on again. Location is the other
 * way round - on shares something - so it passes no confirmOff and no
 * offWarning, and the OS's own prompt is the question asked on the way in.
 */
function PrivacyToggle({
  icon,
  title,
  enabled,
  summary,
  offWarning,
  explained,
  confirmOff,
  extra,
  onChange,
}: PrivacyToggleProps) {
  const [explaining, setExplaining] = React.useState(false);
  const [confirmingOff, setConfirmingOff] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function apply(next: boolean) {
    setError(null);
    setBusy(true);
    try {
      await onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change this setting.');
    } finally {
      setBusy(false);
    }
  }

  return (
    // The dialogs sit outside the bordered box: their roots render an empty
    // element on the web, and inside a gap-3 column each one adds a gap.
    <View>
      {/* Anywhere in the box opens the explanation except the switch. One
          pressable fills the box from behind, and everything drawn over it lets
          touches through to it apart from the switch. Wrapping the box in a Pressable
          instead would put the switch's button inside another button, which is
          invalid HTML on the web and breaks hydration. */}
      {/* bg-card: in Basic the same colour as the page, so nothing changes; in
          the other skins the box takes their card colour, like their cards. */}
      <View className="rounded-lg border border-border bg-card">
        <Pressable
          onPress={() => setExplaining(true)}
          accessibilityRole="button"
          accessibilityLabel={`What is "${title}"?`}
          className={cn(
            'absolute inset-0 rounded-lg active:bg-accent',
            Platform.select({ web: 'cursor-pointer hover:bg-accent/50' })
          )}
        />
        <View className="gap-3 p-4" style={PASS_THROUGH}>
          <View className="flex-row items-center gap-3" style={PASS_THROUGH}>
            <View className="flex-1 flex-row items-center gap-3" style={IGNORE_TOUCHES}>
              <View
                className={cn(
                  'size-9 items-center justify-center rounded-full',
                  enabled ? 'bg-primary' : 'bg-muted'
                )}>
                <Icon
                  as={icon}
                  className={cn(
                    'size-5',
                    enabled ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}
                />
              </View>

              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-medium text-foreground">{title}</Text>
                  <Icon as={Info} className="size-4 text-muted-foreground" />
                </View>
                <Text className="text-xs text-muted-foreground">{summary}</Text>
              </View>
            </View>

            <View style={SWITCH_TARGET}>
              <Switch
                checked={enabled}
                disabled={busy}
                accessibilityLabel={title}
                onCheckedChange={(next) =>
                  next || !confirmOff ? void apply(next) : setConfirmingOff(true)
                }
              />
            </View>
          </View>

          {extra}

          {(!enabled && offWarning) || error ? (
            <View className="gap-3" style={IGNORE_TOUCHES}>
              {!enabled && offWarning ? (
                <Text className="text-xs text-destructive">{offWarning}</Text>
              ) : null}
              {error ? (
                <Text className="text-xs text-destructive" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <Explanation
        open={explaining}
        onOpenChange={setExplaining}
        icon={icon}
        title={title}
        explained={explained}
      />

      {confirmOff ? (
        <AlertDialog open={confirmingOff} onOpenChange={setConfirmingOff}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmOff.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmOff.body}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text className={BUTTON_LABEL}>{confirmOff.keep}</Text>
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive"
                onPress={() => {
                  setConfirmingOff(false);
                  void apply(false);
                }}>
                <Text className={cn(BUTTON_LABEL, 'text-white')}>{confirmOff.confirm}</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </View>
  );
}

/**
 * Whether the map follows the phone, and where it opens when it does not.
 *
 * For everyone, signed in or not: where the map is has nothing to do with
 * having an account, and the choice is stored on the device, never on one.
 * First in the list, because it is the one a guest has too.
 */
export function LocationSetting() {
  const { usingDevice, place } = useMapLocation();
  const [blocked, setBlocked] = React.useState(false);
  const [picking, setPicking] = React.useState(false);

  return (
    // A plain View, not a fragment: the picker's root renders an empty element
    // on the web, and loose in the settings' gap-3 column it would add a gap.
    <View>
      <PrivacyToggle
        icon={LocateFixed}
        title="Use my location"
        enabled={usingDevice}
        summary={locationSummary(usingDevice, place?.label)}
        explained={LOCATION_EXPLAINED}
        extra={
          usingDevice && !blocked ? null : (
            <View className="gap-3" style={PASS_THROUGH}>
              {blocked && !usingDevice ? (
                <View style={SWITCH_TARGET}>
                  <LocationBlockedNotice />
                </View>
              ) : null}
              {!usingDevice ? (
                // The same small outlined pill the venue sheet uses for its
                // secondary action. Sits over the box's pressable, so it takes
                // its own touches and the rest of the box still explains.
                <Pressable
                  onPress={() => setPicking(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change where the map opens"
                  style={SWITCH_TARGET}
                  className={cn(
                    'self-start rounded-full border border-border bg-background px-3 py-1.5 active:bg-accent',
                    Platform.select({ web: 'cursor-pointer hover:bg-accent' })
                  )}>
                  <Text className="text-xs font-medium text-foreground">Change place</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        onChange={async (next) => {
          if (!next) {
            setBlocked(false);
            await stopUsingDeviceLocation();
            return;
          }
          const result = await chooseDeviceLocation();
          setBlocked(result === 'blocked');
          if (result === 'denied') {
            throw new Error(LOCATION_DENIED);
          }
        }}
      />
      <CityPicker open={picking} onOpenChange={setPicking} />
    </View>
  );
}

/**
 * The website's "Leave now" button, on every screen unless this is off.
 *
 * Website only: the phone app has no button outside the notice. For everyone,
 * signed in or not, and stored on the device like location - a guest is just
 * as much at risk of being seen. Off is the less safe side, so it shows red,
 * but asks nothing: turning it back on undoes it completely. The Shift key
 * keeps working either way; it is invisible, so there is nothing to hide.
 */
export function LeaveNowSetting() {
  const { leaveButton } = useSafety();
  if (Platform.OS !== 'web') return null;

  return (
    <PrivacyToggle
      icon={DoorOpen}
      title="Leave now button"
      enabled={leaveButton}
      summary={leaveNowSummary(leaveButton)}
      offWarning={LEAVE_NOW_OFF_WARNING}
      explained={LEAVE_NOW_EXPLAINED}
      onChange={setLeaveNowButton}
    />
  );
}

type PrivacySettingsProps = {
  /**
   * Called after turning per-place names on, which renames the account's
   * existing reviews - so a list of them on screen is now stale.
   */
  onReviewsChanged?: () => void;
};

/**
 * The account's privacy switches: where the map is, the website's "Leave now"
 * button, a separate name on every review, and no exact dates. The last two
 * are on by default and enforced by the database rather than by this screen -
 * see the per_place_names and hide_review_dates migrations. The first two are
 * on the device, and a guest gets them too (as LocationSetting and
 * LeaveNowSetting).
 */
export function PrivacySettings({ onReviewsChanged }: PrivacySettingsProps) {
  const { profile, setPerPlaceNames, setHideDates } = useAuth();

  // Nothing to show until the profile arrives: a switch drawn "off" while the
  // real value is in flight would claim the reviews are exposed when they are not.
  if (!profile) return null;

  const name = profile.display_name;

  return (
    <View className="gap-3">
      <LocationSetting />
      <LeaveNowSetting />

      <PrivacyToggle
        icon={VenetianMask}
        title="Per-place names"
        enabled={profile.per_place_names}
        summary={namesSummary(profile.per_place_names, name)}
        offWarning={NAMES_OFF_WARNING}
        explained={namesExplained(name)}
        confirmOff={namesConfirmOff(name)}
        onChange={async (next) => {
          await setPerPlaceNames(next);
          if (next) onReviewsChanged?.();
        }}
      />

      <PrivacyToggle
        icon={CalendarOff}
        title="Hide exact dates"
        enabled={profile.hide_dates}
        summary={datesSummary(profile.hide_dates)}
        offWarning={DATES_OFF_WARNING}
        explained={DATES_EXPLAINED}
        confirmOff={DATES_CONFIRM_OFF}
        // No onReviewsChanged: unlike names, this never changes a review already
        // posted, so the list below is still right. Hiding older dates all at
        // once would show, live, that those reviews came from one person.
        onChange={setHideDates}
      />
    </View>
  );
}
