import * as React from 'react';

import type { MapLocation } from '@/lib/map-location';
import type { Coords } from '@/lib/use-location';

/**
 * Where the Map tab's list is around - the reader while the map follows them,
 * else the middle of the map - so the Directory can look around the same
 * place. Pan the map to Toronto and the Directory is Toronto's.
 *
 * Kept in this module, on the device, for the session: nothing here is sent
 * anywhere, and the Directory sends only the rounded square, as ever.
 */
export type MapView = {
  origin: Coords;
  /** The origin is the reader themselves. */
  following: boolean;
  /**
   * The location choice the map was opened with (choiceKey). Picking another
   * city or turning "Near me" on starts a new map; until it has been shown,
   * where the old one was is not where the reader means.
   */
  choice: string;
};

let current: MapView | null = null;
const listeners = new Set<() => void>();

export function publishMapView(next: MapView) {
  if (
    current &&
    current.origin.latitude === next.origin.latitude &&
    current.origin.longitude === next.origin.longitude &&
    current.following === next.following &&
    current.choice === next.choice
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) listener();
}

/** Where the map's list was last around this session, or null before the map has been shown. */
export function useMapView(): MapView | null {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null
  );
}

/** The location choice, as a key that changes when the map would open somewhere else. */
export function choiceKey(location: Pick<MapLocation, 'mode' | 'usingDevice' | 'place'>): string {
  const place = location.place;
  return `${location.mode}|${location.usingDevice}|${place ? `${place.latitude},${place.longitude}` : ''}`;
}
