import { getCalendars } from 'expo-localization';

/**
 * Clock times as the questionnaire stores them: 'HH:MM', 24-hour, local, no
 * date. The pickers speak Date, so these convert at the edge and nothing else
 * has to.
 */

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Today at the given clock time, or at `fallback` when `value` isn't one. */
export function clockToDate(value: string, fallback: string): Date {
  const match = CLOCK.exec(value) ?? CLOCK.exec(fallback);
  const date = new Date();
  date.setHours(match ? Number(match[1]) : 12, match ? Number(match[2]) : 0, 0, 0);
  return date;
}

/** The local clock time of a picked Date, as stored. */
export function dateToClock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Whether the phone is set to a 24-hour clock, so the dial matches every other
 * clock the person reads. What is stored is 24-hour either way.
 */
export function uses24HourClock(): boolean {
  return getCalendars()[0]?.uses24hourClock ?? true;
}
