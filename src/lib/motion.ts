import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * SwiftUI's springs, as Reanimated configs (mass 1; stiffness = (2pi /
 * response)^2, damping = 4pi (1 - bounce) / response - Apple's own conversion).
 * iOS animates nearly everything with one of these, and a spring never "runs
 * for 260 ms": it settles, and can be taken over mid-flight with the velocity
 * it had. Timed animations are for fades only.
 *
 *   default      .default (response 0.55, no bounce): anything not below
 *   smooth       .smooth: sheets, pushes, the tab pill, layout changes
 *   snappy       .snappy: glass pressed, the segment thumb, a menu opening
 *   bouncy       .bouncy: glass let go, a star tapped
 *   interactive  .interactiveSpring: whatever follows a finger
 *   switchThumb  UIKit's switch (response 0.30, damping 0.75)
 */
export const SPRINGS = {
  default: { mass: 1, stiffness: 130.5, damping: 22.8 },
  smooth: { mass: 1, stiffness: 157.9, damping: 25.1 },
  snappy: { mass: 1, stiffness: 157.9, damping: 21.4 },
  bouncy: { mass: 1, stiffness: 157.9, damping: 17.6 },
  interactive: { mass: 1, stiffness: 1754.6, damping: 72 },
  switchThumb: { mass: 1, stiffness: 438.6, damping: 31.4 },
} satisfies Record<string, WithSpringConfig>;

export type SpringName = keyof typeof SPRINGS;

/**
 * A spring, without its bounce when the device asks for less motion: the same
 * stiffness, critically damped, so it still settles in the same place at about
 * the same pace but never overshoots.
 *
 * A worklet, so a gesture can call it on the UI thread as it ends - a plain
 * function there is an uncaught error on a phone (the website runs gestures on
 * the JS thread, and never showed it).
 */
export function spring(
  name: SpringName,
  reduceMotion = false,
  velocity?: number
): WithSpringConfig {
  'worklet';
  const config = SPRINGS[name];
  const base = reduceMotion
    ? {
        ...config,
        damping: Math.max(config.damping, 2 * Math.sqrt(config.stiffness * config.mass)),
      }
    : config;
  return velocity === undefined ? base : { ...base, velocity };
}

/**
 * Material 3 Expressive's springs, from Compose's ExpressiveMotionTokens
 * (docs/material-design-guideline.md, section 10.1): damping = ratio x 2 x
 * sqrt(stiffness), mass 1. Spatial springs move and resize things and may
 * overshoot; effects springs carry colour and opacity and never do.
 *
 *   fastSpatial     a button's or a row's shape morph, the switch handle,
 *                   the navigation pill
 *   defaultSpatial  a sheet settling, a dialog arriving, a page push
 *   slowSpatial     a large app bar collapsing
 *   fastEffects, defaultEffects, slowEffects   colour, state layers, fades
 */
export const MATERIAL_SPRINGS = {
  fastSpatial: { mass: 1, stiffness: 800, damping: 33.94 },
  defaultSpatial: { mass: 1, stiffness: 380, damping: 31.19 },
  slowSpatial: { mass: 1, stiffness: 200, damping: 22.63 },
  fastEffects: { mass: 1, stiffness: 3800, damping: 123.29 },
  defaultEffects: { mass: 1, stiffness: 1600, damping: 80 },
  slowEffects: { mass: 1, stiffness: 800, damping: 56.57 },
} satisfies Record<string, WithSpringConfig>;

export type MaterialSpringName = keyof typeof MATERIAL_SPRINGS;

/**
 * A Material spring; with Remove animations on, critically damped - it lands
 * in the same place at about the same pace and never overshoots. A worklet,
 * as spring() is, for gestures on the UI thread.
 */
export function materialSpring(
  name: MaterialSpringName,
  reduceMotion = false,
  velocity?: number
): WithSpringConfig {
  'worklet';
  const config = MATERIAL_SPRINGS[name];
  const base = reduceMotion
    ? { ...config, damping: Math.max(config.damping, 2 * Math.sqrt(config.stiffness)) }
    : config;
  return velocity === undefined ? base : { ...base, velocity };
}

/** Fades: in quickly, out a touch quicker, never a spring. */
export const FADE_IN_MS = 200;
export const FADE_OUT_MS = 160;
