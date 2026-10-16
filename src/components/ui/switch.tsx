import { useDisplaySettings } from '@/lib/accessibility';
import { toggleTick } from '@/lib/haptics';
import { spring } from '@/lib/motion';
import { useSkin, type Skin } from '@/lib/skin';
import { cn } from '@/lib/utils';
import * as SwitchPrimitives from '@rn-primitives/switch';
import * as React from 'react';
import { Platform, Pressable, Switch as NativeSwitch } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type SwitchLook = {
  root: string;
  rootWeb: string;
  rootOn: string;
  rootOff: string;
  thumb: string;
  thumbWeb: string;
  thumbOn: string;
  thumbOff: string;
};

/**
 * Basic's and Material's track and thumb. Basic's are the originals, untouched.
 *
 * Material 3: a 52 x 32 track, outlined while off; the thumb is 16 off and
 * grows to 24 on, its centre 16 in from either end.
 *
 * Chenfeng is not a class list: see ChenfengSwitch below.
 */
const SWITCH_LOOKS: Record<Exclude<Skin, 'chenfeng'>, SwitchLook> = {
  basic: {
    root: 'flex h-[1.15rem] w-8 shrink-0 flex-row items-center rounded-full border border-transparent shadow-sm shadow-black/5',
    rootWeb:
      'focus-visible:border-ring focus-visible:ring-ring/50 peer inline-flex outline-none transition-all focus-visible:ring-[3px] disabled:cursor-not-allowed',
    rootOn: 'bg-primary',
    rootOff: 'bg-input dark:bg-input/80',
    thumb: 'bg-background size-4 rounded-full transition-transform',
    thumbWeb: 'pointer-events-none block ring-0',
    thumbOn: 'dark:bg-primary-foreground translate-x-3.5',
    thumbOff: 'dark:bg-foreground translate-x-0',
  },
  material: {
    root: 'flex h-8 w-[52px] shrink-0 flex-row items-center rounded-full border-2',
    rootWeb:
      'focus-visible:ring-ring/50 peer inline-flex outline-none transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed',
    rootOn: 'border-primary bg-primary',
    rootOff: 'border-input bg-muted',
    thumb: 'rounded-full transition-transform',
    thumbWeb: 'pointer-events-none block transition-all duration-200',
    thumbOn: 'size-6 translate-x-[22px] bg-primary-foreground',
    thumbOff: 'size-4 translate-x-[6px] bg-input',
  },
};

type SwitchProps = React.ComponentProps<typeof SwitchPrimitives.Root>;

function Switch(props: SwitchProps) {
  const { skin } = useSkin();
  if (skin === 'chenfeng') {
    // iOS's own switch is the native look - its glass thumb, its haptic, its
    // VoiceOver - so nothing is drawn there. No colour props: iOS 26 either
    // ignores them or swaps the glass thumb for a flat one.
    if (Platform.OS === 'ios') {
      return (
        <NativeSwitch
          value={props.checked}
          onValueChange={props.onCheckedChange}
          disabled={props.disabled ?? undefined}
          accessibilityLabel={props.accessibilityLabel}
          aria-label={props['aria-label']}
          className={props.className}
        />
      );
    }
    return <ChenfengSwitch {...props} />;
  }
  return <PrimitiveSwitch look={SWITCH_LOOKS[skin]} {...props} />;
}

function PrimitiveSwitch({ look, className, ...props }: SwitchProps & { look: SwitchLook }) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        look.root,
        Platform.select({
          web: look.rootWeb,
        }),
        props.checked ? look.rootOn : look.rootOff,
        props.disabled && 'opacity-50',
        className
      )}
      {...props}>
      <SwitchPrimitives.Thumb
        className={cn(
          look.thumb,
          Platform.select({
            web: look.thumbWeb,
          }),
          props.checked ? look.thumbOn : look.thumbOff
        )}
      />
    </SwitchPrimitives.Root>
  );
}

/** iOS 26's switch, measured at run time: a 63 x 28 track, a 37 x 24 thumb inset 2. */
const TRACK_WIDTH = 63;
const TRACK_HEIGHT = 28;
const THUMB_WIDTH = 37;
const THUMB_HEIGHT = 24;
const INSET = 2;
const TRAVEL = TRACK_WIDTH - INSET * 2 - THUMB_WIDTH;

