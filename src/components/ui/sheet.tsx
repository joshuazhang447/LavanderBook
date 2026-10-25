import { Portal } from '@rn-primitives/portal';
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
} from 'react-native';
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, GlassButton, SEE_THROUGH_GLASS } from '@/components/glass';
import { useLeaveNowReserve } from '@/components/leave-now';
import { useElevatedSurface } from '@/components/skin-provider';
import { useIsWideViewport } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useDisplaySettings } from '@/lib/accessibility';
import { spring } from '@/lib/motion';
import { CONTINUOUS, displayCornerRadius } from '@/lib/shape';
import { skinColor } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Chenfeng's sheet, drawn (guideline section 13.11): iOS 26's, on every
 * platform - the website and Android have none, and on iOS this stands in for
 * the native one until it has been checked on a device.
 *
 *   - Detents: medium (about half the screen) and large. At medium the sheet
 *     floats 8 pt in from the sides and the bottom, its corners concentric with
 *     the display's, on glass; dragged to large it grows to the edges and turns
 *     opaque.
 *   - It follows the finger, rubber-bands past the top, settles on the detent
 *     the flick points at, and a flick or drag down past the lowest one
 *     dismisses it. At large, a list scrolled away from its top keeps the drag.
 *   - Interrupting sheets dim what is behind (20% black in light, 40% in dark);
 *     one that runs alongside the app - the place card at medium - does not,
 *     and the map stays usable around it.
 *   - Dark mode's elevated surfaces inside (useElevatedSurface).
 *   - Wide screens get a centred form sheet instead, as iPadOS does.
 *
 * In a portal, so it covers the tab bar and sits under "Leave now".
 */

export type Detent = 'medium' | 'large';

type SheetApi = {
  /** Close, animating out, then call onClose. */
  dismiss: () => void;
  /** What ✕, the backdrop, a swipe and Android's back ask for: dismiss, unless guarded. */
  requestDismiss: () => void;
  /** To the largest detent - for a keyboard, or a page pushed inside. */
  expand: () => void;
  detent: Detent;
  scrollY: SharedValue<number>;
  scrollGesture: NativeGesture;
  /** False at medium: dragging the content moves the sheet instead. */
  scrollEnabled: boolean;
};

const SheetContext = React.createContext<SheetApi | null>(null);

export function useSheet(): SheetApi {
  const sheet = React.useContext(SheetContext);
  if (!sheet) throw new Error('useSheet outside a Sheet');
  return sheet;
}

type SheetProps = {
  /** Unique: the portal's name. */
  name: string;
  /** In ascending order. A compose sheet is large only (HIG). */
  detents?: Detent[];
  initialDetent?: Detent;
  /** Up to which detent what is behind stays undimmed and usable. */
  undimmedThrough?: Detent;
  /** A form: the grouped grey page at full height rather than the plain one. */
  grouped?: boolean;
  /** After it has animated out. */
  onClose: () => void;
  /**
   * Instead of dismissing on a swipe, the backdrop, ✕ or back - for a sheet
   * with unsaved changes, which asks first, and calls `dismiss` once it may
   * close. Undefined while there is nothing to ask about.
   */
  onDismissAttempt?: (dismiss: () => void) => void;
  /** Its toolbar, at the top: ✕ leading, a title, the primary action trailing. */
  toolbar?: React.ReactNode;
  accessibilityLabel: string;
  children: React.ReactNode;
};

const CLOSED_EXTRA = 40;

/** The sheets open now, oldest first. */
const openSheets: string[] = [];

