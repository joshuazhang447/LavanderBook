import { CalendarOff, Info, VenetianMask, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

import { BUTTON_LABEL, InfoDialog, InfoPoint } from '@/components/info-dialog';
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

/**
 * Every explanation answers the same four questions, in the same order, so
 * that reading one teaches you how to read the other.
 */
type Explained = {
  lead: string;
  whyItMatters: string;
  whatItDoes: string;
  whatItCantHide: string;
  ifTurnedOff: string;
};

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
      <InfoPoint title="Why it matters">{explained.whyItMatters}</InfoPoint>
      <InfoPoint title="What it does">{explained.whatItDoes}</InfoPoint>
      <InfoPoint title="What it can't hide">{explained.whatItCantHide}</InfoPoint>
      <InfoPoint title="If turned off">{explained.ifTurnedOff}</InfoPoint>
    </InfoDialog>
  );
}

type PrivacyToggleProps = {
  icon: LucideIcon;
  title: string;
  enabled: boolean;
  /** One line under the title, for the state it is in now. */
  summary: string;
  /** Shown in red under the row while the switch is off. */
  offWarning: string;
  explained: Explained;
  confirmOff: { title: string; body: string; keep: string; confirm: string };
  /** Saves the new value; rejects with a message worth showing if it cannot. */
  onChange: (next: boolean) => Promise<void>;
};

/**
 * One privacy switch: the row, its explanation, and the question asked before
 * turning it off.
 *
 * Turning one on applies at once - it only ever takes something out of public
 * view. Turning one off asks first, because what it exposes from then on
 * cannot be taken back by turning it on again, and that is not something to do
 * by a stray tap.
 */
function PrivacyToggle({
  icon,
  title,
  enabled,
  summary,
  offWarning,
  explained,
  confirmOff,
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
      <View className="rounded-lg border border-border">
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
                onCheckedChange={(next) => (next ? void apply(true) : setConfirmingOff(true))}
              />
            </View>
          </View>

          {!enabled || error ? (
            <View className="gap-3" style={IGNORE_TOUCHES}>
              {!enabled ? <Text className="text-xs text-destructive">{offWarning}</Text> : null}
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
    </View>
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
 * The account's two privacy switches: a separate name on every review, and
 * no exact dates. Both on by default, both enforced by the database rather
 * than by this screen - see the per_place_names and hide_review_dates
 * migrations.
 */
export function PrivacySettings({ onReviewsChanged }: PrivacySettingsProps) {
  const { profile, setPerPlaceNames, setHideDates } = useAuth();

  // Nothing to show until the profile arrives: a switch drawn "off" while the
  // real value is in flight would claim the reviews are exposed when they are not.
  if (!profile) return null;

  const name = profile.display_name;

  return (
    <View className="gap-3">
      <PrivacyToggle
        icon={VenetianMask}
        title="Per-place names"
        enabled={profile.per_place_names}
        summary={
          profile.per_place_names
            ? 'Each review gets its own random name.'
            : `New reviews show ${name}.`
        }
        offWarning="Off: reviews you post now all share one name, so they can be linked to each other."
        explained={{
          lead: "Each review you post gets its own name, so your reviews can't be linked together.",
          whyItMatters:
            "If all your reviews share one name, anyone can see every place you've been. A few places can be enough to work out who you are.",
          whatItDoes: `Each review shows a new random name instead of ${name}. Editing a review keeps its name.`,
          whatItCantHide:
            'What you write, and when, can still give you away, so leave out personal details. Moderators can still see which account posted a review.',
          ifTurnedOff: `New reviews will show ${name}. Reviews you've already posted keep their own names.`,
        }}
        confirmOff={{
          title: 'Turn off per-place names?',
          body: `Reviews you post from now on will all show ${name}, so anyone can tell they came from the same person. Reviews you have already posted keep their own names.`,
          keep: 'Keep them on',
          confirm: 'Turn off',
        }}
        onChange={async (next) => {
          await setPerPlaceNames(next);
          if (next) onReviewsChanged?.();
        }}
      />

      <PrivacyToggle
        icon={CalendarOff}
        title="Hide exact dates"
        enabled={profile.hide_dates}
        summary={
          profile.hide_dates
            ? 'Reviews show a rough time, like "a few weeks ago".'
            : 'New reviews show the day you post them.'
        }
        offWarning="Off: the day you post can be matched against other records of who was there."
        explained={{
          lead: 'Your reviews show roughly when you posted them, never the exact day.',
          whyItMatters:
            'Apps, advertisers and phone companies keep records of where phones were and when. The exact day of a review can be matched against them to work out who was there.',
          whatItDoes:
            'Readers see a rough time, like "a few weeks ago", instead of the date, and never the time of day. Each review keeps the setting it was posted with.',
          whatItCantHide:
            "Anyone watching closely can still notice when a new review appears, so it's safer to post after you've left. Moderators can still see exact times.",
          ifTurnedOff:
            "New reviews will show the day you post them. Reviews you've already posted keep showing a rough time.",
        }}
        confirmOff={{
          title: 'Show dates on new reviews?',
          body: "Reviews you post from now on will show the day you posted them, and that day can be matched against other records of who was there. Reviews you've already posted keep showing a rough time.",
          keep: 'Keep them hidden',
          confirm: 'Show dates',
        }}
        // No onReviewsChanged: unlike names, this never changes a review already
        // posted, so the list below is still right. Hiding older dates all at
        // once would show, live, that those reviews came from one person.
        onChange={setHideDates}
      />
    </View>
  );
}