/**
 * Chenfeng's switch where it has to be drawn (Android, the website): iOS's
 * proportions and colours, the thumb on UIKit's own spring, the track
 * crossfading to green as the thumb travels. Pressed, the thumb swells into a
 * lens; it can be dragged along the track and lands on the nearer side. Taps,
 * keyboard and screen readers work through the Pressable around it.
 */
function ChenfengSwitch({
  checked,
  onCheckedChange,
  disabled,
  className,
  accessibilityLabel,
  ...props
}: SwitchProps) {
  const { reduceMotion } = useDisplaySettings();
  // 0 off, 1 on: where the thumb is, and how green the track.
  const position = useSharedValue(checked ? 1 : 0);
  const pressed = useSharedValue(0);
  // Set when a drag ends, cleared when a press begins: the press a drag began
  // as must not toggle the switch a second time on release.
  const dragged = useSharedValue(false);

  React.useEffect(() => {
    position.set(withSpring(checked ? 1 : 0, spring('switchThumb', reduceMotion)));
  }, [checked, position, reduceMotion]);

  const change = React.useCallback(
    (next: boolean) => {
      if (disabled || next === checked) return;
      toggleTick(next);
      onCheckedChange?.(next);
    },
    [checked, disabled, onCheckedChange]
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-6, 6])
    .runOnJS(true)
    .onStart(() => {
      pressed.set(withTiming(1, { duration: 120 }));
    })
    .onUpdate((event) => {
      const start = checked ? 1 : 0;
      position.set(Math.min(1, Math.max(0, start + event.translationX / TRAVEL)));
    })
    .onEnd(() => {
      dragged.set(true);
      pressed.set(withTiming(0, { duration: 160 }));
      const next = position.get() > 0.5;
      position.set(withSpring(next ? 1 : 0, spring('switchThumb', reduceMotion)));
      change(next);
    });

  const track = useAnimatedStyle(() => ({ opacity: position.get() }));
  const thumb = useAnimatedStyle(() => {
    // The lens grows from the thumb's own centre, and a little more along the
    // track than across it.
    const grow = pressed.get();
    return {
      transform: [
        { translateX: INSET + position.get() * TRAVEL },
        { scaleX: interpolate(grow, [0, 1], [1, 1.22]) },
        { scaleY: interpolate(grow, [0, 1], [1, 1.16]) },
      ],
    };
  });
  // Under the finger the thumb turns to glass: thinner, so the track shows
  // through, with a rim to hold its shape.
  const body = useAnimatedStyle(() => ({ opacity: 1 - 0.4 * pressed.get() }));
  const rim = useAnimatedStyle(() => ({ opacity: pressed.get() }));

  return (
    <GestureDetector gesture={pan}>
      <Pressable
        {...props}
        role="switch"
        aria-checked={!!checked}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled ?? undefined}
        onPressIn={() => {
          dragged.set(false);
          if (!disabled) pressed.set(withTiming(1, { duration: 120 }));
        }}
        onPressOut={() => pressed.set(withTiming(0, { duration: 160 }))}
        onPress={() => {
          if (dragged.get()) {
            dragged.set(false);
            return;
          }
          change(!checked);
        }}
        style={{ width: TRACK_WIDTH, height: TRACK_HEIGHT }}
        className={cn(
          'shrink-0 justify-center rounded-full bg-fill-secondary',
          Platform.select({
            web: 'cursor-pointer select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          }),
          disabled && 'opacity-50',
          className
        )}>
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 rounded-full bg-switch-on"
          style={track}
        />
        <Animated.View
          pointerEvents="none"
          className="absolute left-0 rounded-full"
          style={[
            {
              width: THUMB_WIDTH,
              height: THUMB_HEIGHT,
              top: INSET,
              // WebKit's copy of UIKit's: 0 2.5 blur 6, black at 12%.
              boxShadow: '0px 2.5px 6px rgba(0, 0, 0, 0.12)',
            },
            thumb,
          ]}>
          <Animated.View className="absolute inset-0 rounded-full bg-white" style={body} />
          <Animated.View
            className="absolute inset-0 rounded-full border-hairline border-black/20"
            style={rim}
          />
        </Animated.View>
      </Pressable>
    </GestureDetector>
  );
}

export { Switch };
