import { Info, VenetianMask } from 'lucide-react-native';
import * as React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * For a dialog button's label: stretch across the button and centre the text.
 *
 * A label sized exactly to its text can lose its last word on Android: the
 * width measured for it can come out a fraction short of what drawing it
 * needs, so the last word wraps onto a second line that is clipped away -
 * "Turn off" rendered as "Turn" on a Pixel 10. Fractional pixel ratios and
 * manufacturer fonts make it likelier, and which strings it hits varies by
 * phone. Given the button's whole width there is nothing to wrap. On the web,
 * where the buttons size to their labels, grow has no room to take.
 */
const BUTTON_LABEL = 'grow text-center';

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

/** One paragraph of the explanation, under a heading that says what it answers. */
function Point({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">{title}</Text>
      <Text className="text-sm leading-5 text-muted-foreground">{children}</Text>
    </View>
  );
}

type ExplanationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayName: string;
};

/**
 * What the switch is for, in the reader's terms rather than the schema's.
 *
 * It says plainly what the feature cannot do as well as what it does: someone
 * relying on it for their safety needs to know that their own words can still
 * identify them, and that moderators can still see the account. Overselling a
 * privacy control is how people get hurt by one.
 */
function Explanation({ open, onOpenChange, displayName }: ExplanationProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The whole dialog fits between the status bar and the navigation bar, with
  // a margin, on any screen: a short phone, split screen, a foldable's cover
  // screen, or text turned up in the system settings. The title and "Got it"
  // keep their size; the explanation between them is what gives way and
  // scrolls. A cap on the middle alone would not hold, because the title and
  // the button grow with the text size too.
  const maxHeight = height - insets.top - insets.bottom - 32;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sm: only. An unprefixed max-w replaces the base max-w-[calc(100%-2rem)]
          that keeps the dialog inside a phone screen, and 28rem is wider than
          most phones - the dialog was clipped on both sides on Android. */}
      <DialogContent className="sm:max-w-md" style={{ maxHeight }}>
        <DialogHeader>
          <View className="flex-row items-center gap-2">
            <Icon as={VenetianMask} className="size-5 text-foreground" />
            <DialogTitle>Per-place names</DialogTitle>
          </View>
          <DialogDescription>
            Each review you post gets its own name, so your reviews can&apos;t be linked together.
          </DialogDescription>
        </DialogHeader>

        {/* shrink, so this is the part that gives up height when the dialog
            meets its cap; grow-0, so it never takes more than its text. */}
        <ScrollView className="shrink grow-0">
          <View className="gap-4">
            <Point title="Why it matters">
              If all your reviews share one name, anyone can see every place you&apos;ve been. A
              few places can be enough to work out who you are.
            </Point>
            <Point title="What it does">
              Each review shows a new random name instead of {displayName}. Editing a review keeps
              its name.
            </Point>
            <Point title="What it can't hide">
              What you write, and when, can still give you away, so leave out personal details.
              Moderators can still see which account posted a review.
            </Point>
            <Point title="If turned off">
              New reviews will show {displayName}. Reviews you&apos;ve already posted keep their
              own names.
            </Point>
          </View>
        </ScrollView>

        <DialogFooter>
          <Button onPress={() => onOpenChange(false)}>
            <Text className={BUTTON_LABEL}>Got it</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PerPlaceNamesSettingProps = {
  /** Called after turning the setting on, which renames existing reviews. */
  onRenamed?: () => void;
};

/**
 * The account tab's switch for per-place names, with the way in to what it means.
 *
 * Turning it on applies at once - it only ever removes a link. Turning it off
 * asks first, because from then on every new review carries the account name
 * and can be lined up with the others, and that is not something to do by a
 * stray tap. See supabase/migrations/20261009120000_per_place_names.sql.
 */
export function PerPlaceNamesSetting({ onRenamed }: PerPlaceNamesSettingProps) {
  const { profile, setPerPlaceNames } = useAuth();
  const [explaining, setExplaining] = React.useState(false);
  const [confirmingOff, setConfirmingOff] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Nothing to show until the profile arrives: a switch drawn "off" while the
  // real value is in flight would claim the reviews are exposed when they are not.
  if (!profile) return null;

  const enabled = profile.per_place_names;
  const displayName = profile.display_name;

  async function apply(next: boolean) {
    setError(null);
    setBusy(true);
    try {
      await setPerPlaceNames(next);
      if (next) onRenamed?.();
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
          accessibilityLabel="What are per-place names?"
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
                  as={VenetianMask}
                  className={cn(
                    'size-5',
                    enabled ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}
                />
              </View>

              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-medium text-foreground">Per-place names</Text>
                  <Icon as={Info} className="size-4 text-muted-foreground" />
                </View>
                <Text className="text-xs text-muted-foreground">
                  {enabled
                    ? 'Each review gets its own random name.'
                    : `New reviews show ${displayName}.`}
                </Text>
              </View>
            </View>

            <View style={SWITCH_TARGET}>
              <Switch
                checked={enabled}
                disabled={busy}
                accessibilityLabel="Per-place names"
                onCheckedChange={(next) => (next ? void apply(true) : setConfirmingOff(true))}
              />
            </View>
          </View>

          {!enabled || error ? (
            <View className="gap-3" style={IGNORE_TOUCHES}>
              {!enabled ? (
                <Text className="text-xs text-destructive">
                  Off: reviews you post now all share one name, so they can be linked to each
                  other.
                </Text>
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

      <Explanation open={explaining} onOpenChange={setExplaining} displayName={displayName} />

      <AlertDialog open={confirmingOff} onOpenChange={setConfirmingOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off per-place names?</AlertDialogTitle>
            <AlertDialogDescription>
              Reviews you post from now on will all show {displayName}, so anyone can tell they
              came from the same person. Reviews you have already posted keep their own names.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text className={BUTTON_LABEL}>Keep them on</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onPress={() => {
                setConfirmingOff(false);
                void apply(false);
              }}>
              <Text className={cn(BUTTON_LABEL, 'text-white')}>Turn off</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
