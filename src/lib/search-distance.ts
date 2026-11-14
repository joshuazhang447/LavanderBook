import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

/**
 * How far the list and the Directory look, chosen on the distance meter.
 *
 * One setting for both, on purpose: somebody who has said "within 10 km" in the
 * Directory means it in the list too, and two meters that disagreed would have
 * to be set twice and remembered separately. A module store, like the map's
 * focus and the skin, so every screen showing a meter moves together.
 *
 * Kept on the device only, like where the map starts and which skin is on -
 * it is a preference about this phone's screen, and "how far I am willing to
 * travel" is not something an account needs to carry. "Leave now" clears it
 * with everything else (src/lib/safety.ts clears the whole store).
 */

/**
 * The meter's stops, in kilometres. Roughly doubling: the difference between 5
 * and 10 km matters to somebody on foot, the difference between 200 and 205
 * to nobody. Six, so each is a comfortable target on a phone.
 */
export const DISTANCE_STEPS_KM = [5, 10, 25, 50, 100, 250] as const;

export type DistanceKm = (typeof DISTANCE_STEPS_KM)[number];

/** A city and the towns around it: enough to fill the list without a choice being made. */
export const DEFAULT_DISTANCE_KM: DistanceKm = 50;

const STORAGE_KEY = 'lavenderbook.distance.v1';

let current: DistanceKm = DEFAULT_DISTANCE_KM;
let restored = false;
const listeners = new Set<() => void>();

function isStep(value: unknown): value is DistanceKm {
  return DISTANCE_STEPS_KM.includes(value as DistanceKm);
}

function emit() {
  for (const listener of listeners) listener();
}

/** Read the saved choice once; anything unreadable leaves the default. */
function restore() {
  if (restored) return;
  restored = true;
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      const saved = raw ? (JSON.parse(raw) as { km?: unknown }).km : null;
      // Only if nobody has moved the meter while this was being read.
      if (isStep(saved) && current === DEFAULT_DISTANCE_KM && saved !== current) {
        current = saved;
        emit();
      }
    })
    .catch(() => {});
}

export function setSearchDistance(km: DistanceKm) {
  if (km === current) return;
  current = km;
  emit();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ km })).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  restore();
  return () => {
    listeners.delete(listener);
  };
}

/** The chosen distance in kilometres, shared by every screen that asks. */
export function useSearchDistance(): DistanceKm {
  return React.useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_DISTANCE_KM
  );
}
