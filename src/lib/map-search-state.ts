import * as React from 'react';

/**
 * Whether Chenfeng's search is open. Search there is the tab bar's own button,
 * as in iOS 26, but what it searches belongs to the Map tab - places on the
 * map, or the reviewed places in its list - so the bar opens it and the Map tab
 * draws it, and both read this. Nothing is stored: a search starts empty.
 */
let open = false;
const listeners = new Set<() => void>();

function emit(next: boolean) {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openMapSearch() {
  emit(true);
}

export function closeMapSearch() {
  emit(false);
}

export function useMapSearchOpen(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => open,
    () => false
  );
}
