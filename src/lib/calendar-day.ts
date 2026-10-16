/**
 * Calendar days as the questionnaire stores them: 'YYYY-MM-DD', no time, no
 * zone. The pickers speak Date, and do not agree on which zone a day is in:
 * Android's calendar works in UTC days, iOS's in local ones. Read a Date back
 * in the wrong zone and the answer is a day off for half the world.
 *
 * Both directions use noon, so no offset or daylight-saving shift can carry a
 * day over into the next or the one before.
 */

export type DayZone = 'utc' | 'local';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Noon on the given day in `zone`, or noon today when `value` isn't a day. */
export function dayToDate(value: string, zone: DayZone): Date {
  const match = DAY.exec(value);
  const today = new Date();
  const [y, m, d] = match
    ? [Number(match[1]), Number(match[2]) - 1, Number(match[3])]
    : // Today is the person's own today, whichever zone the picker wants.
      [today.getFullYear(), today.getMonth(), today.getDate()];
  return zone === 'utc' ? new Date(Date.UTC(y, m, d, 12)) : new Date(y, m, d, 12);
}

/** The day a picker reported, read in the zone it reports in. */
export function dateToDay(date: Date, zone: DayZone): string {
  return zone === 'utc'
    ? `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    : `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
