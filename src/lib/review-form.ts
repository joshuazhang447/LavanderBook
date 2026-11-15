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
  arrangeVisit,
  fetchMyAnswers,
  fetchQuestionnaire,
  fetchUsedKinds,
  isAnswered,
  knowsWhoIsAsked,
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

/**
 * One thing between the form and Post: a question with no answer yet, or an
 * answer that will not pass. `key` is 'stars', 'bathroom', 'body' or a
 * question's id, so a skin can find the card it belongs to.
 */
export type Blocker = { key: string; kind: 'missing' | 'problem' };

/**
 * What a form that leads to its unanswered questions says, beside a Post that
 * waits for them, so they are not left to be found: how many are left, a way
 * there, and a line on each card.
 */
export const BLOCKER_TEXT = {
  /** Under a required question with no answer, once the form has shown what is missing. */
  missing: 'Answer this to post.',
  showMe: 'Show me',
  showMeSpoken: 'Go to the first question that still needs an answer',
  /** The footer's line: how much is still in the way. */
  line(blockers: readonly Blocker[]): string {
    const missing = blockers.filter((blocker) => blocker.kind === 'missing').length;
    const fix = blockers.length - missing;
    if (fix === 0) {
      return missing === 1
        ? '1 question still needs an answer.'
        : `${missing} questions still need an answer.`;
    }
    if (missing === 0) {
      return fix === 1 ? '1 answer needs fixing.' : `${fix} answers need fixing.`;
    }
    return `${missing} to answer and ${fix} to fix before you can post.`;
  },
};

/**
 * The words around "what did you use here?", for every skin that asks it. A
 * place's questions about itself go to everyone; a service's own only to
 * those who pick it, and nothing unpicked is ever required.
 */
export const VISIT_TEXT = {
  placeTitle: 'About the place',
  placeLine: 'Anyone who has been can answer these. Skip what you do not know.',
  usedTitle: 'Did you use any of these here?',
  usedLine: 'Pick what you used and we will ask a little about it. Nothing else is asked.',
  /** On a chip: what picking it adds. */
  adds: (count: number) => (count === 1 ? '1 question' : `${count} questions`),
  /** Read out with a chip. */
  spoken: (label: string, count: number, required: number, picked: boolean) =>
    label +
    (count > 0 ? `, ${count === 1 ? '1 question' : `${count} questions`}` : '') +
    (required > 0 ? `, ${required} needed to post` : '') +
    (picked ? ', picked' : ''),
  /** Under a picked kind's heading, when Post waits for some of it. */
  needed: (required: number) =>
    required === 1 ? '1 question here is needed to post.' : `${required} questions here are needed to post.`,
  /** Asked before unpicking a kind that has answers, since they go with it. */
  removeTitle: (label: string) => `Remove your answers about ${label}?`,
  removeMessage: (count: number) =>
    count === 1
      ? 'You answered 1 question about it. It will not be saved.'
      : `You answered ${count} questions about it. They will not be saved.`,
  remove: 'Remove',
  keep: 'Keep them',
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
  /**
   * Ask what the visit was for (VISIT_TEXT): the questions about the place
   * for everyone, each service's only for those who pick it. A skin that
   * leaves it off shows every question and is held to every required one,
   * as before; so is any form against a server that does not say who is
   * asked what.
   */
  askWhatWasUsed?: boolean;
};

/**
 * The review form's state and its two actions, for every skin's form: an
 * existing review pulled back so the form edits it, the venue's tag questions,
 * what blocks posting, and posting and deleting themselves. The checks here
 * are the ones the database enforces anyway; the form only says so sooner.
 */
