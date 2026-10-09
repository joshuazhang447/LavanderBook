/**
 * How a review's date is put into words, everywhere it is shown.
 *
 * The server never sends a reader an exact time. It sends a period, counted in
 * whole UTC weeks (see posting_period in
 * supabase/migrations/20261009180000_hide_review_dates.sql), and - only when
 * the author shows dates - the UTC day it was posted. This file turns those
 * into words, and nothing here can make them more precise than they arrived.
 */

export type PostedPeriod = 'recent' | 'weeks' | 'months' | 'half_year' | 'year';

/** Week counts in the comments are the ones posting_period uses. */
export const PERIOD_LABEL: Record<PostedPeriod, string> = {
  /** This week or last. */
  recent: 'Recently',
  /** Two to four weeks back. */
  weeks: 'A few weeks ago',
  /** Five to twenty-five weeks back. */
  months: 'A few months ago',
  /** Twenty-six to fifty-one weeks back. */
  half_year: 'Over six months ago',
  /** Fifty-two weeks or more. */
  year: 'Over a year ago',
};

const DAY = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

/**
 * A `date` column ("2026-09-12") as a day, in the reader's own format.
 *
 * Built as local midnight on purpose. `new Date('2026-09-12')` is UTC midnight,
 * which anywhere west of Greenwich formats as the 11th.
 */
export function formatPostedOn(postedOn: string): string | null {
  const [year, month, day] = postedOn.split('-').map(Number);
  if (!year || !month || !day) return null;
  return DAY.format(new Date(year, month - 1, day));
}

/** The words for a period, or null for a value this build does not know. */
export function periodLabel(period: string | null | undefined): string | null {
  return period && period in PERIOD_LABEL ? PERIOD_LABEL[period as PostedPeriod] : null;
}

/**
 * What a reader is shown for when a review was posted: the day if its author
 * shows dates, otherwise the period. Null when the server sent neither, which
 * an app older than the server would see.
 */
export function postedLabel(
  period: string | null | undefined,
  postedOn: string | null | undefined
): string | null {
  return (postedOn ? formatPostedOn(postedOn) : null) ?? periodLabel(period);
}
