import * as React from 'react';

import { consensus } from '@/lib/answers';
import { useAuth } from '@/lib/auth';
import {
  fetchAnswerSummary,
  fetchNewQuestionCount,
  type AnswerSummaryRow,
} from '@/lib/questionnaire';
import { supabase } from '@/lib/supabase';
import type { NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';

export type VenueReview = {
  id: string;
  stars: number;
  body: string | null;
  author_name: string | null;
  is_mine: boolean;
  /** A period counted in whole weeks; see @/lib/review-dates. */
  posted_period: string | null;
  /** The UTC day, only when the author shows dates. Never a time. */
  posted_on: string | null;
};

/** An admin-written bullet about this venue. */
export type Note = {
  id: string;
  body: string;
};

type Ratings = {
  review_count: number;
  avg_stars: number;
  trans_bathroom_yes: number;
  trans_bathroom_no: number;
  trans_bathroom_unsure: number;
};

/** The bathroom answer most reviewers gave, through the helper every yes/no tag question uses. */
export function bathroomConsensus(ratings: Ratings): { label: string; tally: string } | null {
  const top = consensus({
    yes: ratings.trans_bathroom_yes,
    no: ratings.trans_bathroom_no,
    unsure: ratings.trans_bathroom_unsure,
  });
  return top ? { label: top.label, tally: `${top.count} of ${top.total}` } : null;
}

/**
 * Everything the place card shows, fetched once: the ratings, everyone's
 * reviews, what LavenderBook checked, what visitors reported, and - for a
 * signed-in author - how many new questions are waiting. Shared by every
 * skin's card, so they can never disagree about a place.
 */
export function useVenueDetails(venue: NearbyVenue) {
  const { session } = useAuth();
  const [ratings, setRatings] = React.useState<Ratings | null>(null);
  const [reviews, setReviews] = React.useState<VenueReview[] | null>(null);
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [summary, setSummary] = React.useState<AnswerSummaryRow[]>([]);
  const [newQuestions, setNewQuestions] = React.useState(0);


/**
 * Detail for a reviewed venue: everyone's reviews, read-only, with a single
 * button handing off to the review form.
 *
 * The sheet chrome mirrors ReviewSheet rather than sharing it: that one wraps a
 * keyboard-avoiding form, this one a scroll list, and the shared part is small.
 */
  React.useEffect(() => {
    let active = true;

    supabase
      .from('venue_ratings')
      .select('review_count, avg_stars, trans_bathroom_yes, trans_bathroom_no, trans_bathroom_unsure')
      .eq('venue_id', venue.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setRatings(data as Ratings | null);
      });

    // A function rather than the table: author_id and the exact times are not
    // public, so the name, "is this mine" and a rough date are all decided
    // server-side. Newest week first, in the order the server sends them -
    // within a week the order is deliberately meaningless.
    supabase.rpc('venue_reviews', { p_venue_id: venue.id }).then(({ data, error }) => {
      if (!active) return;
      // An empty list and a failed request are not the same thing, and
      // rendering them the same way is what hid a broken embed for a day.
      if (error) console.error('Failed to load reviews', error);
      setReviews(data ?? []);
    });

    // Public read: venue_notes is selectable by anyone, which is the point of
    // writing them. Fetched up front rather than when a tag is tapped, because
    // whether there is anything to show is what decides if the tag is tappable
    // at all.
    supabase
      .from('venue_notes')
      .select('id, body')
      .eq('venue_id', venue.id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (active) setNotes((data as Note[] | null) ?? []);
      });

    // Same reasoning as the notes: whether anyone has answered anything is what
    // decides whether the tag pill opens a page at all.
    fetchAnswerSummary(venue.id)
      .then((rows) => {
        if (active) setSummary(rows);
      })
      .catch(() => {
        if (active) setSummary([]);
      });

    return () => {
      active = false;
    };
  }, [venue.id]);

  const userId = session?.user.id ?? null;

  // Only a signed-in author can have new questions waiting; the function is
  // not even callable signed out.
  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchNewQuestionCount(venue.id)
      .then((n) => {
        if (active) setNewQuestions(n);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [venue.id, userId]);

  const average = Number(ratings?.avg_stars ?? venue.avg_stars ?? 0);
  const count = ratings?.review_count ?? venue.review_count;
  const bathroom = ratings ? bathroomConsensus(ratings) : null;
  // Signed out, we cannot know - the review sheet will ask them to sign in.
  const hasOwnReview = !!session && !!reviews?.some((r) => r.is_mine);
  const tags = venueTags(venue);
  const nudge = userId ? newQuestions : 0;
  const hasTagPage = notes.length > 0 || summary.length > 0;

  return { reviews, notes, summary, average, count, bathroom, hasOwnReview, tags, nudge, hasTagPage };
}

