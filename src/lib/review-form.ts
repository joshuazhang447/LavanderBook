import {
  Calendar,
  CalendarOff,
  CircleUser,
  Clock,
  TriangleAlert,
  VenetianMask,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';

import { useAuth } from '@/lib/auth';
import type { Database } from '@/lib/database.types';
import {
  moderationStatus,
  rejectedLine,
  STATUS_TEXT,
  type ModerationStatus,
} from '@/lib/moderation-text';
import {
  answerProblem,
  fetchMyAnswers,
  fetchQuestionnaire,
  isAnswered,
  submitReview,
  toRpcAnswer,
  type AnswerMap,
  type Questionnaire,
} from '@/lib/questionnaire';
import { postedLabel } from '@/lib/review-dates';
import { supabase } from '@/lib/supabase';
import type { SelectedPoi } from '@/lib/venues';

export type Answer = Database['public']['Enums']['answer'];

/** Mirrors the reviews_body_length check constraint. */
export const MAX_BODY = 2000;

export const BATHROOM_OPTIONS: { value: Answer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
];

/**
 * The explanation behind the free-text field: the one part of a review no
 * switch can protect - a per-place name and a rough date hide who and when,
 * and a sentence can give both back. Every skin shows these words.
 */
export const WHAT_NOT_TO_WRITE = {
  title: 'Keep yourself out of it',
  lead: 'Reviews are public. Write about the place, not about you.',
  whyItMatters:
    "Anyone can read reviews, including people you would rather not be found by. Small details add up: a name, a time and a place together can be enough to work out who wrote it. Your random name and rough date can't hide what you write yourself.",
  leaveOut: [
    "Names: yours, your friends', or staff you spoke to",
    'When you went: the day, the time, or "last Friday night"',
    'What you looked like or wore, and who you were with',
    'Where you live, work or study, and how old you are',
    'Anything only you, or a few people, would know',
  ],
  writeAbout:
    'How you were treated, whether you felt safe, whether there were any LGBTQ+ employees, and anything someone like you should know before going.',
};

/** PostgREST errors carry the SQLSTATE; the form reacts to one of them. */
function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;
}

/** What an existing review shows readers. Null fields: there is no review yet. */
type Shown = {
  alias: string | null;
  hideDate: boolean;
  posted: string | null;
  /** Null from a server older than moderation, which publishes everything. */
  status: ModerationStatus | null;
  /** Why a moderator did not publish it, and what they wrote. Rejected only. */
  reason: string | null;
  note: string | null;
};

/**
 * Whether the review is up, then the name and the date it is, or will be,
 * shown with - said at the point of posting, because that is when it matters
 * and, for a new review, the only time either is decided.
 */
export function postingAs(
  profile: { display_name: string; per_place_names: boolean; hide_dates: boolean },
  existing: Shown | null,
  /** Where the switches are, by the name the skin gives the tab. */
  account = 'My Account'
): { icon: LucideIcon; text: string }[] {
  const status =
    existing?.status === 'held'
      ? [{ icon: Clock, text: STATUS_TEXT.held.formLine }]
      : existing?.status === 'rejected'
        ? [{ icon: TriangleAlert, text: rejectedLine(existing.reason, existing.note) }]
        : [];

  const name = existing
    ? existing.alias
      ? { icon: VenetianMask, text: `Shown as ${existing.alias}, a name only this review uses.` }
      : { icon: CircleUser, text: `Shown as ${profile.display_name}, your account name.` }
    : profile.per_place_names
      ? { icon: VenetianMask, text: 'Posts under a new random name, used for this place only.' }
      : {
          icon: CircleUser,
          text: `Posts as ${profile.display_name}. Per-place names are off in ${account}.`,
        };

  const date = existing
    ? existing.hideDate
      ? {
          icon: CalendarOff,
          text: existing.posted
            ? `Dated "${existing.posted}" - readers never see the day.`
            : 'Readers never see the day it was posted.',
        }
      : {
          icon: Calendar,
          text: existing.posted
            ? `Readers see the day it was posted, ${existing.posted}.`
            : 'Readers see the day it was posted.',
        }
    : profile.hide_dates
      ? { icon: CalendarOff, text: 'Readers see only a rough time, like "recently" - never the day.' }
      : {
          icon: Calendar,
          text: `Readers see the day you post it. Hidden dates are off in ${account}.`,
        };

  return [...status, name, date];
}


