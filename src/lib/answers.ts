import type { Database } from '@/lib/database.types';

export type QuestionKind = Database['public']['Enums']['question_kind'];

export type Answer = Database['public']['Enums']['answer'];

export const ANSWER_LABEL: Record<Answer, string> = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Not sure',
};

/** The order a tie is broken in: an even split reads as the safer word. */
const ANSWER_ORDER: Answer[] = ['yes', 'no', 'unsure'];

export type Consensus = {
  answer: Answer;
  label: string;
  /** How many gave that answer. */
  count: number;
  /** How many answered at all - the only honest denominator. */
  total: number;
};

/**
 * The answer most people gave, and how many of them there were.
 *
 * The tally matters more here than usual: for a safety question, 3 of 4 reads
 * very differently from 3 of 3, and a bare "Yes" hides that difference. Shared
 * by the bathroom line and every yes/no tag question, so the two can never
 * disagree about what "most people said" means.
 */
export function consensus(counts: Partial<Record<Answer, number>>): Consensus | null {
  const total = ANSWER_ORDER.reduce((sum, answer) => sum + (counts[answer] ?? 0), 0);
  if (total === 0) return null;

  const answer = ANSWER_ORDER.reduce((best, current) =>
    (counts[current] ?? 0) > (counts[best] ?? 0) ? current : best
  );
  return { answer, label: ANSWER_LABEL[answer], count: counts[answer] ?? 0, total };
}


/* -------------------------------------------------------------------------- */
/*  Rendering a stored value                                                  */
/* -------------------------------------------------------------------------- */
//
// Shared by the venue sheet's aggregate cards and the admin panel's per-review
// expansion. Both are showing the same fourteen kinds, and a currency that
// rounds differently in one of them is a bug nobody would notice until it
// mattered.

export const NUMBER_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function configString(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function configNumber(config: Record<string, unknown>, key: string): number | null {
  const value = config[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A money amount in its own code; falls back to "CAD 15" for a code Intl rejects. */
export function money(amount: number, code: string | null): string {
  if (!code) return NUMBER_FORMAT.format(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${NUMBER_FORMAT.format(amount)}`;
  }
}

/** "22:00-06:00" as people write it, not as the database stores it. */
export function displayValue(kind: QuestionKind, value: string): string {
  return kind === 'time_range' ? value.replace('-', '–') : value;
}

/** The columns one stored answer can arrive in. See public.review_answers. */
export type StoredValue = {
  valueText: string | null;
  valueNumber: number | null;
  valueBool: boolean | null;
  valueAnswer: Answer | null;
  optionLabels: string[] | null;
};

/**
 * One person's answer, as a line of text.
 *
 * Returns null for an answer with nothing in it, which should not happen -
 * review_answers_exactly_one_value makes it a constraint violation - but a
 * renderer that quietly prints "null" when the impossible happens is worse than
 * one that says it has nothing to show.
 */
export function formatStoredAnswer(
  kind: QuestionKind,
  config: Record<string, unknown>,
  value: StoredValue
): string | null {
  switch (kind) {
    case 'yes_no':
      return value.valueBool === null ? null : value.valueBool ? 'Yes' : 'No';

    case 'yes_no_unsure':
      return value.valueAnswer === null ? null : ANSWER_LABEL[value.valueAnswer];

    case 'single_select':
    case 'multi_select':
      // Joined rather than listed, because an answer here is one line in a
      // stack of them; the panel is reading, not editing.
      return value.optionLabels?.length ? value.optionLabels.join(', ') : null;

    case 'rating': {
      if (value.valueNumber === null) return null;
      const max = configNumber(config, 'max') ?? 5;
      return `${NUMBER_FORMAT.format(value.valueNumber)} of ${max}`;
    }

    case 'scale': {
      if (value.valueNumber === null) return null;
      const max = configNumber(config, 'max');
      const label =
        value.valueNumber === configNumber(config, 'min')
          ? configString(config, 'min_label')
          : value.valueNumber === max
            ? configString(config, 'max_label')
            : null;
      const scale = max === null ? NUMBER_FORMAT.format(value.valueNumber)
                                 : `${NUMBER_FORMAT.format(value.valueNumber)} of ${max}`;
      return label ? `${scale} (${label})` : scale;
    }

    case 'currency':
      return value.valueNumber === null
        ? null
        : money(value.valueNumber, configString(config, 'code'));

    case 'duration': {
      if (value.valueNumber === null) return null;
      const unit = configString(config, 'unit');
      return unit
        ? `${NUMBER_FORMAT.format(value.valueNumber)} ${unit}`
        : NUMBER_FORMAT.format(value.valueNumber);
    }

    case 'number': {
      if (value.valueNumber === null) return null;
      const unit = configString(config, 'unit');
      return unit
        ? `${NUMBER_FORMAT.format(value.valueNumber)} ${unit}`
        : NUMBER_FORMAT.format(value.valueNumber);
    }

    default:
      // short_text, long_text, and the ISO-8601 kinds: time_of_day, time_range,
      // date. All stored as text; only time_range is rewritten for reading.
      return value.valueText === null || value.valueText.trim() === ''
        ? null
        : displayValue(kind, value.valueText);
  }
}
