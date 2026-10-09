import { LocateFixed, MapPin, Search, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityPicker } from '@/components/city-picker';
import { BUTTON_LABEL, DIALOG_WIDTH, useDialogMaxHeight } from '@/components/info-dialog';
import { useIsWideViewport } from '@/components/tab-bar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  chooseDeviceLocation,
  chooseGeneralArea,
  openLocationSettings,
  useMapLocation,
} from '@/lib/map-location';
import { cn } from '@/lib/utils';

/**
 * What to say when the OS will not show its location prompt again.
 *
 * Android stops asking after a second "Don't allow", iOS after the first, and a
 * browser after "Block". From then on only the phone's settings can change it,
 * so the way there is a button rather than an instruction to go and find it.
 * The web has no such button - no page can open the browser's settings.
 */
export function LocationBlockedNotice() {
  const [unavailable, setUnavailable] = React.useState(Platform.OS === 'web');

  if (unavailable) {
    return (
      <Text className="text-xs text-destructive">
        Location is blocked for this site. Allow it from the padlock or site settings beside the
        address, then come back.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-xs text-destructive">
        Location is turned off for LavenderBook in your phone&apos;s settings. Turn it on there,
        then come back - the map will start following you.
      </Text>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onPress={async () => {
          if (!(await openLocationSettings())) setUnavailable(true);
        }}>
        <Text>Open settings</Text>
      </Button>
    </View>
  );
}

type OptionProps = {
  icon: LucideIcon;
  title: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
};

function Option({ icon, title, detail, onPress, disabled }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      className={cn(
        'flex-row items-center gap-3 rounded-lg border border-border p-4 active:bg-accent',
        Platform.select({ web: 'cursor-pointer hover:bg-accent/50' }),
        disabled && 'opacity-50'
      )}>
      <View className="size-9 items-center justify-center rounded-full bg-muted">
        <Icon as={icon} className="size-5 text-foreground" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-medium text-foreground">{title}</Text>
        <Text className="text-xs text-muted-foreground">{detail}</Text>
      </View>
    </Pressable>
  );
}

type LocationChoiceProps = {
  /** After a choice was made and applied. */
  onDone?: () => void;
};

/**
 * Near me, the general area, or a city - asked before any OS prompt.
 *
 * Only "Near me" ever triggers the OS permission prompt. Choosing an area does
 * not, so the prompt is still unused when the person wants it later; declining
 * here is a normal answer, not a dead end.
 */
export function LocationChoice({ onDone }: LocationChoiceProps) {
  const { area } = useMapLocation();
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<'denied' | 'blocked' | null>(null);
  const [picking, setPicking] = React.useState(false);

  async function nearMe() {
    setBusy(true);
    setOutcome(null);
    const result = await chooseDeviceLocation();
    setBusy(false);
    if (result === 'granted') onDone?.();
    else setOutcome(result);
  }

  return (
    // The picker sits outside the gap-3 column: its root renders an empty
    // element on the web, which would otherwise take a gap of its own.
    <View>
      <View className="gap-3">
        <Option
          icon={LocateFixed}
          title="Near me"
          detail="Follows you as you move. Your exact location stays on your phone."
          onPress={() => void nearMe()}
          disabled={busy}
        />
        {outcome === 'denied' ? (
          <Text className="text-xs text-destructive">
            Location wasn&apos;t allowed. Try again, or pick a place below.
          </Text>
        ) : outcome === 'blocked' ? (
          <LocationBlockedNotice />
        ) : null}

        <Option
          icon={Search}
          title="Choose a city"
          detail="Pick any city by name."
          onPress={() => setPicking(true)}
          disabled={busy}
        />

        {area ? (
          <Option
            icon={MapPin}
            title={area.label}
            detail={
              area.source === 'time-zone'
                ? "Based on your phone's time zone. Nothing is shared."
                : "Based on your phone's region setting. Nothing is shared."
            }
            onPress={async () => {
              await chooseGeneralArea();
              onDone?.();
            }}
            disabled={busy}
          />
        ) : null}

        <Text className="text-center text-xs text-muted-foreground">
          You can change this any time in My Account.
        </Text>
      </View>
      <CityPicker open={picking} onOpenChange={setPicking} onChosen={onDone} />
    </View>
  );
}

/** The Map tab's first screen, until a choice has been made once. */
export function LocationChoiceScreen() {
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="grow justify-center"
      // Tab screens pay their own top inset; see the tabs layout rules.
      contentContainerStyle={{ paddingTop: isWide ? 0 : insets.top }}>
      <View className="w-full max-w-md gap-5 self-center px-6 py-8">
        <View className="gap-1">
          <Text className="text-2xl font-bold text-foreground">Where should the map start?</Text>
          <Text className="text-sm text-muted-foreground">
            Everything works either way, including posting reviews.
          </Text>
        </View>
        <LocationChoice />
      </View>
    </ScrollView>
  );
}

type LocationChoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** The same choice from the map's locate button, while the map is not following. */
export function LocationChoiceDialog({ open, onOpenChange }: LocationChoiceDialogProps) {
  const maxHeight = useDialogMaxHeight();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_WIDTH} style={{ maxHeight }}>
        <DialogHeader>
          <DialogTitle>Where should the map be?</DialogTitle>
          <DialogDescription>Everything works either way, including posting reviews.</DialogDescription>
        </DialogHeader>
        <ScrollView className="shrink grow-0" keyboardShouldPersistTaps="handled">
          <LocationChoice onDone={() => onOpenChange(false)} />
        </ScrollView>
        <Button variant="outline" onPress={() => onOpenChange(false)}>
          <Text className={BUTTON_LABEL}>Cancel</Text>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