export function Sheet({
  name,
  detents = ['large'],
  initialDetent,
  undimmedThrough,
  grouped,
  onClose,
  onDismissAttempt,
  toolbar,
  accessibilityLabel,
  children,
}: SheetProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const leaveNow = useLeaveNowReserve();
  const { isWide } = useIsWideViewport();
  const { colorScheme } = useColorScheme();
  const { reduceMotion } = useDisplaySettings();
  const elevated = useElevatedSurface();
  const keyboard = useReanimatedKeyboardAnimation();

  const hasMedium = detents.includes('medium');
  const hasLarge = detents.includes('large');
  const radius = displayCornerRadius(width, height) - 8;
  const largeTop = insets.top + 8 + leaveNow.top;
  const mediumTop = Math.max(largeTop + 80, Math.round(height * 0.5));
  const lowestTop = hasMedium ? mediumTop : largeTop;
  const highestTop = hasLarge ? largeTop : mediumTop;
  const closedTop = height + CLOSED_EXTRA;
  // The content is laid out at the largest height and clipped at medium, so it
  // never reflows while the sheet is dragged.
  const innerHeight = hasLarge ? height - largeTop : height - mediumTop - 8;
  const dimMax = colorScheme === 'dark' ? 0.4 : 0.2;

  const first = initialDetent ?? detents[0];
  const [detent, setDetent] = React.useState<Detent>(first);
  const top = useSharedValue(closedTop);
  const shown = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const startTop = useSharedValue(0);
  const dragging = useSharedValue(false);
  const closing = useSharedValue(false);

  const topFor = React.useCallback(
    (d: Detent) => (d === 'large' ? largeTop : mediumTop),
    [largeTop, mediumTop]
  );

  // In on mount, with .smooth - or, with Reduce Motion, a fade in place.
  const presented = React.useRef(false);
  React.useEffect(() => {
    if (presented.current) return;
    presented.current = true;
    if (reduceMotion || isWide) {
      top.set(topFor(first));
      shown.set(withTiming(1, { duration: 250 }));
    } else {
      shown.set(1);
      top.set(withSpring(topFor(first), spring('smooth', reduceMotion)));
    }
  }, [first, isWide, reduceMotion, shown, top, topFor]);

  // The window changed size (rotation, the browser): stay on the detent.
  React.useEffect(() => {
    if (!presented.current || closing.get()) return;
    top.set(withSpring(topFor(detent), spring('smooth', reduceMotion)));
  }, [closing, detent, height, reduceMotion, top, topFor]);

  const finish = React.useCallback(() => onClose(), [onClose]);

  const dismiss = React.useCallback(() => {
    if (closing.get()) return;
    closing.set(true);
    if (reduceMotion || isWide) {
      shown.set(withTiming(0, { duration: 200 }, (done) => done && runOnJS(finish)()));
    } else {
      top.set(
        withSpring(closedTop, { ...spring('smooth'), overshootClamping: true }, (done) => {
          if (done) runOnJS(finish)();
        })
      );
    }
  }, [closedTop, closing, finish, isWide, reduceMotion, shown, top]);

  const requestDismiss = React.useCallback(() => {
    if (onDismissAttempt) onDismissAttempt(dismiss);
    else dismiss();
  }, [dismiss, onDismissAttempt]);

  // Only the sheet on top answers Escape and Android's back: one press, one
  // sheet, as with the system's.
  const id = React.useId();
  React.useEffect(() => {
    openSheets.push(id);
    return () => {
      const at = openSheets.lastIndexOf(id);
      if (at >= 0) openSheets.splice(at, 1);
    };
  }, [id]);

  const settle = React.useCallback((d: Detent) => setDetent(d), []);

  const expand = React.useCallback(() => {
    if (!hasLarge) return;
    setDetent('large');
    top.set(withSpring(largeTop, spring('smooth', reduceMotion)));
  }, [hasLarge, largeTop, reduceMotion, top]);

  // Android's back closes the sheet, as it would any sheet there.
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openSheets.at(-1) !== id) return false;
      requestDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [id, requestDismiss]);

  // Escape, on the website.
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openSheets.at(-1) === id) requestDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, requestDismiss]);

  const scrollGesture = React.useMemo(() => Gesture.Native(), []);

  const pan = Gesture.Pan()
    .enabled(!isWide)
    .activeOffsetY([-8, 8])
    .failOffsetX([-24, 24])
    .simultaneousWithExternalGesture(scrollGesture)
    .onStart(() => {
      startTop.set(top.get());
      // At full height with its list scrolled down, the drag is the list's.
      dragging.set(!(detent === 'large' && scrollY.get() > 1));
    })
    .onUpdate((event) => {
      if (!dragging.get()) return;
      let next = startTop.get() + event.translationY;
      if (detent === 'large') {
        // Up at full height scrolls; the sheet only comes down.
        next = Math.max(highestTop, next);
      } else if (next < highestTop) {
        // Past the top, it gives less and less.
        next = highestTop - Math.sqrt(highestTop - next) * 3;
      }
      top.set(next);
    })
    .onEnd((event) => {
      if (!dragging.get()) return;
      dragging.set(false);
      const now = top.get();
      const projected = now + event.velocityY * 0.18;
      const leaving =
        projected > lowestTop + (closedTop - lowestTop) * 0.3 ||
        (event.velocityY > 1300 && now > lowestTop - 24);
      if (leaving) {
        if (onDismissAttempt) {
          top.set(withSpring(lowestTop, spring('smooth', false, event.velocityY)));
          runOnJS(settle)(hasMedium ? 'medium' : 'large');
          runOnJS(requestDismiss)();
        } else {
          runOnJS(dismiss)();
        }
        return;
      }
      let target: Detent = detents[0];
      let best = Infinity;
      for (const d of detents) {
        const distance = Math.abs((d === 'large' ? largeTop : mediumTop) - projected);
        if (distance < best) {
          best = distance;
          target = d;
        }
      }
      top.set(
        withSpring(
          target === 'large' ? largeTop : mediumTop,
          spring('smooth', false, event.velocityY)
        )
      );
      runOnJS(settle)(target);
    });

  // 0 at medium, 1 at large, in between while dragged.
  const progress = useDerivedValue(() => {
    if (hasMedium && hasLarge) {
      return interpolate(top.get(), [mediumTop, largeTop], [0, 1], Extrapolation.CLAMP);
    }
    return hasLarge ? 1 : 0;
  });

  const frame = useAnimatedStyle(() => {
    if (isWide) {
      return {
        opacity: shown.get(),
        transform: [{ scale: 0.96 + 0.04 * shown.get() }],
      };
    }
    const p = progress.get();
    const inset = hasMedium ? 8 * (1 - p) : 0;
    const frameTop = Math.min(top.get(), lowestTop);
    const bottomRadius = radius * (1 - p);
    return {
      opacity: shown.get(),
      top: frameTop,
      left: inset,
      right: inset,
      height: Math.max(0, height - frameTop - inset),
      borderBottomLeftRadius: bottomRadius,
      borderBottomRightRadius: bottomRadius,
      // Below the lowest detent it slides rather than shrinks.
      transform: [{ translateY: Math.max(0, top.get() - lowestTop) }],
    };
  });

  const opaque = useAnimatedStyle(() => ({ opacity: progress.get() }));

  const dim = useAnimatedStyle(() => {
    const presence = isWide
      ? shown.get()
      : interpolate(top.get(), [lowestTop, closedTop], [1, 0], Extrapolation.CLAMP) * shown.get();
    const level = undimmedThrough === 'medium' && !isWide ? progress.get() : 1;
    return { opacity: dimMax * presence * level };
  });

  // The keyboard pushes the content up from the sheet's bottom edge.
  const inner = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, -keyboard.height.get() - (hasLarge ? 0 : insets.bottom)),
  }));

  // Typing wants room: a keyboard takes the sheet to its largest detent.
  const onKeyboard = React.useCallback(() => {
    if (detent !== 'large') expand();
  }, [detent, expand]);
  useAnimatedReaction(
    () => keyboard.height.get() < -40,
    (up, before) => {
      if (up && !before) runOnJS(onKeyboard)();
    }
  );

  const undimmed = undimmedThrough === 'medium' && detent === 'medium' && !isWide;
  const api = React.useMemo<SheetApi>(
    () => ({
      dismiss,
      requestDismiss,
      expand,
      detent,
      scrollY,
      scrollGesture,
      scrollEnabled: detent === 'large' || !hasMedium || isWide,
    }),
    [detent, dismiss, expand, hasMedium, isWide, requestDismiss, scrollGesture, scrollY]
  );

  const wideWidth = Math.min(width - 64, 540);
  const wideHeight = Math.min(height - 96, hasLarge ? 720 : 440);
  const resizable = hasMedium && hasLarge && !isWide;

  const body = (
    <>
      {/* The material: glass at medium, opaque from large up - and opaque
          throughout where glass cannot blur the map behind it, whose labels
          would read through the sheet's own text. */}
      {!isWide && !hasLarge && SEE_THROUGH_GLASS ? null : (
        <Animated.View
          pointerEvents="none"
          className={cn('absolute inset-0', grouped ? 'bg-grouped' : 'bg-background')}
          style={hasMedium && !isWide && SEE_THROUGH_GLASS ? opaque : undefined}
        />
      )}
      <View style={{ height: isWide ? wideHeight : innerHeight }}>
        <Animated.View className="flex-1" style={inner}>
          {resizable ? (
            <View
              pointerEvents="none"
              className="absolute left-0 right-0 top-[5px] z-10 items-center">
              {/* iOS 27's grabber: 60 x 4, tertiary label. */}
              <View className="h-1 w-[60px] rounded-full bg-label-tertiary" />
            </View>
          ) : null}
          {toolbar}
          <View className="flex-1">{children}</View>
        </Animated.View>
      </View>
    </>
  );

  return (
    <Portal name={name}>
      <SheetContext.Provider value={api}>
        <View
          className={cn('absolute inset-0', isWide && 'items-center justify-center')}
          pointerEvents="box-none">
          <Animated.View
            pointerEvents={undimmed ? 'none' : 'auto'}
            className="absolute inset-0 bg-black"
            style={dim}>
            <Pressable
              className="flex-1"
              onPress={requestDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close"
              // The dim is a way out for a pointer; the toolbar's ✕ is the one
              // a screen reader is given.
              importantForAccessibility="no"
              accessibilityElementsHidden
            />
          </Animated.View>

          <GestureDetector gesture={pan}>
            <Animated.View
              role="dialog"
              aria-modal
              aria-label={accessibilityLabel}
              accessibilityViewIsModal
              className={cn('overflow-hidden', !isWide && 'absolute', elevated.className)}
              style={[
                isWide
                  ? { width: wideWidth, height: wideHeight, borderRadius: 26 }
                  : { borderTopLeftRadius: radius, borderTopRightRadius: radius },
                CONTINUOUS,
                elevated.style,
                frame,
              ]}>
              {hasMedium && !isWide && SEE_THROUGH_GLASS ? (
                <Glass radius={0} className="absolute inset-0" pointerEvents="none" />
              ) : null}
              {body}
            </Animated.View>
          </GestureDetector>
        </View>
      </SheetContext.Provider>
    </Portal>
  );
}

