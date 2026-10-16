import { cssInterop } from 'nativewind';
import * as React from 'react';
// NativeWind's own registry of styled components; the package root's types
// leave it out, though the phone build exports it from there too.
import { interopComponents } from 'react-native-css-interop/dist/runtime/native/api';
import Animated from 'react-native-reanimated';

/**
 * The phone's version of nativewind-animated.ts: the same three components
 * taught `className`, without losing their animated styles.
 *
 * On a phone NativeWind runs every registered component - with a className or
 * without - and folds each item of its `style` into one plain object. A style
 * from useAnimatedStyle is an object Reanimated knows by its `viewDescriptors`,
 * and Reanimated swaps the whole object it finds that key in for the animated
 * values. Folded together, everything else in it went with it: the classes,
 * and the plain inline styles beside the animated one. A title lost its
 * padding, a tab's pill its size, a row's swipe actions their layout. The
 * website never folds anything, so it never showed there.
 *
 * So the animated styles are taken out before NativeWind sees the props, and
 * handed back after it: last, as they are written everywhere in this app.
 */

type Props = Record<string, unknown> & { style?: unknown };

function isAnimatedStyle(style: unknown): boolean {
  return typeof style === 'object' && style !== null && 'viewDescriptors' in style;
}

function split(style: unknown, plain: unknown[], animated: unknown[]) {
  if (Array.isArray(style)) {
    for (const item of style) split(item, plain, animated);
  } else if (isAnimatedStyle(style)) {
    animated.push(style);
  } else if (style) {
    plain.push(style);
  }
}

function register(
  component: React.ComponentType<never>,
  name: string,
  mapping: Parameters<typeof cssInterop>[1]
) {
  // What NativeWind styles: the component itself, given the classes and the
  // plain styles as `style`, and the animated ones after them. cssInterop:
  // false keeps this element from being sent back through the mapping below.
  const Inner = React.forwardRef<unknown, Props & { animatedStyles: unknown[] }>(
    function Inner({ animatedStyles, style, ...props }, ref) {
      const animated = animatedStyles as unknown[];
      return React.createElement(component, {
        ...props,
        ref,
        style: animated.length > 0 ? [style, ...animated] : style,
        cssInterop: false,
      } as never);
    }
  );
  const Styled = cssInterop(Inner, mapping) as React.ComponentType<Props>;

  const Split = React.forwardRef<unknown, Props>(function Split({ style, ...props }, ref) {
    const plain: unknown[] = [];
    const animated: unknown[] = [];
    split(style, plain, animated);
    return React.createElement(Styled, { ...props, ref, style: plain, animatedStyles: animated });
  });
  Split.displayName = `NativeWind(${name})`;
  // Every <Animated.View> in the app now renders Split.
  interopComponents.set(component, Split as React.ComponentType<object>);
}

register(Animated.View as never, 'Animated.View', { className: 'style' });
register(Animated.Text as never, 'Animated.Text', { className: 'style' });
register(Animated.ScrollView as never, 'Animated.ScrollView', {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});
