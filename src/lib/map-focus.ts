import * as React from 'react';

import type { Coords } from '@/lib/use-location';

export type MapFocus = Coords & {
  /** Changes on every request, so focusing the same venue twice still counts. */
  token: number;
};

/**
 * Where the map should centre, set from another tab.
 *
 * A module store rather than route parameters: the map screen stays mounted
 * while you are on the account tab, and getting parameters to reach an
 * already-mounted screen through a headless tab navigator proved unreliable.
 * A store has no navigator in the middle of it.
 */
let focus: MapFocus | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function focusMapOn(coords: Coords) {
  focus = { ...coords, token: Date.now() };
  emit();
}

export function clearMapFocus() {
  if (!focus) return;
  focus = null;
  emit();
}

export function useMapFocus(): MapFocus | null {
  return React.useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => focus,
    () => focus
  );
}
