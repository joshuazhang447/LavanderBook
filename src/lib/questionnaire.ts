import type { AnswerValue, QuestionKind, QuestionOption } from '@/components/question-field';
import type { Database, Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/**
 * Tag questions, from the reviewer's side.
 *
 * Reading: what a venue asks (venue_questionnaire), what this reviewer already
 * said (review_answers), what everyone said (venue_answer_summary). Writing:
 * submit_review, which is the only writer review_answers has.
 *
 * This module imports from question-field and never the reverse. The renderer
 * owns the value types; this owns how they travel.
 */

type Answer = Database['public']['Enums']['answer'];
type StoredAnswer = Pick<
  Database['public']['Tables']['review_answers']['Row'],
  'question_id' | 'value_text' | 'value_number' | 'value_bool' | 'value_answer' | 'value_option_ids'
>;

export type Question = {
  id: string;
  prompt: string;
  helpText: string | null;
  kind: QuestionKind;
  config: Record<string, unknown>;
  required: boolean;
  options: QuestionOption[];
  /**
   * Who is asked it (venue_question_audience): 'everyone' - it is about the
   * place - or 'if-used', only reviewers who say they used a kind that asks
   * it. Null from a server older than 20261115110000: everyone, as before.
   */
  asked: 'everyone' | 'if-used' | null;
};

export type QuestionnaireTag = {
  id: string;
  slug: string;
  label: string;
  color: string;
  textColor: string | null;
  /**
   * Deduplicated: a question shared by two of the venue's tags is listed once
   * per tag by the database, deliberately, but a form can only ask it once -
   * the primary key on review_answers would refuse a second answer anyway. It
   * appears under the first tag that lists it, so a later tag can end up with
   * no questions of its own and still be part of the intro.
   */
  questions: Question[];
  /** Every question this tag asks, shared ones included, by id: for arrangeVisit. */
  asks: string[];
};

export type Questionnaire = QuestionnaireTag[];

/** question id -> what the reviewer has entered, in the renderer's shape. */
export type AnswerMap = Record<string, AnswerValue>;

export type RpcAnswer = { question_id: string; value: Json };

// ---------------------------------------------------------------------------
// Narrowing jsonb
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** numeric arrives as a JSON number from an RPC and occasionally as a string. */
function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function asOptions(value: unknown): QuestionOption[] {
  return asArray(value).flatMap((row) => {
    const option = asRecord(row);
    return typeof option.id === 'string' && typeof option.label === 'string'
      ? [{ id: option.id, label: option.label }]
      : [];
  });
}

// ---------------------------------------------------------------------------
// What a venue asks
// ---------------------------------------------------------------------------

export async function fetchQuestionnaire(venueId: string): Promise<Questionnaire> {
  const { data, error } = await supabase.rpc('venue_questionnaire', { p_venue_id: venueId });
  if (error) throw error;

  const tags: QuestionnaireTag[] = [];
  const seen = new Set<string>();

  for (const row of data ?? []) {
    let tag = tags.find((t) => t.id === row.tag_id);
    if (!tag) {
      tag = {
        id: row.tag_id,
        slug: row.tag_slug,
        label: row.tag_label,
        color: row.tag_color,
        textColor: row.tag_text_color,
        questions: [],
        asks: [],
      };
      tags.push(tag);
    }
    tag.asks.push(row.question_id);
    if (seen.has(row.question_id)) continue;
    seen.add(row.question_id);

    // A server from before 20261115110000 sends no `everyone`.
    const everyone = (row as { everyone?: unknown }).everyone;
    tag.questions.push({
      id: row.question_id,
      prompt: row.prompt,
      helpText: row.help_text,
      kind: row.kind,
      config: asRecord(row.config),
      required: row.required,
      options: asOptions(row.options),
      asked: typeof everyone === 'boolean' ? (everyone ? 'everyone' : 'if-used') : null,
    });
  }

  return tags;
}

// ---------------------------------------------------------------------------
// What the visit was for
// ---------------------------------------------------------------------------

/** A kind as a chip or a heading: the tag without its questions. */
export type VisitKind = Omit<QuestionnaireTag, 'questions' | 'asks'>;

/** A kind the reviewer can say they used: its chip, and how much it adds. */
export type VisitService = {
  tag: VisitKind;
  /**
   * Questions picking it adds, as things stand: what nothing picked asks yet
   * (for a picked one, what it added). Can be 0 when picks before it share
   * them all.
   */
  count: number;
  /** How many of those Post waits for. */
  required: number;
};

/**
 * The form a reviewer sees, given what they say they used: the questions
 * about the place, asked of everyone; a chip per service with questions of
 * its own; and, under the chips, each picked service with its questions. A
 * question two picked services share is asked once, under the first.
 */
export type VisitLayout = {
  place: Question[];
  services: VisitService[];
  sections: { tag: VisitKind; questions: Question[] }[];
  /** Everything asked, in the form's order: what Post checks and what is sent. */
  asked: Question[];
};

/**
 * Whether the server says who each question is for. Without it (a server from
 * before 20261115110000) a form asks everything, as before.
 */
export function knowsWhoIsAsked(questionnaire: Questionnaire): boolean {
  return questionnaire.some((tag) => tag.questions.some((question) => question.asked !== null));
}

export function arrangeVisit(questionnaire: Questionnaire, picked: ReadonlySet<string>): VisitLayout {
  const all = questionnaire.flatMap((tag) => tag.questions);
  const byId = new Map(all.map((question) => [question.id, question] as const));
  const place = all.filter((question) => question.asked !== 'if-used');

  // Each service's own questions: those only reviewers who used it are asked.
  const kinds = questionnaire.flatMap((entry) => {
    const { questions: _questions, asks, ...tag } = entry;
    const own = asks.flatMap((id) => {
      const question = byId.get(id);
      return question && question.asked === 'if-used' ? [question] : [];
    });
    return own.length > 0 ? [{ tag, own }] : [];
  });

  const sections: VisitLayout['sections'] = [];
  const shown = new Set(place.map((question) => question.id));
  for (const { tag, own } of kinds) {
    if (!picked.has(tag.id)) continue;
    const fresh = own.filter((question) => !shown.has(question.id));
    fresh.forEach((question) => shown.add(question.id));
    if (fresh.length > 0) sections.push({ tag, questions: fresh });
  }

  // What each chip adds as things stand: a picked one, its own section; any
  // other, what no pick has asked yet - so a question two services share is
  // counted once, by whichever comes first.
  const sectionOf = new Map(
    sections.map((section) => [section.tag.id, new Set(section.questions.map((q) => q.id))] as const)
  );
  const services: VisitService[] = kinds.map(({ tag, own }) => {
    const mine = sectionOf.get(tag.id);
    const left = own.filter((question) => !shown.has(question.id) || mine?.has(question.id));
    return { tag, count: left.length, required: left.filter((q) => q.required).length };
  });

  return {
    place,
    services,
    sections,
    asked: [...place, ...sections.flatMap((section) => section.questions)],
  };
}

/** What the caller said they used at a venue, or null: no review, or none saved with picks. */
export async function fetchUsedKinds(venueId: string): Promise<string[] | null> {
  const { data, error } = await supabase.rpc('my_used_kinds', { p_venue_id: venueId });
  if (error) return null;
  return Array.isArray(data) ? data : null;
}

// ---------------------------------------------------------------------------
// What this reviewer said
// ---------------------------------------------------------------------------

/**
 * A stored row back into the renderer's shape. The column is chosen by the
 * question's kind, never by which column happens to be filled - the two agree
 * by constraint, but the kind is what the control is built from.
 */
export function fromStoredAnswer(kind: QuestionKind, row: StoredAnswer): AnswerValue {
  switch (kind) {
    case 'yes_no':
      return row.value_bool;
    case 'yes_no_unsure':
      return row.value_answer;
    case 'single_select':
      return row.value_option_ids?.[0] ?? null;
    case 'multi_select':
      return row.value_option_ids ?? null;
    case 'scale':
    case 'rating':
      return row.value_number === null ? null : asNumber(row.value_number);
    // These three are typed into a text box, so their state is a string.
    case 'number':
    case 'currency':
    case 'duration':
      return row.value_number === null ? null : String(asNumber(row.value_number));
    case 'time_of_day':
    case 'time_range':
    case 'date':
    case 'short_text':
    case 'long_text':
      return row.value_text;
  }
}

export async function fetchMyAnswers(
  reviewId: string,
  questions: ReadonlyMap<string, Question>
): Promise<AnswerMap> {
  const { data, error } = await supabase
    .from('review_answers')
    .select('question_id, value_text, value_number, value_bool, value_answer, value_option_ids')
    .eq('review_id', reviewId);
  if (error) throw error;

  const answers: AnswerMap = {};
  for (const row of data ?? []) {
    // An answer to a question the venue no longer asks has no field to land
    // in. It stays in the database - the save path leaves it alone too.
    const question = questions.get(row.question_id);
    if (question) answers[row.question_id] = fromStoredAnswer(question.kind, row);
  }
  return answers;
}

// ---------------------------------------------------------------------------
// Judging an answer before it is sent
// ---------------------------------------------------------------------------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Number('') is 0, so emptiness is checked before anything is parsed. */
function parseNumber(value: AnswerValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function configNumber(config: Record<string, unknown>, key: string): number | null {
  const v = config[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function splitRange(value: string): [string, string] {
  const [from = '', to = ''] = value.split('-');
  return [from.trim(), to.trim()];
}

/** Whether there is anything to send. Blank is never an error - it is a skip. */
export function isAnswered(kind: QuestionKind, value: AnswerValue): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') {
    if (kind === 'time_range') {
      const [from, to] = splitRange(value);
      return from !== '' || to !== '';
    }
    return value.trim() !== '';
  }
  return true;
}

/**
 * The client's copy of the server's FORMAT rules, so a mistake is pointed out
 * under the field rather than reported as a save failure naming a question the
 * person believes they answered. Only for kinds typed freely; a button cannot
 * be pressed wrong. The server still checks everything - this is manners, not
 * security.
 */
export function answerProblem(question: Question, value: AnswerValue): string | null {
  if (!isAnswered(question.kind, value)) return null;
  const { kind, config } = question;

  switch (kind) {
    case 'number': {
      const n = parseNumber(value);
      if (n === null) return 'Enter a number.';
      const min = configNumber(config, 'min');
      const max = configNumber(config, 'max');
      if (min !== null && n < min) return `Enter ${min} or more.`;
      if (max !== null && n > max) return `Enter ${max} or less.`;
      return null;
    }
    case 'currency':
    case 'duration': {
      const n = parseNumber(value);
      if (n === null) return 'Enter a number.';
      return n < 0 ? 'The amount cannot be negative.' : null;
    }
    case 'time_of_day':
      return TIME.test(String(value).trim()) ? null : 'Use 24-hour time, like 23:00.';
    case 'time_range': {
      // Start after end is fine: 22:00-06:00 is an overnight window.
      const [from, to] = splitRange(String(value));
      if (from === '' || to === '') return 'Pick both a start and an end time.';
      return TIME.test(from) && TIME.test(to) ? null : 'Use two 24-hour times, like 09:00-17:00.';
    }
    case 'date': {
      const text = String(value).trim();
      if (!DATE.test(text)) return 'Use a date like 2026-09-12.';
      const [y, m, d] = text.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      const real =
        date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
      return real ? null : 'That is not a real date.';
    }
    case 'multi_select': {
      const picked = Array.isArray(value) ? value.length : 0;
      const min = configNumber(config, 'min_choices');
      const max = configNumber(config, 'max_choices');
      if (min !== null && picked < min) return `Pick at least ${min}.`;
      if (max !== null && picked > max) return `Pick at most ${max}.`;
      return null;
    }
    case 'short_text':
    case 'long_text': {
      const max = configNumber(config, 'max_length') ?? (kind === 'short_text' ? 200 : 2000);
      return String(value).trim().length > max ? `Keep it under ${max} characters.` : null;
    }
    default:
      return null;
  }
}

/** The renderer's value as the RPC wants it, or null to leave the question out. */
export function toRpcAnswer(question: Question, value: AnswerValue): Json | null {
  if (!isAnswered(question.kind, value)) return null;

  switch (question.kind) {
    case 'number':
    case 'currency':
    case 'duration':
      return parseNumber(value);
    case 'time_range': {
      const [from, to] = splitRange(String(value));
      return `${from}-${to}`;
    }
    case 'time_of_day':
    case 'date':
    case 'short_text':
    case 'long_text':
      return typeof value === 'string' ? value.trim() : null;
    default:
      // boolean, 'yes' | 'no' | 'unsure', an option id, a list of them, a number.
      return value as Json;
  }
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export async function submitReview(input: {
  venueId: string;
  stars: number;
  bathroom: Answer;
  body: string | null;
  answers: RpcAnswer[];
  /**
   * The venue's kinds the reviewer used, from a form that asks. Left out
   * otherwise - and so never sent to a server that would not know it.
   */
  usedTags?: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('submit_review', {
    p_venue_id: input.venueId,
    p_stars: input.stars,
    p_trans_bathroom: input.bathroom,
    p_body: input.body ?? undefined,
    p_answers: input.answers as unknown as Json,
    ...(input.usedTags ? { p_used_tags: input.usedTags } : {}),
  });
  if (error) throw error;
  return data;
}

/** Questions this venue has asked since the caller last saved a review here. */
export async function fetchNewQuestionCount(venueId: string): Promise<number> {
  const { data, error } = await supabase.rpc('my_new_question_count', { p_venue_id: venueId });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

// ---------------------------------------------------------------------------
// What everyone said
// ---------------------------------------------------------------------------

export type OptionCount = { optionId: string; label: string; count: number };
export type ValueCount = { value: string; count: number };
export type StepCount = { value: number; count: number };
export type RecentText = {
  /** Masked where it quotes a slur a moderator let stand. */
  text: string;
  /** The words as written, when `text` has something masked. */
  unmasked: string | null;
  displayName: string;
  answeredAt: string;
};

/**
 * One question's answers, aggregated. The shape follows the kind, because a
 * pile of "23:00"s and a pile of paragraphs are not summarised the same way.
 * Every count here is out of the people who answered this question.
 */
export type AnswerSummary =
  | { kind: 'yes_no'; yes: number; no: number }
  | { kind: 'yes_no_unsure'; yes: number; no: number; unsure: number }
  | { kind: 'single_select' | 'multi_select'; options: OptionCount[] }
  | { kind: 'scale'; avg: number; min: number; max: number; distribution: StepCount[] }
  | { kind: 'rating'; avg: number }
  | { kind: 'number' | 'currency' | 'duration'; median: number; min: number; max: number; avg: number }
  | { kind: 'time_of_day' | 'time_range' | 'date'; mode: ValueCount | null; distinct: ValueCount[] }
  | { kind: 'short_text' | 'long_text'; recent: RecentText[] };

export type AnswerSummaryRow = {
  questionId: string;
  prompt: string;
  helpText: string | null;
  kind: QuestionKind;
  config: Record<string, unknown>;
  options: QuestionOption[];
  /** Superseded or retired: shown under the wording it was asked in, marked. */
  archived: boolean;
  /** The first of the venue's current tags that asks it; null = nothing here does any more. */
  tag: VisitKind | null;
  respondents: number;
  /** Reviews at this venue with at least one answer - the coverage line. */
  answeredReviews: number;
  summary: AnswerSummary;
};

function parseSummary(kind: QuestionKind, raw: unknown): AnswerSummary {
  const s = asRecord(raw);
  switch (kind) {
    case 'yes_no':
      return { kind, yes: asNumber(s.yes), no: asNumber(s.no) };
    case 'yes_no_unsure':
      return { kind, yes: asNumber(s.yes), no: asNumber(s.no), unsure: asNumber(s.unsure) };
    case 'single_select':
    case 'multi_select':
      return {
        kind,
        options: asArray(s.options)
          .map(asRecord)
          .map((o) => ({ optionId: asString(o.option_id), label: asString(o.label), count: asNumber(o.count) })),
      };
    case 'scale':
      return {
        kind,
        avg: asNumber(s.avg),
        min: asNumber(s.min),
        max: asNumber(s.max),
        distribution: asArray(s.distribution)
          .map(asRecord)
          .map((d) => ({ value: asNumber(d.value), count: asNumber(d.count) })),
      };
    case 'rating':
      return { kind, avg: asNumber(s.avg) };
    case 'number':
    case 'currency':
    case 'duration':
      return {
        kind,
        median: asNumber(s.median),
        min: asNumber(s.min),
        max: asNumber(s.max),
        avg: asNumber(s.avg),
      };
    case 'time_of_day':
    case 'time_range':
    case 'date': {
      const mode = asRecord(s.mode);
      return {
        kind,
        mode: typeof mode.value === 'string' ? { value: mode.value, count: asNumber(mode.count) } : null,
        distinct: asArray(s.distinct)
          .map(asRecord)
          .map((d) => ({ value: asString(d.value), count: asNumber(d.count) })),
      };
    }
    case 'short_text':
    case 'long_text':
      return {
        kind,
        recent: asArray(s.recent)
          .map(asRecord)
          .map((r) => ({
            text: asString(r.text),
            unmasked: asString(r.unmasked) || null,
            displayName: asString(r.display_name) || 'Someone',
            answeredAt: asString(r.answered_at),
          })),
      };
  }
}

export async function fetchAnswerSummary(venueId: string): Promise<AnswerSummaryRow[]> {
  const { data, error } = await supabase.rpc('venue_answer_summary', { p_venue_id: venueId });
  if (error) throw error;

  return (data ?? []).map((row) => {
    // A RETURNS TABLE column is typed non-null, but the tag comes off a left join.
    const tagId = row.tag_id as string | null;
    return {
      questionId: row.question_id,
      prompt: row.prompt,
      helpText: row.help_text,
      kind: row.kind,
      config: asRecord(row.config),
      options: asOptions(row.options),
      archived: row.archived,
      tag:
        tagId === null
          ? null
          : {
              id: tagId,
              slug: row.tag_slug,
              label: row.tag_label,
              color: row.tag_color,
              textColor: row.tag_text_color,
            },
      respondents: row.respondents,
      answeredReviews: row.answered_reviews,
      summary: parseSummary(row.kind, row.summary),
    };
  });
}
