import { DoorOpen } from 'lucide-react-native';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { useIsWideViewport } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { leaveNow, useIsComputer, useLeaveNowShown, useSafety } from '@/lib/safety';
import { SAFETY_LANGUAGES } from '@/lib/safety-notice-text';
import { cn } from '@/lib/utils';

/**
 * The website's "Leave now" button, on every screen.
 *
 * Rendered once, at the root, after the portal host: the review and venue
 * sheets and every dialog are portals, and a button inside the screens would
 * sit under them - unreachable exactly while someone is reading a review. Up
 * here nothing covers it.
 *
 * Wide: in the header row, at its right end - LeaveNowHeaderSpace keeps the
 * tabs clear of it. Narrow: the top-right corner, with the map's controls and
 * the dialogs kept clear of it by useLeaveNowReserve.
 */

/** The header row (tab-bar.tsx): h-14, max-w-5xl content, px-6. */
const HEADER_HEIGHT = 56;
const HEADER_MAX_WIDTH = 1024;
const HEADER_PADDING = 24;

/** Narrow: from the window's edges, the same as the map's controls. */
const EDGE = 12;
/** Between it and whatever moves down to clear it. */
const GAP = 8;
/** py-2 and a line of text-sm. */
const PILL_HEIGHT = 36;

/**
 * How far down anything at the top of a narrow screen moves to clear the
 * button; 0 when it is not there. The map's controls cannot share its row - on
 * a phone they fill it already, and "Partir maintenant" would not fit beside
 * them in any case - so they move down a row. Dialogs keep the same distance
 * from the top (and, being centred, from the bottom), so the button never sits
 * on a dialog's close button.
 */
export function useLeaveNowReserve(): { top: number } {
  const shown = useLeaveNowShown();
  const { isWide } = useIsWideViewport();
  return { top: shown && !isWide ? PILL_HEIGHT + GAP : 0 };
}

type FaceProps = {
  /** "Or press Shift 3 times" beside it: computers only. */
  hint: boolean;
  /** False for the header's invisible stand-in. */
  interactive?: boolean;
};

/** The button and its hint. One component for both copies, so they are always the same size. */
function LeaveNowFace({ hint, interactive = false }: FaceProps) {
  const { language, text } = useSafety();
  const info = SAFETY_LANGUAGES[language];
  // Its own language, so a screen reader pronounces it and the browser picks
  // the right font, inside an otherwise English page.
  const languageProps = Platform.OS === 'web' ? { lang: info.tag, dir: info.rtl ? 'rtl' : 'ltr' } : {};
  const pill = 'flex-row items-center gap-1.5 rounded-full bg-destructive px-3.5 py-2 shadow-md';
  const content = (
    <>
      <Icon as={DoorOpen} className="size-4 text-white" />
      <Text className="text-sm font-semibold text-white">{text.leaveNowButton}</Text>
    </>
  );

  return (
    <View className="flex-row items-center gap-3">
      {hint ? (
        <Text className="text-xs text-muted-foreground" {...languageProps}>
          {text.shiftHint}
        </Text>
      ) : null}
      {interactive ? (
        <Pressable
          onPress={leaveNow}
          accessibilityRole="button"
          accessibilityLabel={text.leaveNowLabel}
          className={cn(pill, 'active:opacity-80', Platform.select({ web: 'cursor-pointer hover:opacity-90' }))}
          {...languageProps}>
          {content}
        </Pressable>
      ) : (
        <View className={pill}>{content}</View>
      )}
    </View>
  );
}

export function LeaveNowButton() {
  const shown = useLeaveNowShown();
  const { isWide } = useIsWideViewport();
  const { width } = useWindowDimensions();
  const computer = useIsComputer();
  if (!shown) return null;

  return (
    <View
      style={
        isWide
          ? {
              top: 0,
              height: HEADER_HEIGHT,
              // Exactly over LeaveNowHeaderSpace: the right edge of the header's
              // centred content, less its padding.
              right: (width - Math.min(width, HEADER_MAX_WIDTH)) / 2 + HEADER_PADDING,
            }
          : { top: EDGE, right: EDGE }
      }
      className="absolute justify-center">
      {/* A narrow screen is a phone or a tablet almost always: no Shift key. */}
      <LeaveNowFace interactive hint={computer && isWide} />
    </View>
  );
}

/**
 * An invisible copy of the button at the end of the header row, so the tabs
 * leave room for the real one drawn over it. Same component, same text, so the
 * same size in every language.
 */
export function LeaveNowHeaderSpace() {
  const shown = useLeaveNowShown();
  const computer = useIsComputer();
  if (!shown) return null;

  return (
    <View aria-hidden className="ml-3 opacity-0">
      <LeaveNowFace hint={computer} />
    </View>
  );
}