type ReviewFormOptions = {
  poi: SelectedPoi;
  /** Known when opened from the reviews list; looked up by place id from the map. */
  venueId?: string;
  /** After a save or a delete went through. */
  onSaved: () => void;
};

/**
 * The review form's state and its two actions, for every skin's form: an
 * existing review pulled back so the form edits it, the venue's tag questions,
 * what blocks posting, and posting and deleting themselves. The checks here
 * are the ones the database enforces anyway; the form only says so sooner.
 */
export function useReviewForm({ poi, venueId: knownVenueId, onSaved }: ReviewFormOptions) {
  const { session, profile } = useAuth();

  const [stars, setStars] = React.useState<number | null>(null);
  const [bathroom, setBathroom] = React.useState<Answer | null>(null);
  const [body, setBody] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [venueId, setVenueId] = React.useState<string | null>(knownVenueId ?? null);
  const [isExisting, setIsExisting] = React.useState(false);
  /** What the existing review shows readers; null when there is no review yet. */
  const [shown, setShown] = React.useState<Shown | null>(null);
  const [questionnaire, setQuestionnaire] = React.useState<Questionnaire>([]);
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  /**
   * 'held' once a save went through and the review is waiting for a person:
   * the form says so before it closes, and finish() closes it.
   */
  const [outcome, setOutcome] = React.useState<'held' | null>(null);

  const userId = session?.user.id ?? null;

  // Pull back an existing review so the sheet edits it rather than colliding
  // with the one-review-per-venue constraint.
  React.useEffect(() => {
    let active = true;

    (async () => {
      if (!userId) {
        if (active) setLoading(false);
        return;
      }

      let resolvedVenueId = knownVenueId ?? null;

      if (!resolvedVenueId && poi.placeId) {
        const { data: venue } = await supabase
          .from('venues')
          .select('id')
          .eq('google_place_id', poi.placeId)
          .maybeSingle();
        if (!active) return;
        resolvedVenueId = venue?.id ?? null;
      }

      if (resolvedVenueId) {
        setVenueId(resolvedVenueId);

        // The review and the venue's questions arrive together, behind the one
        // spinner: prefilled answers have to be there at first paint, and a
        // section appearing under a thumb already heading for Post is worse
        // than a slightly longer wait.
        const [{ data: review }, tags] = await Promise.all([
          supabase.rpc('my_reviews').eq('venue_id', resolvedVenueId).maybeSingle(),
          // An untagged venue has no questions. A failed fetch looks the same,
          // and the review still posts - stars and the bathroom answer are
          // worth more than a blocked form.
          fetchQuestionnaire(resolvedVenueId).catch((): Questionnaire => []),
        ]);
        if (!active) return;
        setQuestionnaire(tags);

        if (review) {
          setStars(review.stars);
          setBathroom(review.trans_bathroom);
          setBody(review.body ?? '');
          setIsExisting(true);
          setShown({
            // The generator cannot see that a RETURNS TABLE column is nullable.
            alias: (review.alias as string | null) ?? null,
            hideDate: review.hide_date,
            posted: postedLabel(review.posted_period, review.posted_on as string | null),
            status: moderationStatus(review.moderation),
            reason: (review.moderation_reason as string | null) ?? null,
            note: (review.moderation_note as string | null) ?? null,
          });

          const byId = new Map(tags.flatMap((tag) => tag.questions).map((q) => [q.id, q] as const));
          const mine = await fetchMyAnswers(review.id, byId).catch((): AnswerMap => ({}));
          if (!active) return;
          setAnswers(mine);
        }
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId, poi.placeId, knownVenueId]);

  const tooLong = body.length > MAX_BODY;

  const questions = questionnaire.flatMap((tag) => tag.questions);
  const missingRequired = questions.filter(
    (question) => question.required && !isAnswered(question.kind, answers[question.id] ?? null)
  );
  const problems = new Map<string, string>();
  for (const question of questions) {
    const problem = answerProblem(question, answers[question.id] ?? null);
    if (problem) problems.set(question.id, problem);
  }

  const canSubmit =
    stars !== null &&
    bathroom !== null &&
    !tooLong &&
    missingRequired.length === 0 &&
    problems.size === 0 &&
    !busy;

  const identity = profile ? postingAs(profile, isExisting ? shown : null) : [];

  // One sentence about whatever is in the way, or nothing.
  const basicsMissing = stars === null || bathroom === null;
  const blockingHint =
    basicsMissing && missingRequired.length > 0
      ? 'Pick a rating, answer the bathroom question and the questions marked * to post.'
      : basicsMissing
        ? 'Pick a rating and answer the bathroom question to post.'
        : missingRequired.length > 0
          ? 'Answer the questions marked * to post.'
          : problems.size > 0
            ? 'Fix the highlighted answer to post.'
            : null;

  async function remove() {
    if (!venueId || !userId) return;

    setError(null);
    setBusy(true);
    try {
      const { error: deleteError } = await supabase.rpc('delete_my_review', {
        p_venue_id: venueId,
      });
      if (deleteError) throw deleteError;
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete your review.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    // Guard again here, not just on the button: state could change between render
    // and press, and the checks below are what the database will enforce anyway.
    if (stars === null || bathroom === null || tooLong || !userId) return;
    if (missingRequired.length > 0 || problems.size > 0) return;

    setError(null);
    setBusy(true);
    // Reuse the venue if somebody already added it; only insert when new.
    let targetVenueId: string | undefined = venueId ?? undefined;
    try {

      if (!targetVenueId && poi.placeId) {
        const { data: existing } = await supabase
          .from('venues')
          .select('id')
          .eq('google_place_id', poi.placeId)
          .maybeSingle();
        targetVenueId = existing?.id;
      }

      if (!targetVenueId) {
        const { data: created, error: venueError } = await supabase
          .from('venues')
          .insert({
            google_place_id: poi.placeId ?? null,
            name: poi.name,
            lat: poi.latitude,
            lng: poi.longitude,
            last_synced_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (venueError) throw venueError;
        targetVenueId = created.id;
      }

      // Review and answers land together or not at all; the server validates
      // every answer against the question's own kind and settings.
      const reviewId = await submitReview({
        venueId: targetVenueId,
        stars,
        bathroom,
        body: body.trim() === '' ? null : body.trim(),
        answers: questions.flatMap((question) => {
          const value = toRpcAnswer(question, answers[question.id] ?? null);
          return value === null ? [] : [{ question_id: question.id, value }];
        }),
      });

      // Waiting for a person? Then say so before closing - otherwise the
      // review seems to vanish from the map it was just posted to. A failed
      // read-back is not worth blocking on: the save itself went through.
      const { data: saved } = await supabase
        .rpc('my_reviews')
        .eq('id', reviewId)
        .maybeSingle();
      if (moderationStatus(saved?.moderation) === 'held') {
        setOutcome('held');
        return;
      }

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your review.');
      // A required question added since the form opened. The error names it;
      // fetching again puts it on the form, marked, under that error.
      if (hasCode(e, '23514') && targetVenueId) {
        fetchQuestionnaire(targetVenueId)
          .then(setQuestionnaire)
          .catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    stars,
    setStars,
    bathroom,
    setBathroom,
    body,
    setBody,
    loading,
    busy,
    error,
    isExisting,
    shown,
    outcome,
    /** Closes the form after the held notice. */
    finish: onSaved,
    questionnaire,
    answers,
    setAnswers,
    questions,
    missingRequired,
    problems,
    tooLong,
    canSubmit,
    identity,
    basicsMissing,
    blockingHint,
    remove,
    submit,
  };
}
