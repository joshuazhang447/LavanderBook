import * as React from 'react';

import type { PlaceRow } from '@/lib/directory';
import type { NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';

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

/** The tag LavenderBook marks a warning with (20261018100000). */
const WARNING_KIND = 'dangerous';

/**
 * Whether the map shows a venue's pin under `filter`: the same split as the
 * list's, except that a warning always shows. Choosing "Visitors" must never
 * hide the pin that says a place is dangerous.
 */
export function mapShows(venue: Pick<NearbyVenue, 'tags'>, filter: ListFilter): boolean {
  if (filter === 'all') return true;
  const tags = venueTags(venue);
  if (tags.some((tag) => tag.slug === WARNING_KIND)) return true;
  return filter === 'listed' ? tags.length > 0 : tags.length === 0;
}

/** How many of `rows` each filter would show. */
export function countByFilter(rows: readonly PlaceRow[]): Record<ListFilter, number> {
  let listed = 0;
  for (const row of rows) if (isListed(row)) listed += 1;
  return { all: rows.length, listed, visitors: rows.length - listed };
}

/**
 * The order the list is in: nearest first, or the best rated first. Like the
 * filter, for the session only.
 *
 * "Top rated" is what Reviewed was reaching for - the places visitors rate
 * well - as an order rather than a filter, so it keeps meaning something when
 * every place has a review.
 */
export type ListOrder = 'nearest' | 'rated';

let currentOrder: ListOrder = 'nearest';
const orderListeners = new Set<() => void>();

export function setListOrder(next: ListOrder) {
  if (next === currentOrder) return;
  currentOrder = next;
  for (const listener of orderListeners) listener();
}

export function useListOrder(): ListOrder {
  return React.useSyncExternalStore(
    (listener) => {
      orderListeners.add(listener);
      return () => orderListeners.delete(listener);
    },
    () => currentOrder,
    () => 'nearest'
  );
}

/**
 * How many made-up middling reviews every place starts with, and their stars.
 * A place's rating is pulled toward 3 until enough real reviews outweigh
 * them: one 5-star review rates 3.7 here, thirty averaging 4.8 rate 4.7. So a
 * single review, kind or cruel, never puts a place at the top or the bottom.
 */
const PRIOR_REVIEWS = 2;
const PRIOR_STARS = 3;

/** A place's rating for ordering, weighed by how many reviews it has. Null with none. */
function weighedRating(row: PlaceRow): number | null {
  const count = row.venue.review_count;
  if (count <= 0) return null;
  const average = Number(row.venue.avg_stars ?? 0);
  return (average * count + PRIOR_STARS * PRIOR_REVIEWS) / (count + PRIOR_REVIEWS);
}

/**
 * `rows` best rated first, by weighedRating; places nobody has rated after
 * every rated one; equal ones nearest first.
 */
export function byRating(rows: readonly PlaceRow[]): PlaceRow[] {
  const rated = rows.map((row) => ({ row, rating: weighedRating(row) }));
  rated.sort(
    (a, b) =>
      (b.rating ?? -1) - (a.rating ?? -1) ||
      (a.row.distance ?? Infinity) - (b.row.distance ?? Infinity) ||
      a.row.venue.name.localeCompare(b.row.venue.name)
  );
  return rated.map((entry) => entry.row);
}
