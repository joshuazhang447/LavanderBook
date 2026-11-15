import * as React from 'react';

import type { PlaceRow } from '@/lib/directory';

/**
 * Which places the Map tab's list shows: all, the ones LavenderBook lists
 * (tagged), or the ones visitors found - reviewed, but not listed.
 *
 * Who put a place here, not whether it has reviews. "Reviewed" stopped
 * separating anything once most listed places had a review: it showed nearly
 * what All did. Listed and Visitors add up to All, however many reviews come
 * in, and say what matters before going somewhere: LavenderBook checked a
 * listed place; a visitors' one has only their word.
 *
 * A module store rather than the list's own state: the list is unmounted every
 * time the tab goes back to the map, and a filter that reset each time would
 * have to be set again on every return. For the session only - unlike the
 * distance, it is a question of the moment, not a preference.
 */
export type ListFilter = 'all' | 'listed' | 'visitors';

let current: ListFilter = 'all';
const listeners = new Set<() => void>();

export function setListFilter(next: ListFilter) {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export function useListFilter(): ListFilter {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => 'all'
  );
}

/** A place LavenderBook lists has a kind; one only visitors found has none. */
export function isListed(row: PlaceRow): boolean {
  return row.tags.length > 0;
}

export function passesListFilter(row: PlaceRow, filter: ListFilter): boolean {
  if (filter === 'listed') return isListed(row);
  if (filter === 'visitors') return !isListed(row);
  return true;
}

/** How many of `rows` each filter would show. */
export function countByFilter(rows: readonly PlaceRow[]): Record<ListFilter, number> {
  let listed = 0;
  for (const row of rows) if (isListed(row)) listed += 1;
  return { all: rows.length, listed, visitors: rows.length - listed };
}
