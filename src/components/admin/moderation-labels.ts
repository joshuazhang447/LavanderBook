import type { TermCategory, TermMatch, TermTier } from '@/lib/admin';

/**
 * How the panel names the moderation vocabulary. Admin-only words: what
 * authors and readers are told lives in src/lib/moderation-text.ts.
 */

export const TIER_LABEL: Record<TermTier, string> = {
  hold: 'Hold',
  watch: 'Watch',
};

export const TIER_HINT: Record<TermTier, string> = {
  hold: 'The review waits until a person publishes it.',
  watch: 'The review publishes, and an item goes to Worth a look.',
};

export const CATEGORY_LABEL: Record<TermCategory, string> = {
  transphobic: 'Transphobic',
  homophobic: 'Homophobic & biphobic',
  racist: 'Racist & ethnic',
  ableist: 'Ableist',
  misogynist: 'Misogynist',
};

export const MATCH_LABEL: Record<TermMatch, string> = {
  word: 'Whole word',
  prefix: 'Word start',
  anywhere: 'Anywhere',
};

export const MATCH_HINT: Record<TermMatch, string> = {
  word: 'Only the word on its own. The usual choice.',
  prefix: 'The word and anything it begins, such as plurals and endings.',
  anywhere: 'Inside other words too. For languages written without spaces; refused for short Latin words.',
};

/** What put an item in the queue. Unknown signals show as they are. */
export const SIGNAL_LABEL: Record<string, string> = {
  held: 'Held by the word list',
  resubmitted: 'Edited after a rejection',
  screen_failed: 'The word list could not run',
  shadow_hold: 'Would have been held (shadow mode)',
  watch: 'Watch word',
  edited_after_clear: 'Edited around a word you let stand',
  edited: 'Edited since it came in',
  admin_edited: 'Edited by an admin',
  report: 'Reported',
  report_after_keep: 'Reported again after it was kept',
  rescan: 'Matched in a rescan',
  venue_name: 'Place name held',
  direct: 'Decided from Reviews',
  take_down: 'Taken down with the account',
};

export const DECISION_LABEL: Record<string, string> = {
  published: 'Published',
  kept: 'Kept up',
  rejected: 'Rejected',
  renamed: 'Renamed',
  deleted_by_author: 'Deleted by its author',
  deleted_by_admin: 'Deleted by an admin',
};

/**
 * A term as the panel lists it until someone chooses to see the words: each
 * word's first letter, then a bullet per letter - the same shape readers get.
 */
export function maskTerm(term: string): string {
  return term.replace(/(\S)(\S*)/gu, (_, first: string, rest: string) => first + '•'.repeat([...rest].length));
}
