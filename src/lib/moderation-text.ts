/**
 * What moderation says, kept in one place so every skin says the same thing:
 * Basic and Material in the venue sheet, review sheet and My reviews, Chenfeng
 * in its own versions of those, and the admin panel where a moderator sees
 * exactly what an author will be told. A skin changes how these look, never
 * what they say. Chenfeng's title-case variants sit beside the sentence-case
 * ones rather than being worked out at run time.
 *
 * The server's side is in supabase/migrations/20261016100200: a review is
 * published, held (waiting for a person) or rejected, and a report never takes
 * anything down by itself. These words must never promise more than that.
 */

export type ModerationStatus = 'published' | 'held' | 'rejected';

/** A status, or null for a value this build does not know. */
export function moderationStatus(value: string | null | undefined): ModerationStatus | null {
  return value === 'published' || value === 'held' || value === 'rejected' ? value : null;
}

export type ReportReason =
  | 'hate'
  | 'harassment'
  | 'private_info'
  | 'spam'
  | 'not_genuine'
  | 'other';

export type ReasonText = {
  value: ReportReason;
  label: string;
  labelTitle: string;
  hint: string;
};

/**
 * Why a reader reports a review, and why a moderator rejects one: the same
 * list, in the order a reader is offered it. moderation_reason_valid in the
 * database accepts exactly these values.
 */
export const REPORT_REASONS: readonly ReasonText[] = [
  {
    value: 'hate',
    label: 'Hate or slurs',
    labelTitle: 'Hate or Slurs',
    hint: 'Attacks people for who they are.',
  },
  {
    value: 'harassment',
    label: 'Harassment or threats',
    labelTitle: 'Harassment or Threats',
    hint: 'Targets or threatens a person.',
  },
  {
    value: 'private_info',
    label: 'Private details about someone',
    labelTitle: 'Private Details',
    hint: "A name, phone number or address that shouldn't be public.",
  },
  {
    value: 'spam',
    label: 'Spam or advertising',
    labelTitle: 'Spam or Advertising',
    hint: 'Links, ads or nonsense.',
  },
  {
    value: 'not_genuine',
    label: 'Not a real visit',
    labelTitle: 'Not a Real Visit',
    hint: 'Made up, or about a different place.',
  },
  {
    value: 'other',
    label: 'Something else',
    labelTitle: 'Something Else',
    hint: 'Say what in the note.',
  },
];

/** The words for a reason, or null for a value this build does not know. */
export function reasonText(value: string | null | undefined): ReasonText | null {
  return REPORT_REASONS.find((reason) => reason.value === value) ?? null;
}

/** How an author's own review is described while it is not published. */
export const STATUS_TEXT = {
  held: {
    label: 'Being checked',
    labelTitle: 'Being Checked',
    line: 'Only you can see this until a person on our team has read it. Some words are always read by a person first, including when you are quoting what was said to you.',
    formLine: 'Being checked. Only you can see it until a person has read it.',
  },
  rejected: {
    label: 'Not published',
    labelTitle: 'Not Published',
    formLine: 'Not published. Saving an edit sends it back to be checked.',
  },
} as const;

/**
 * What an author is told when a moderator did not publish their review: the
 * reason, the moderator's own note if they wrote one, and how to try again.
 * The admin panel's reject dialog previews exactly this.
 */
export function rejectedLine(reason: string | null | undefined, note: string | null | undefined): string {
  const why = reasonText(reason);
  const lead = why
    ? `A moderator didn't publish this review: ${why.label.toLowerCase()}.`
    : "A moderator didn't publish this review.";
  const said = note?.trim() ? ` They wrote: "${note.trim()}"` : '';
  return `${lead}${said} Edit it and it goes back to be checked.`;
}

/** Shown once, after posting a review that has to wait for a person. */
export const HELD_AFTER_POST = {
  title: 'A person will read it first',
  titleTitle: 'A Person Will Read It First',
  body: 'Some words are always read by a person on our team before a review goes up, including when you are quoting what someone said to you. Until then, only you can see it.',
  done: 'Done',
};

export const REPORT_TEXT = {
  action: 'Report review',
  actionTitle: 'Report Review',
  /** Spoken by screen readers for the report button. */
  actionLabel: 'Report this review',
  title: 'Report review',
  titleTitle: 'Report Review',
  lead: 'A person on our team reads every report. Reporting never takes a review down by itself.',
  reasonHeading: "What's wrong with it?",
  reasonHeadingTitle: "What's Wrong With It?",
  noteHeading: 'Anything else? (optional)',
  noteHeadingTitle: 'Anything Else? (Optional)',
  notePlaceholder: 'Only moderators see this.',
  send: 'Send report',
  sendTitle: 'Send',
  sentTitle: 'Thanks for telling us',
  sentTitleTitle: 'Thanks for Telling Us',
  sentBody: 'A person on our team will read the review. Nobody else is told who reported it, including whoever wrote it.',
  reported: 'Reported',
  alreadySent: 'You have already reported this review.',
  signIn: "Sign in to report a review. Reports need an account so they can't be sent in bulk.",
  signInTitle: 'Sign In to Report',
  failedTitle: "Couldn't Send the Report",
};

/** A quoted slur a moderator has let stand, hidden until the reader asks. */
export const MASK_TEXT = {
  show: 'Show hidden word',
  showTitle: 'Show Hidden Word',
  hide: 'Hide word again',
  hideTitle: 'Hide Word Again',
  /** What a screen reader says in place of a hidden word. */
  spoken: 'hidden word',
};

const MASK_BULLET = '•';
const MASKED_WORD = new RegExp(`\\S?${MASK_BULLET}+(?:\\s+${MASK_BULLET}+)*`, 'gu');

/**
 * Masked text as a screen reader should say it. A mask keeps a word's first
 * letter and turns the rest into bullets, which would otherwise be read out
 * one bullet at a time. Only for text the server actually masked - a reviewer
 * may type a bullet of their own.
 */
export function spokenMasked(text: string): string {
  return text.replace(MASKED_WORD, `(${MASK_TEXT.spoken})`);
}
