import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLeaveNowReserve } from '@/components/leave-now';
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
import { Text } from '@/components/ui/text';

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
export const BUTTON_LABEL = 'grow text-center';

/**
 * For any dialog's content: wide on a tablet or the web, and on a phone the
 * library's own inset from both edges.
 *
 * sm: only. An unprefixed max-w replaces the base max-w-[calc(100%-2rem)] that
 * keeps the dialog inside a phone screen, and 28rem is wider than most phones -
 * a dialog was clipped on both sides on Android before this.
 */
export const DIALOG_WIDTH = 'sm:max-w-md';

/**
 * The tallest a dialog may be: between the status bar and the navigation bar,
 * with a margin, on any screen - a short phone, split screen, a foldable's
 * cover screen, or text turned up in the system settings. Put it on the
 * DialogContent's style and let one part inside (a ScrollView with
 * `shrink grow-0`) give way.
 */
export function useDialogMaxHeight(): number {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // A phone browser's "Leave now" button sits over the top-right corner, where
  // a dialog's close button would be. Dialogs are centred, so the room is
  // taken at both ends.
  const { top: leaveNow } = useLeaveNowReserve();
  return height - insets.top - insets.bottom - 32 - 2 * leaveNow;
}

/** One paragraph of an explanation, under a heading that says what it answers. */
export function InfoPoint({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">{title}</Text>
      {typeof children === 'string' ? (
        <Text className="text-sm leading-5 text-muted-foreground">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

/** A short list inside an InfoPoint, for when a paragraph would bury the items. */
export function InfoBullets({ items }: { items: string[] }) {
  return (
    <View className="gap-1">
      {items.map((item) => (
        <View key={item} className="flex-row gap-2">
          <Text className="text-sm leading-5 text-muted-foreground">{'•'}</Text>
          <Text className="flex-1 text-sm leading-5 text-muted-foreground">{item}</Text>
        </View>
      ))}
    </View>
  );
}

type InfoDialogProps = React.PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  /** One sentence under the title: the whole point, for someone who reads no further. */
  lead: string;
}>;

/**
 * The app's "why" window: a title, a one-line lead, a few InfoPoints, and Got it.
 *
 * Shared because every way it can go wrong on a phone has been found once
 * already - clipped at the sides, taller than the screen, a button label
 * losing its last word - and a copy would have to find them all again.
 */
export function InfoDialog({ open, onOpenChange, icon, title, lead, children }: InfoDialogProps) {
  // The title and "Got it" keep their size; the explanation between them is
  // what gives way and scrolls. A cap on the middle alone would not hold,
  // because the title and the button grow with the text size too.
  const maxHeight = useDialogMaxHeight();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_WIDTH} style={{ maxHeight }}>
        <DialogHeader>
          <View className="flex-row items-center gap-2">
            <Icon as={icon} className="size-5 text-foreground" />
            <DialogTitle>{title}</DialogTitle>
          </View>
          <DialogDescription>{lead}</DialogDescription>
        </DialogHeader>

        {/* shrink, so this is the part that gives up height when the dialog
            meets its cap; grow-0, so it never takes more than its text. */}
        <ScrollView className="shrink grow-0">
          <View className="gap-4">{children}</View>
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
