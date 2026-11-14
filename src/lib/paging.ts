import * as React from 'react';

/**
 * A long list shown a page at a time: the first `pageSize` items, then a
 * button for the next page. For the account's own reviews, which have no upper
 * bound - somebody who has reviewed a hundred places should not wait for, or
 * scroll past, a hundred rows to reach the setting under them.
 *
 * On the device, over a list already fetched whole: my_reviews() is one
 * person's reviews, small enough to send at once, and paging the request would
 * make "delete" and "edit" reorder the pages under the reader.
 */
export function usePaging<T>(items: readonly T[] | null, pageSize: number) {
  const [count, setCount] = React.useState(pageSize);
  const total = items?.length ?? 0;
  const remaining = Math.max(0, total - count);

  return {
    shown: items ? items.slice(0, count) : null,
    total,
    /** How many the next press adds: a page, or what is left of one. */
    next: Math.min(pageSize, remaining),
    remaining,
    showMore: () => setCount((current) => current + pageSize),
  };
}

/** The account's reviews, a page at a time. */
export const REVIEWS_PAGE = 20;

/** The words of the page button, for every skin. */
export const PAGING_TEXT = {
  more: (n: number) => `Show ${n} more`,
  moreTitle: (n: number) => `Show ${n} More`,
  showing: (shown: number, total: number) => `Showing ${shown} of ${total}`,
} as const;
