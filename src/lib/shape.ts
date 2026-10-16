import { Platform, type ViewStyle } from 'react-native';

/**
 * Apple's rounded rectangles are continuous curves - the curvature eases into
 * the straight edge - not circular arcs, and a large circular corner is one of
 * the quieter tells that something was not drawn by iOS. React Native draws
 * them on iOS only; Android and the web keep plain radii. Capsules need none:
 * SwiftUI draws their ends circular too.
 *
 * NativeWind has no class for it, so it goes on as a style beside the radius:
 * style={CONTINUOUS}.
 */
export const CONTINUOUS: ViewStyle | undefined =
  Platform.OS === 'ios' ? { borderCurve: 'continuous' } : undefined;

/**
 * The display's corner radius, for a sheet that floats inset from the screen's
 * edges and has to be concentric with them. iOS does not tell apps, so this
 * goes by the screen's size in points; anything unknown gets 47, the safe side
 * - a radius a little small only looks slightly square, one too large cuts into
 * the display's own corner.
 */
export function displayCornerRadius(width: number, height: number): number {
  if (Platform.OS !== 'ios') return 47;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const is = (w: number, h: number) => short === w && long === h;
  // iPhone 16 Pro, 17, 17 Pro; 16 Pro Max, 17 Pro Max; Air.
  if (is(402, 874) || is(440, 956) || is(420, 912)) return 62;
  // iPhone 14 Pro, 15, 15 Pro, 16; 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus.
  if (is(393, 852) || is(430, 932)) return 55;
  // iPhone 12 Pro Max, 13 Pro Max, 14 Plus.
  if (is(428, 926)) return 53.33;
  // iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e.
  if (is(390, 844)) return 47.33;
  // iPhone X, XS, 11 Pro, 12 mini, 13 mini.
  if (is(375, 812)) return 39;
  return 47;
}

/** A shape nested inside another, its corners sharing the outer one's centres. */
export function concentric(outerRadius: number, inset: number): number {
  return Math.max(0, outerRadius - inset);
}
