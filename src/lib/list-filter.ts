import * as React from 'react';

import type { PlaceRow } from '@/lib/directory';

/**
 * Which places the Map tab's list shows: all, the ones LavenderBook lists
 * (tagged), or the ones somebody has reviewed.
 *
 * A module store rather than the list's own state: the list is unmounted every
 * time the tab goes back to the map, and a filter that reset each time would
 * have to be set again on every return. For the session only - unlike the
 * distance, it is a question of the moment, not a preference.
 */
export type ListFilter = 'all' | 'listed' | 'reviewed';

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

export function passesListFilter(row: PlaceRow, filter: ListFilter): boolean {
  if (filter === 'listed') return row.tags.length > 0;
  if (filter === 'reviewed') return row.venue.review_count > 0;
  return true;
}

/** How many of `rows` each filter would show. */
export function countByFilter(rows: readonly PlaceRow[]): Record<ListFilter, number> {
  let listed = 0;
  let reviewed = 0;
  for (const row of rows) {
    if (row.tags.length > 0) listed += 1;
    if (row.venue.review_count > 0) reviewed += 1;
  }
  return { all: rows.length, listed, reviewed };
}