/**
 * The sheet's scrolling content. Hands the drag over to the sheet at its top
 * edge, and at medium does not scroll at all - dragging it moves the sheet.
 */
export function SheetScrollView({
  children,
  contentContainerClassName,
  className,
  ...props
}: ScrollViewProps & { contentContainerClassName?: string; className?: string }) {
  const sheet = useSheet();
  // Only the shared value goes into the worklet: `sheet` holds the scroll
  // gesture, which cannot be copied to the UI thread on a phone.
  const { scrollY } = sheet;
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  return (
    <GestureDetector gesture={sheet.scrollGesture}>
      <Animated.ScrollView
        {...props}
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollEnabled={sheet.scrollEnabled}
        bounces={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        className={cn('flex-1', Platform.select({ web: 'overscroll-contain' }), className)}
        contentContainerClassName={contentContainerClassName}>
        {children}
      </Animated.ScrollView>
    </GestureDetector>
  );
}

type SheetToolbarProps = {
  leading?: React.ReactNode;
  /** Headline, centred. */
  title?: string;
  /** Footnote, under the title. */
  subtitle?: string;
  trailing?: React.ReactNode;
  /** Below the grabber, on a sheet that resizes. */
  belowGrabber?: boolean;
};

/**
 * A sheet's bar: 16 pt from its edges, the close button leading, the primary
 * action trailing, the title centred between them. Both sides are as wide as
 * the wider one - measured, since "Post" and ✕ differ - so the title stays
 * centred on the sheet and a long one is cut short between them rather than
 * running under a button.
 */
export function SheetToolbar({ leading, title, subtitle, trailing, belowGrabber }: SheetToolbarProps) {
  // Both sides as wide as the wider one, so the title stays centred. A
  // minimum, not a width: a phone measures text against the width it is
  // offered, so a fixed 44 would wrap "Save" to fit and never learn better.
  const [side, setSide] = React.useState(44);
  const measure = (event: LayoutChangeEvent) => {
    const width = Math.ceil(event.nativeEvent.layout.width);
    setSide((current) => Math.max(current, width));
  };

  return (
    <View className={cn('flex-row items-center gap-3 px-4 pb-2', belowGrabber ? 'pt-5' : 'pt-4')}>
      <View style={{ minWidth: side }} className="flex-row justify-start">
        <View onLayout={measure} className="flex-row">
          {leading}
        </View>
      </View>
      <View className="min-w-0 flex-1 items-center">
        {title ? (
          <>
            <Text
              textStyle="headline"
              numberOfLines={1}
              maxFontSizeMultiplier={1.4}
              role="heading"
              className="text-center text-foreground">
              {title}
            </Text>
            {subtitle ? (
              <Text
                textStyle="footnote"
                numberOfLines={1}
                maxFontSizeMultiplier={1.4}
                className="text-center text-label-secondary">
                {subtitle}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
      <View style={{ minWidth: side }} className="flex-row justify-end">
        <View onLayout={measure} className="flex-row">
          {trailing}
        </View>
      </View>
    </View>
  );
}

/** ✕ in a glass circle: closes, or asks first if the sheet is guarded. */
export function SheetCloseButton({ label = 'Close' }: { label?: string }) {
  const sheet = useSheet();
  return (
    <GlassButton onPress={sheet.requestDismiss} accessibilityLabel={label}>
      <Icon as={X} size={19} weight="medium" strokeWidth={2.25} className="text-foreground" />
    </GlassButton>
  );
}

/** ‹ in a glass circle: back to the sheet's previous page. Never the word "Back". */
export function SheetBackButton({
  onPress,
  label = 'Back',
}: {
  onPress: () => void;
  label?: string;
}) {
  return (
    <GlassButton onPress={onPress} accessibilityLabel={label}>
      <Icon
        as={ChevronLeft}
        size={21}
        weight="semibold"
        strokeWidth={2.5}
        className="text-foreground"
      />
    </GlassButton>
  );
}

type SheetActionProps = {
  /** A word for an action a symbol cannot say ("Post"); without it, a ✓. */
  label?: string;
  /** Read to a screen reader in full ("Post Review"). */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  /** Working: a spinner where the label was. */
  busy?: boolean;
};

/** The primary action, trailing: tinted glass under a white label or ✓. */
export function SheetActionButton({
  label,
  accessibilityLabel,
  onPress,
  disabled,
  busy,
}: SheetActionProps) {
  const { colorScheme } = useColorScheme();
  const tint = skinColor('chenfeng', colorScheme === 'dark' ? 'dark' : 'light', 'primary');
  return (
    <GlassButton
      prominent
      tint={tint}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      className={label ? 'px-4' : undefined}>
      {busy ? (
        <ActivityIndicator size="small" color="white" />
      ) : label ? (
        <Text textStyle="headline" maxFontSizeMultiplier={1.4} className="text-white">
          {label}
        </Text>
      ) : (
        <Icon as={Check} size={19} weight="semibold" strokeWidth={2.75} className="text-white" />
      )}
    </GlassButton>
  );
}

type SheetPushProps = {
  /** The page underneath. */
  base: React.ReactNode;
  /** The page pushed over it, or null. */
  pushed: React.ReactNode | null;
  /** After the pushed page has gone - by its back button or a swipe. */
  onPopped: () => void;
  /** Bumped to pop from outside (the back button), animating out first. */
  popToken?: number;
};

/**
 * A navigation push inside a sheet: the new page slides in from the trailing
 * edge with .smooth while the old one moves a third of the way the other way
 * and dims; a swipe right on the pushed page takes it back, following the
 * finger, completing past halfway or on a flick.
 */
export function SheetPush({ base, pushed, onPopped, popToken = 0 }: SheetPushProps) {
  const { width } = useWindowDimensions();
  const { reduceMotion } = useDisplaySettings();
  const [page, setPage] = React.useState<React.ReactNode | null>(pushed);
  // From a pop until the parent lets go of `pushed`. On a phone the parent's
  // update can land a render after this one's - the pop ends in an animation
  // callback, outside React's batching - and until it does, `pushed` is still
  // the page just popped. Taking it back from that render left it mounted off
  // screen with the base page's touches switched off: every button on the
  // place card dead after one trip to More Details.
  const [releasing, setReleasing] = React.useState(false);
  const offset = useSharedValue(pushed ? 0 : 1);

  // A page arrives, or the one showing re-renders.
  if (releasing) {
    if (!pushed) setReleasing(false);
  } else if (pushed && pushed !== page) {
    setPage(pushed);
  }

  const hasPushed = !!pushed;
  React.useEffect(() => {
    if (hasPushed) {
      offset.set(reduceMotion ? withTiming(0, { duration: 250 }) : withSpring(0, spring('smooth')));
    }
  }, [hasPushed, offset, reduceMotion]);

  const popped = React.useCallback(() => {
    setReleasing(true);
    setPage(null);
    onPopped();
  }, [onPopped]);

  const pop = React.useCallback(
    (velocity = 0) => {
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) runOnJS(popped)();
      };
      offset.set(
        reduceMotion
          ? withTiming(1, { duration: 200 }, done)
          : withSpring(
              1,
              {
                ...spring('smooth', false, velocity / Math.max(width, 1)),
                overshootClamping: true,
              },
              done
            )
      );
    },
    [offset, popped, reduceMotion, width]
  );

  const lastPop = React.useRef(popToken);
  React.useEffect(() => {
    if (popToken !== lastPop.current) {
      lastPop.current = popToken;
      pop();
    }
  }, [popToken, pop]);

  const swipe = Gesture.Pan()
    .enabled(!!page)
    .activeOffsetX(12)
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      offset.set(Math.max(0, Math.min(1, event.translationX / width)));
    })
    .onEnd((event) => {
      if (offset.get() > 0.5 || event.velocityX > 600) runOnJS(pop)(event.velocityX);
      else offset.set(withSpring(0, spring('smooth', false, -event.velocityX / width)));
    });

  // A boolean for the worklet: the page itself is a React element, which
  // cannot be copied to the UI thread on a phone.
  const hasPage = !!page;
  const baseStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: hasPage ? offset.get() : 1 }
      : {
          opacity: hasPage ? 0.6 + 0.4 * offset.get() : 1,
          transform: [{ translateX: hasPage ? -0.3 * width * (1 - offset.get()) : 0 }],
        }
  );
  const pushedStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - offset.get() }
      : { transform: [{ translateX: offset.get() * width }] }
  );

  return (
    <View className="flex-1 overflow-hidden">
      <Animated.View
        className="flex-1"
        style={baseStyle}
        pointerEvents={page ? 'none' : 'auto'}
        importantForAccessibility={page ? 'no-hide-descendants' : 'auto'}>
        {base}
      </Animated.View>
      {page ? (
        <GestureDetector gesture={swipe}>
          <Animated.View className="absolute inset-0" style={pushedStyle}>
            {page}
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}
