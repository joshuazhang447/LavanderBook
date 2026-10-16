import { Portal } from '@rn-primitives/portal';
import * as React from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLeaveNowReserve } from '@/components/leave-now';
import { useIsWideViewport } from '@/components/tab-bar';
import { useDisplaySettings } from '@/lib/accessibility';
import { materialSpring } from '@/lib/motion';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/** The wide header row's height, which a full-height sheet stays below. */
const HEADER_ROW = 56;

type BottomSheetProps = {
  /** The portal it renders in; one per kind of sheet. */
  name: string;
  onClose: () => void;
  /** Read out as the sheet's name. */
  accessibilityLabel: string;
  /** How tall it opens, as a share of the window. */
  partial: number;
  /** The sheet's top row - its title and buttons. Dragging it moves the sheet. */
  header: React.ReactNode;
  /** Everything under the header. It flexes into the sheet's height. */
  children: React.ReactNode;
  /** Lift the sheet over the keyboard (a form). */
  keyboardAvoiding?: boolean;
};

/**
 * Basic's and Material's bottom sheet: the place card and the review form. It
 * opens part of the way up; dragging its handle or its top row takes it to the
 * full height of the screen and back, and a long or quick drag down closes it,
 * as does Android's back and, on the website, Escape. Tapping the handle does
 * the same as a drag, for anyone who cannot drag.
 *
 * Full height stops under the status bar, under the website's "Leave now"
 * button on a narrow screen, and under the header row on a wide one, so nothing
 * of the sheet's sits beneath the way out (AGENTS.md, Safety notice rule 5).
 *
 * Drawn per skin: Basic keeps its card; Material is Material's modal sheet
 * (docs/material-design-guideline.md, section 13.11). Chenfeng has its own
 * (src/components/ui/sheet.tsx), which this does not touch.
 */
export function BottomSheet({
  name,
  onClose,
  accessibilityLabel,
  partial,
  header,
  children,
  keyboardAvoiding,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const leaveNow = useLeaveNowReserve();
  const { isWide } = useIsWideViewport();
  const { reduceMotion } = useDisplaySettings();
  const material = useSkin().skin === 'material';
  // Basic's sheet never bounces; Material's does, as its springs do.
  const noBounce = !material || reduceMotion;

  const partialHeight = Math.round(windowHeight * partial);
  const fullHeight = Math.max(
    partialHeight,
    windowHeight - insets.top - leaveNow.top - (isWide ? HEADER_ROW : 0)
  );

  const height = useSharedValue(partialHeight);
  const start = useSharedValue(0);
  // Full height or not: a shared value for the gesture, which runs on the UI
  // thread, and state for what is rendered (the handle's label).
  const atFull = useSharedValue(false);
  const [expanded, setExpanded] = React.useState(false);

  const goTo = React.useCallback(
    (full: boolean, velocity = 0) => {
      atFull.set(full);
      setExpanded(full);
      height.set(
        withSpring(full ? fullHeight : partialHeight, {
          ...materialSpring('defaultSpatial', noBounce, velocity),
          // Never past full height, even in a bounce: the way out's corner.
          overshootClamping: full,
        })
      );
    },
    [atFull, fullHeight, partialHeight, height, noBounce]
  );

  // The window changed size (rotation, the browser): stay at the same height.
  React.useEffect(() => {
    height.set(atFull.get() ? fullHeight : partialHeight);
  }, [atFull, fullHeight, partialHeight, height]);

  // Android's back closes the top sheet, as it would any sheet there; Escape
  // on the website.
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      return () => subscription.remove();
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [onClose]);

  const drag = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      start.set(height.get());
    })
    .onUpdate((event) => {
      const next = start.get() - event.translationY;
      // Stops at full height: nothing of it goes under the way out.
      height.set(Math.min(fullHeight, Math.max(0, next)));
    })
    .onEnd((event) => {
      const now = height.get();
      // Where a flick would carry it.
      const projected = now - event.velocityY * 0.18;
      if (projected < partialHeight * 0.55 || (event.velocityY > 1300 && now < partialHeight + 24)) {
        height.set(
          withTiming(0, { duration: 180 }, (done) => {
            if (done) runOnJS(onClose)();
          })
        );
        return;
      }
      const full = Math.abs(projected - fullHeight) < Math.abs(projected - partialHeight);
      height.set(
        withSpring(
          full ? fullHeight : partialHeight,
          { ...materialSpring('defaultSpatial', noBounce, -event.velocityY), overshootClamping: full }
        )
      );
      atFull.set(full);
      runOnJS(setExpanded)(full);
    });

  const sheetStyle = useAnimatedStyle(() => ({ height: height.get() }));

  const sheet = (
    <Animated.View
      entering={SlideInDown.duration(260)}
      exiting={SlideOutDown.duration(200)}
      role="dialog"
      aria-modal
      aria-label={accessibilityLabel}
      style={sheetStyle}
      className={cn(
        'w-full overflow-hidden',
        material
          ? 'max-w-[640px] self-center rounded-t-[28px] bg-surface-container-low'
          : 'rounded-t-3xl border-t border-border bg-background'
      )}>
      <GestureDetector gesture={drag}>
        <View>
          <Pressable
            onPress={() => goTo(!atFull.get())}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Show less' : 'Show more'}
            hitSlop={8}
            className={cn(
              'items-center',
              material ? 'pb-1 pt-[22px]' : 'pb-1 pt-3',
              Platform.select({ web: 'cursor-grab' })
            )}>
            <View
              className={cn(
                'rounded-full',
                material ? 'h-1 w-8 bg-on-surface-variant/40' : 'h-1.5 w-12 bg-muted-foreground/30'
              )}
            />
          </Pressable>
          {header}
        </View>
      </GestureDetector>
      <View className="flex-1">{children}</View>
    </Animated.View>
  );

  return (
    // Rendered through the portal host at the app root, so it covers the whole
    // screen rather than the column it was opened from.
    <Portal name={name}>
      <View className="absolute inset-0 justify-end">
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          className="absolute inset-0">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className={cn('flex-1', material ? 'bg-black/[0.32]' : 'bg-black/50')}
          />
        </Animated.View>
        {keyboardAvoiding ? <KeyboardAvoidingView behavior="padding">{sheet}</KeyboardAvoidingView> : sheet}
      </View>
    </Portal>
  );
}
