import * as React from 'react';

import type { ReportReason } from '@/lib/moderation-text';
import { supabase } from '@/lib/supabase';

/**
 * Sends one report of a review. Resolves false when this account had already
 * reported it - not an error: the button may simply have been pressed twice.
 *
 * Through `supabase`, the client with the session: a report needs an account,
 * so they cannot be sent in bulk, and the server keeps who sent it from
 * everyone but moderators. See report_review in
 * supabase/migrations/20261016100200_held_reviews_reach_nobody_but_their_author.sql.
 */
export async function reportReview(
  reviewId: string,
  reason: ReportReason,
  note: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('report_review', {
    p_review_id: reviewId,
    p_reason: reason,
    p_note: note.trim() || undefined,
  });
  // The server's messages are written for the reader ("That review is not up
  // any more.", "You have sent a lot of reports today...").
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * One report being written, for every skin's report form. Mounted fresh for
 * each review, so it never carries one review's reason over to the next.
 */
export function useReportReview(reviewId: string) {
  const [reason, setReason] = React.useState<ReportReason | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** 'sent' once it went through; 'already' when this account had sent one before. */
  const [outcome, setOutcome] = React.useState<'sent' | 'already' | null>(null);

  const canSend = reason !== null && !busy && outcome === null;

  async function send(): Promise<boolean> {
    if (!canSend || reason === null) return false;
    setBusy(true);
    setError(null);
    try {
      const fresh = await reportReview(reviewId, reason, note);
      setOutcome(fresh ? 'sent' : 'already');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't send the report.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { reason, setReason, note, setNote, busy, error, outcome, canSend, send };
}
