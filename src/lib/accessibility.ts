import * as React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * The device's display settings that a drawn skin has to obey by hand - the
 * system's own controls follow them by themselves. Read once, then kept up to
 * date by the system's change events.
 *
 *   reduceMotion        slides become fades, springs lose their bounce
 *   reduceTransparency  glass becomes an opaque surface
 *   boldText            every weight steps up one (iOS)
 *   highContrast        colours take their increased-contrast values: iOS's
 *                       Increase Contrast, Android's high contrast text
 *
 * On the website the first and last are the prefers-reduced-motion and
 * prefers-contrast media queries, and contrast is handled in CSS as well
 * (skin-provider.web.tsx) - this is for what JavaScript draws.
 */
export type DisplaySettings = {
  reduceMotion: boolean;
  reduceTransparency: boolean;
  boldText: boolean;
  highContrast: boolean;
};

const DEFAULTS: DisplaySettings = {
  reduceMotion: false,
  reduceTransparency: false,
  boldText: false,
  highContrast: false,
};

let settings = DEFAULTS;
const listeners = new Set<() => void>();
let started = false;

function set(next: Partial<DisplaySettings>) {
  const merged = { ...settings, ...next };
  if (
    merged.reduceMotion === settings.reduceMotion &&
    merged.reduceTransparency === settings.reduceTransparency &&
    merged.boldText === settings.boldText &&
    merged.highContrast === settings.highContrast
  ) {
    return;
  }
  settings = merged;
  for (const listener of listeners) listener();
}

function watchNative() {
  const read = (key: keyof DisplaySettings, ask: () => Promise<boolean>) => {
    ask()
      .then((value) => set({ [key]: value }))
      .catch(() => {});
  };

  read('reduceMotion', AccessibilityInfo.isReduceMotionEnabled);
  AccessibilityInfo.addEventListener('reduceMotionChanged', (value) =>
    set({ reduceMotion: value })
  );

  if (Platform.OS === 'ios') {
    read('reduceTransparency', AccessibilityInfo.isReduceTransparencyEnabled);
    read('boldText', AccessibilityInfo.isBoldTextEnabled);
    read('highContrast', AccessibilityInfo.isDarkerSystemColorsEnabled);
    AccessibilityInfo.addEventListener('reduceTransparencyChanged', (value) =>
      set({ reduceTransparency: value })
    );
    AccessibilityInfo.addEventListener('boldTextChanged', (value) => set({ boldText: value }));
    AccessibilityInfo.addEventListener('darkerSystemColorsChanged', (value) =>
      set({ highContrast: value })
    );
  } else if (Platform.OS === 'android') {
    read('highContrast', AccessibilityInfo.isHighTextContrastEnabled);
    AccessibilityInfo.addEventListener('highTextContrastChanged', (value) =>
      set({ highContrast: value })
    );
  }
}

function watchWeb() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const queries: [keyof DisplaySettings, string][] = [
    ['reduceMotion', '(prefers-reduced-motion: reduce)'],
    ['reduceTransparency', '(prefers-reduced-transparency: reduce)'],
    ['highContrast', '(prefers-contrast: more)'],
  ];
  for (const [key, query] of queries) {
    const media = window.matchMedia(query);
    set({ [key]: media.matches });
    media.addEventListener?.('change', (event) => set({ [key]: event.matches }));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    if (Platform.OS === 'web') watchWeb();
    else watchNative();
  }
  return () => {
    listeners.delete(listener);
  };
}

/** The device's display settings, live. All false during the website's static render. */
export function useDisplaySettings(): DisplaySettings {
  return React.useSyncExternalStore(
    subscribe,
    () => settings,
    () => DEFAULTS
  );
}

/**
 * React Native's own font scale is at least this from the first accessibility
 * text size up (UIKit's isAccessibilityCategory): where side-by-side content
 * stacks.
 */
export const ACCESSIBILITY_FONT_SCALE = 1.786;
