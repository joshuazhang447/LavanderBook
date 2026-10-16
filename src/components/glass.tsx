import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import {
  Platform,
  Pressable,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useDisplaySettings } from '@/lib/accessibility';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Chenfeng's glass: the material of whatever floats over the content - the tab
 * bar, the map's controls, a sheet's buttons. Content itself is never glass,
 * only what sits on it, as in iOS.
 *
 * Real Liquid Glass needs iOS 26 or later, and a build with the module in it -
 * one made before expo-glass-effect was added has none, and asking would throw.
 * Everywhere else it is drawn from layers (guideline section 8.3): a backdrop
 * blur on the website, a translucent body, a bright rim, a soft wide shadow.
 * Android has no blur that reaches the map under a control, so its body is
 * nearly opaque.
 */
function hasLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

export const LIQUID_GLASS = hasLiquidGlass();

/**
 * Glass that shows what is behind it blurred: the real thing, or the website's
 * backdrop blur. Elsewhere it is drawn nearly opaque, and anything that relies
 * on seeing through it - a clear track, a sheet's body - needs a backing.
 */
export const SEE_THROUGH_GLASS = Platform.OS === 'web' || LIQUID_GLASS;

cssInterop(GlassView, { className: 'style' });
cssInterop(GlassContainer, { className: 'style' });

/**
 * The drawn glass, by platform. On the website: the backdrop blur and
 * saturation, a body of the page colour at about 60%, a rim and a top
 * highlight inside the edge, a hairline outside it (iOS 27's darker edge) and
 * two soft shadows. Elsewhere the same without the blur, the body thicker so
 * whatever is behind still reads as behind.
 */
const DRAWN_GLASS = Platform.select({
  web: cn(
    'bg-card/[0.62] backdrop-blur-[16px] backdrop-saturate-[1.8] dark:bg-card/[0.55]',
    'shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.55),inset_0_1px_0_rgb(255_255_255/0.7),0_0_0_0.5px_rgb(0_0_0/0.06),0_8px_24px_rgb(0_0_0/0.12),0_1px_3px_rgb(0_0_0/0.08)]',
    'dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.16),inset_0_1px_0_rgb(255_255_255/0.14),0_8px_24px_rgb(0_0_0/0.35),0_1px_3px_rgb(0_0_0/0.3)]'
  ),
  default:
    'border-hairline border-white/60 bg-card/[0.88] dark:border-white/[0.14] dark:bg-card/[0.85]',
});

/** Reduce Transparency: no blur, an opaque body, the rim kept. */
const OPAQUE_GLASS = cn(
  'bg-grouped dark:bg-muted',
  Platform.select({
    web: 'shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08),0_8px_24px_rgb(0_0_0/0.12)] dark:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.16),0_8px_24px_rgb(0_0_0/0.35)]',
    default: 'border-hairline border-black/10 dark:border-white/[0.16]',
  })
);

/** Increase Contrast: glass nearly black or white, with a contrasting border. */
const CONTRAST_GLASS = 'border border-foreground/40 bg-background';

/**
 * The shadow under drawn glass, as a style - React Native takes boxShadow on
 * iOS, Android and the web alike since 0.76, so one value does all three. The
 * website's is in its class above, with the rim. Over the map it is half as
 * strong again: iOS darkens the shadow over busy content.
 */
function glassShadow(overMap: boolean): ViewStyle | undefined {
  if (Platform.OS === 'web') return undefined;
  const k = overMap ? 1.5 : 1;
  return {
    boxShadow: `0px 0px 16px rgba(0, 0, 0, ${0.08 * k}), 0px 4px 12px rgba(0, 0, 0, ${0.08 * k})`,
  };
}

type GlassProps = {
  /** The glass's corner radius: half the height for a capsule or a circle. */
  radius: number;
  /** Pressable glass: real glass answers the touch itself. */
  interactive?: boolean;
  /** Coloured glass, for the one prominent control - the tint, say. */
  tint?: string;
  /** Sits over the map: a deeper shadow. */
  overMap?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: ViewStyle['pointerEvents'];
  children?: React.ReactNode;
};

/**
 * A glass surface with its contents on it: the control's own background, in
 * the control's own shape. On iOS 26 the real thing (and its press response
 * when interactive); elsewhere drawn.
 */
