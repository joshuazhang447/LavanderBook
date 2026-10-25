import { requireOptionalNativeModule } from 'expo';
import type * as ExpoBlur from 'expo-blur';
import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { cssInterop, useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewProps,
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
import { useSkin } from '@/lib/skin';
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
 * expo-blur, on Android 12 or later, in a build that has it. From Android 12 a
 * blur can sample a TextureView - which is what Google Maps draws into in this
 * build - so glass over the map can be frosted as it is on the website. Older
 * Android keeps the nearly opaque body. Loaded only once the module is known
 * to be there: its views are looked up on import, and a build made before it
 * was added has none (AGENTS.md, Skins rule 5).
 */
const NATIVE_BLUR: typeof ExpoBlur | null = (() => {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 31) return null;
  try {
    if (!requireOptionalNativeModule('ExpoBlur')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-blur') as typeof ExpoBlur;
  } catch {
    return null;
  }
})();

/**
 * Glass that shows what is behind it blurred: the real thing, or the website's
 * backdrop blur. Elsewhere it is drawn nearly opaque, and anything that relies
 * on seeing through it - a clear track, a sheet's body - needs a backing.
 * Android's blur needs a backdrop to sample, so there see useSeeThroughGlass.
 */
export const SEE_THROUGH_GLASS = Platform.OS === 'web' || LIQUID_GLASS;

/**
 * On Android, a blur samples one view it is pointed at - a backdrop - and
 * never itself or anything above it. Each layer of glass gets the backdrop of
 * the content it floats over from the nearest GlassBackdrop: the map for the
 * map's controls, the screens for the tab bar, the whole app for a sheet. Null
 * means there is nothing to sample - a popover, a sheet's own toolbar - and
 * the glass is drawn as it is without a blur.
 */
type Backdrop = React.RefObject<View | null>;
const BackdropContext = React.createContext<Backdrop | null>(null);

/** A backdrop: `ref` goes on its BackdropView, `target` to a GlassBackdrop. */
export function useBackdrop() {
  const [target, setTarget] = React.useState<Backdrop | null>(null);
  const ref = React.useCallback((node: View | null) => {
    // A new object for every node: expo-blur only looks again when the ref
    // object itself changes, not when the view inside it does.
    setTarget(node ? { current: node } : null);
  }, []);
  return { ref, target };
}

/**
 * Content glass floats over, which glass outside it can blur. A BlurTargetView
 * in Chenfeng where Android can blur, and nothing at all otherwise - not even
 * a view, so Basic and Material, the website and iOS run exactly as before.
 * Changing skin to or from Chenfeng therefore remounts what it wraps, the
 * screens included, once.
 */
export function BackdropView({
  backdropRef,
  children,
  ...props
}: ViewProps & { backdropRef: (node: View | null) => void }) {
  const chenfeng = useSkin().skin === 'chenfeng';
  if (!NATIVE_BLUR || !chenfeng) return <>{children}</>;
  const { BlurTargetView } = NATIVE_BLUR;
  return (
    // Typed as taking a ref object; it hands any ref to its native view, and
    // a callback is what tells useBackdrop when that view changes.
    <BlurTargetView ref={backdropRef as unknown as React.RefObject<View | null>} {...props}>
      {children}
    </BlurTargetView>
  );
}

/** The backdrop glass inside blurs; null for none. */
export function GlassBackdrop({
  target,
  children,
}: React.PropsWithChildren<{ target: Backdrop | null }>) {
  return <BackdropContext.Provider value={target}>{children}</BackdropContext.Provider>;
}

/** Whether glass here shows what is behind it: SEE_THROUGH_GLASS, or a blur on Android. */
export function useSeeThroughGlass(): boolean {
  const backdrop = React.useContext(BackdropContext);
  return SEE_THROUGH_GLASS || (!!NATIVE_BLUR && !!backdrop);
}

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

/**
 * Android's frosted glass: the website's recipe (guideline section 17.3) on a
 * real blur. expo-blur's tint lays the first coat - white at 44% in light, a
 * near-black at 55% in dark, at full intensity - and the body over it brings
 * light up to the website's 62%; dark is already its 55%. The radius is the
 * intensity over the reduction, measured against the website's 16px.
 *
 * The website also saturates what is behind its glass to 180%, which is what
 * keeps it tinted rather than grey under that much white. expo-blur cannot,
 * so the blur is saturated after the fact with React Native's own `filter`
 * (Android's colour matrix). The same thing: a saturation matrix leaves
 * white and grey as they are, so saturating the blur with its white tint on
 * it equals saturating what is behind and laying the white on top.
 */
const BLUR = {
  intensity: 100,
  reduction: 4,
  saturate: [{ saturate: 3 }],
  tint: { light: 'default', dark: 'systemUltraThinMaterialDark' },
  body: 'bg-card/[0.32] dark:bg-transparent',
  rim: {
    light: 'inset 0px 0px 0px 0.5px rgba(255, 255, 255, 0.55), inset 0px 1px 0px rgba(255, 255, 255, 0.7)',
    dark: 'inset 0px 0px 0px 0.5px rgba(255, 255, 255, 0.16), inset 0px 1px 0px rgba(255, 255, 255, 0.14)',
  },
  shadow: {
    light: '0px 0px 0px 0.5px rgba(0, 0, 0, 0.06), 0px 8px 24px rgba(0, 0, 0, 0.12), 0px 1px 3px rgba(0, 0, 0, 0.08)',
    dark: '0px 8px 24px rgba(0, 0, 0, 0.35), 0px 1px 3px rgba(0, 0, 0, 0.3)',
  },
} as const;

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
  const backdrop = React.useContext(BackdropContext);
  const { colorScheme } = useColorScheme();

  if (NATIVE_BLUR && backdrop && !reduceTransparency && !highContrast) {
    const scheme = colorScheme === 'dark' ? 'dark' : 'light';
    const { BlurView } = NATIVE_BLUR;
    return (
      <View
        pointerEvents={pointerEvents}
        className={className}
        style={[{ borderRadius: radius, boxShadow: BLUR.shadow[scheme] }, style]}>
        {/* The blur ignores borderRadius: the clip gives it the glass's shape. */}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
          <View style={[StyleSheet.absoluteFill, { filter: BLUR.saturate }]}>
            <BlurView
              blurTarget={backdrop}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={BLUR.intensity}
              blurReductionFactor={BLUR.reduction}
              tint={BLUR.tint[scheme]}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View
            className={tint ? undefined : BLUR.body}
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: radius, boxShadow: BLUR.rim[scheme] },
              tint ? { backgroundColor: tint } : null,
            ]}
          />
        </View>
        {children}
      </View>
    );
  }

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