export function useReviewForm({
  poi,
  venueId: knownVenueId,
  onSaved,
  askWhatWasUsed = false,
}: ReviewFormOptions) {
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
  /** The venue's kinds the reviewer says they used, by tag id. */
  const [picked, setPicked] = React.useState<string[]>([]);
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
        const [{ data: review }, tags, used] = await Promise.all([
          supabase.rpc('my_reviews').eq('venue_id', resolvedVenueId).maybeSingle(),
          // An untagged venue has no questions. A failed fetch looks the same,
          // and the review still posts - stars and the bathroom answer are
          // worth more than a blocked form.
          fetchQuestionnaire(resolvedVenueId).catch((): Questionnaire => []),
          askWhatWasUsed ? fetchUsedKinds(resolvedVenueId) : Promise.resolve(null),
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

          // What they said they used last time; for a review saved before the
          // question, the kinds they answered something of their own about.
          if (askWhatWasUsed && knowsWhoIsAsked(tags)) {
            setPicked(
              used ??
                tags
                  .filter((tag) =>
                    tag.asks.some((id) => {
                      const question = byId.get(id);
                      return (
                        question?.asked === 'if-used' &&
                        isAnswered(question.kind, mine[id] ?? null)
                      );
                    })
                  )
                  .map((tag) => tag.id)
            );
          }
        }
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId, poi.placeId, knownVenueId, askWhatWasUsed]);

  const tooLong = body.length > MAX_BODY;

  // Asked what the visit was for: the form is laid out by what was picked,
  // and only what it shows is checked and sent.
  const asking = askWhatWasUsed && knowsWhoIsAsked(questionnaire);
  const pickedSet = new Set(picked);
  const layout = asking ? arrangeVisit(questionnaire, pickedSet) : null;
  const questions = layout ? layout.asked : questionnaire.flatMap((tag) => tag.questions);

  /** Answers that unpicking this kind would take away, as the form would send them. */
  function answeredOnlyFor(tagId: string): string[] {
    if (!layout) return [];
    const without = new Set(picked.filter((id) => id !== tagId));
    const after = new Set(arrangeVisit(questionnaire, without).asked.map((q) => q.id));
    return layout.asked
      .filter((q) => !after.has(q.id) && isAnswered(q.kind, answers[q.id] ?? null))
      .map((q) => q.id);
  }

  /** Picks or unpicks a kind. Unpicking drops its answers: they would not be saved. */
  function togglePicked(tagId: string) {
    if (pickedSet.has(tagId)) {
      const lost = answeredOnlyFor(tagId);
      if (lost.length > 0) {
        setAnswers((current) => {
          const next = { ...current };
          for (const id of lost) delete next[id];
          return next;
        });
      }
      setPicked(picked.filter((id) => id !== tagId));
    } else {
      setPicked([...picked, tagId]);
    }
  }
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

  // Everything in the way, in the order the questions are asked: the two every
  // review has, the free text, then the tag questions.
  const blockers: Blocker[] = [];
  if (stars === null) blockers.push({ key: 'stars', kind: 'missing' });
  if (bathroom === null) blockers.push({ key: 'bathroom', kind: 'missing' });
  if (tooLong) blockers.push({ key: 'body', kind: 'problem' });
  for (const question of questions) {
    if (question.required && !isAnswered(question.kind, answers[question.id] ?? null)) {
      blockers.push({ key: question.id, kind: 'missing' });
    } else if (problems.has(question.id)) {
      blockers.push({ key: question.id, kind: 'problem' });
    }
  }

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
        // Only the kinds still offered here: a tag removed while the form was
        // open is not the reviewer's to claim.
        usedTags: layout
          ? picked.filter((id) => layout.services.some((service) => service.tag.id === id))
          : undefined,
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
    /**
     * What the visit was for, when this form asks it and the server says who
     * is asked what; null otherwise, and the skin lays out `questionnaire`.
     */
    visit: layout
      ? {
          ...layout,
          picked: pickedSet,
          toggle: togglePicked,
          /** How many answers unpicking would take away: ask first when it is any. */
          answersLostIfUnpicked: (tagId: string) => answeredOnlyFor(tagId).length,
        }
      : null,
    questions,
    missingRequired,
    problems,
    tooLong,
    canSubmit,
    /** What is in the way, in the form's order; empty when Post would go through. */
    blockers,
    identity,
    basicsMissing,
    blockingHint,
    remove,
    submit,
  };
}