export function Glass({
  radius,
  interactive,
  tint,
  overMap = false,
  className,
  style,
  pointerEvents,
  children,
}: GlassProps) {
  const { reduceTransparency, highContrast } = useDisplaySettings();

  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        tintColor={tint}
        pointerEvents={pointerEvents}
        className={className}
        style={[{ borderRadius: radius }, style]}>
        {children}
      </GlassView>
    );
  }

  return (
    <View
      pointerEvents={pointerEvents}
      className={cn(
        highContrast ? CONTRAST_GLASS : reduceTransparency ? OPAQUE_GLASS : DRAWN_GLASS,
        className
      )}
      style={[
        { borderRadius: radius },
        tint ? { backgroundColor: tint } : null,
        glassShadow(overMap),
        style,
      ]}>
      {children}
    </View>
  );
}

/**
 * Controls that sit together share one sampling region on iOS 26, so their
 * glass reads as one material and can merge as they move. A plain view
 * elsewhere.
 */
export function GlassGroup({
  spacing = 8,
  className,
  style,
  children,
}: React.PropsWithChildren<{
  spacing?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}>) {
  if (LIQUID_GLASS) {
    return (
      <GlassContainer spacing={spacing} className={className} style={style}>
        {children}
      </GlassContainer>
    );
  }
  return (
    <View className={className} style={style} pointerEvents="box-none">
      {children}
    </View>
  );
}

/**
 * Drawn glass answering a touch, as iOS 26's does: it swells - its longest
 * side grows by about 15 pt - with .snappy, brightens with a white wash fading
 * in, and settles back with .bouncy on release. Real glass does this itself.
 * With Reduce Motion it only brightens.
 */
export function useGlassPress() {
  const { reduceMotion } = useDisplaySettings();
  const [longest, setLongest] = React.useState(44);
  const pressed = useSharedValue(0);
  const scale = useSharedValue(1);

  const swell = reduceMotion || LIQUID_GLASS ? 1 : Math.min(1.3, 1 + 15 / Math.max(longest, 1));

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const wash = useAnimatedStyle(() => ({ opacity: pressed.get() }));

  return {
    style,
    wash,
    onLayout(event: LayoutChangeEvent) {
      const { width, height } = event.nativeEvent.layout;
      setLongest(Math.max(width, height));
    },
    onPressIn(_event?: GestureResponderEvent) {
      if (LIQUID_GLASS) return;
      pressed.set(withTiming(1, { duration: 150 }));
      scale.set(withSpring(swell, spring('snappy', reduceMotion)));
    },
    onPressOut(_event?: GestureResponderEvent) {
      if (LIQUID_GLASS) return;
      pressed.set(withTiming(0, { duration: 200 }));
      scale.set(withSpring(1, spring('bouncy', reduceMotion)));
    },
  };
}

/** The white wash over pressed drawn glass: about 30% in light, 14% in dark. */
export function GlassWash({ style, radius }: { style: object; radius: number }) {
  if (LIQUID_GLASS) return null;
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute inset-0 bg-white/30 dark:bg-white/[0.14]"
      style={[{ borderRadius: radius }, style]}
    />
  );
}

type GlassButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Height; a circle when nothing in it is wider. 44 is iOS's toolbar size. */
  size?: number;
  /** Tinted glass for the one primary action: the tint, under white. */
  prominent?: boolean;
  /** The colour for prominent glass. */
  tint?: string;
  overMap?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * A toolbar button: a 44 pt glass circle with a symbol in it, or a capsule
 * with a word ("Post"). Close and Cancel at the leading edge, the primary
 * action prominent at the trailing one (guideline section 13.3).
 */
export function GlassButton({
  size = 44,
  prominent,
  tint,
  overMap,
  className,
  style,
  children,
  onPressIn,
  onPressOut,
  disabled,
  ...props
}: GlassButtonProps) {
  const press = useGlassPress();
  const radius = size / 2;

  return (
    <Animated.View
      style={[press.style, disabled && prominent ? { opacity: 0.5 } : null, style]}
      onLayout={press.onLayout}>
      <Glass
        radius={radius}
        interactive={!disabled}
        tint={prominent ? tint : undefined}
        overMap={overMap}>
        <Pressable
          role="button"
          disabled={disabled}
          onPressIn={(event) => {
            press.onPressIn(event);
            onPressIn?.(event);
          }}
          onPressOut={(event) => {
            press.onPressOut(event);
            onPressOut?.(event);
          }}
          style={{ minWidth: size, height: size, borderRadius: radius }}
          className={cn(
            'flex-row items-center justify-center gap-1.5',
            Platform.select({
              web: 'cursor-pointer select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            }),
            disabled && !prominent && 'opacity-40',
            className
          )}
          {...props}>
          {children}
        </Pressable>
        <GlassWash style={press.wash} radius={radius} />
      </Glass>
    </Animated.View>
  );
}
