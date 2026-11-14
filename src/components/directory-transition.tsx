import * as React from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useDisplaySettings } from '@/lib/accessibility';
import type { Directory } from '@/lib/directory';

/** How far a new view slides as it fades in, in points: a nudge, not a page. */
const SLIDE = 24;
const DURATION = 220;

type Direction = 'forward' | 'back' | 'swap';

/**
 * The Directory's body, moving as it changes - into a kind, back to the
 * kinds, into a search - instead of cutting from one to the other. Opening a
 * kind arrives from the right and going back from the left, the direction of
 * a page pushed and popped; a search only fades. Nothing moves for anyone who
 * has asked the system for less motion, and nothing moves the first time the
 * body is drawn: opening the tab should show the Directory, not perform it.
 *
 * An animated style driven here, rather than a Reanimated entering animation:
 * on the website an entering view is hidden for its first frame and shown when
 * its animation starts, and here it never started - the kind opened invisible.
 * Nothing is animated out either; an exit is played on whatever unmounts, and
 * on the website that re-attached the old view outside the page while it went.
 *
 * Only a style, never a className as well: on the web NativeWind pushes a
 * class into a style array in place (AGENTS.md, Skins rule 13).
 */
export function DirectoryTransition({
  directory,
  children,
}: React.PropsWithChildren<{ directory: Directory }>) {
  const { reduceMotion } = useDisplaySettings();
  const key = `${directory.view}:${directory.kind?.tag.slug ?? ''}`;

  // Worked out during render, from the view before.
  const [shown, setShown] = React.useState<{
    key: string;
    view: Directory['view'];
    direction: Direction | null;
  }>({ key, view: directory.view, direction: null });

  if (shown.key !== key) {
    const from = shown.view;
    const to = directory.view;
    const direction: Direction =
      from === 'kinds' && to === 'places'
        ? 'forward'
        : from === 'places' && to === 'kinds'
          ? 'back'
          : 'swap';
    setShown({ key, view: to, direction });
  }

  const progress = useSharedValue(1);
  const offset = useSharedValue(0);

  // Before the browser paints the new view, so it never shows once at rest
  // and then jumps back to start its way in.
  React.useLayoutEffect(() => {
    if (!shown.direction || reduceMotion) {
      progress.set(1);
      return;
    }
    offset.set(shown.direction === 'forward' ? SLIDE : shown.direction === 'back' ? -SLIDE : 0);
    progress.set(0);
    progress.set(withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }));
  }, [shown, reduceMotion, progress, offset]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateX: (1 - progress.get()) * offset.get() }],
  }));

  return (
    <Animated.View key={key} style={style}>
      {children}
    </Animated.View>
  );
}
