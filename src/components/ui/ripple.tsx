import * as React from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Spreading from the touch to the far corner. */
const SPREAD_MS = 320;
/** Fading once the finger lifts. */
const FADE_MS = 240;
/** How strong the wave is at its height: Material's pressed overlay is about this. */
const STRENGTH = 0.16;

/**
 * Material's ripple, for where the platform draws none of its own - the website
 * and iOS. Android has the real thing (Pressable's android_ripple) and should
 * not use this.
 *
 * The hook gives the press handlers and the layout handler to put on the
 * Pressable, and the wave to render as its first child: under the label, and
 * clipped to the button's shape by its overflow-hidden.
 */
export function useRipple(color: string) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [origin, setOrigin] = React.useState({ x: 0, y: 0 });
  const spread = useSharedValue(0);
  const strength = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    opacity: strength.get(),
    transform: [{ scale: spread.get() }],
  }));

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  function onPressIn(event: GestureResponderEvent) {
    const { locationX, locationY } = event.nativeEvent;
    // A key press has no point to spread from: the middle.
    setOrigin({
      x: Number.isFinite(locationX) ? locationX : size.width / 2,
      y: Number.isFinite(locationY) ? locationY : size.height / 2,
    });
    spread.set(0);
    strength.set(STRENGTH);
    spread.set(withTiming(1, { duration: SPREAD_MS, easing: Easing.out(Easing.quad) }));
  }

  function onPressOut() {
    strength.set(withTiming(0, { duration: FADE_MS }));
  }

  // Far enough to reach the corner furthest from where it started.
  const radius = Math.hypot(
    Math.max(origin.x, size.width - origin.x),
    Math.max(origin.y, size.height - origin.y)
  );

  const wave = (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: origin.x - radius,
          top: origin.y - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );

  return { wave, onLayout, onPressIn, onPressOut };
}
