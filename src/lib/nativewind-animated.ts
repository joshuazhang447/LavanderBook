import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

/**
 * Teach NativeWind about the reanimated components we style with `className`.
 *
 * NativeWind registers React Native's own components only. `className` is not a
 * real prop on anything - the interop turns it into `style` - so on an
 * unregistered component it is passed straight through and silently dropped:
 * react-native-web's View ignores `className` entirely (it derives its class
 * from `style` alone), and a plain RN View has no such prop.
 *
 * Registering here rather than in each file: this has to run once, before any
 * of those components render, so the root layout imports it for its side effect.
 */
cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });
cssInterop(Animated.ScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});
