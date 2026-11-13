import { linkify } from '@/lib/linkify';

/**
 * The words around what LavenderBook itself says about a place, for every
 * skin: Chenfeng's title case beside the sentence case the others use. Change
 * them here, never in one skin.
 */

/**
 * A place's description: a couple of lines of it under the name on the card,
 * and the whole of it - with what else we know, and its links - in a window
 * that opens from there.
 */
export const ABOUT_TEXT = {
  /** Under the cut-off description, saying there is more and that it opens. */
  more: 'Read more',
  moreTitle: 'More',
  /** Read out after the description itself, for the whole pressable. */
  moreSpoken: 'Opens the full description, what else LavenderBook knows, and links',
  links: 'Links',
  /** The window's way on to the answers reviewers gave. */
  visitors: 'What visitors reported',
  done: 'Done',
  /**
   * Who is speaking. A description is our own claim, as the notes are, and
   * must never read as something a visitor reported - the same line stands
   * over the notes for the same reason.
   */
  attribution: 'Written by LavenderBook, not by visitors.',
} as const;

export type PlaceLink = {
  href: string;
  /** As it was written: "kindspace.ca", "613-555-0100". */
  text: string;
  kind: 'web' | 'email' | 'phone';
};

/**
 * Every website, email address and phone number written into a place's
 * description and notes, once each, in the order they appear - for the list of
 * links at the foot of the description's window. The same finder that makes
 * them tappable in the text (linkify), so the two can never disagree about
 * what counts as a link.
 */
export function placeLinks(texts: readonly (string | null | undefined)[]): PlaceLink[] {
  const seen = new Set<string>();
  const links: PlaceLink[] = [];

  for (const text of texts) {
    if (!text) continue;
    for (const part of linkify(text)) {
      if (part.kind !== 'link' || seen.has(part.href)) continue;
      seen.add(part.href);
      links.push({
        href: part.href,
        text: part.text,
        kind: part.href.startsWith('mailto:')
          ? 'email'
          : part.href.startsWith('tel:')
            ? 'phone'
            : 'web',
      });
    }
  }

  return links;
}

/**
 * The way in to what is behind a place: what LavenderBook checked there and
 * what visitors reported. It used to be a small "More details" pill beside the
 * tags, and was mostly missed - so it now says what is inside, and shows the
 * start of it.
 */
export const DETAILS_TEXT = {
  title: 'Good to know',
  titleTitle: 'Good to Know',
  action: 'See the details',
  /** Read out for the whole card: it is one button. */
  spoken: 'Good to know: what LavenderBook checked here, and what visitors reported',
} as const;

/**
 * A note's headline. Notes are written as "a headline that carries the point,
 * a colon, then what it means" (.claude/skills/city-directory), so the part
 * before the colon is a complete thought and the natural teaser. A note
 * without that shape is used whole, and the row showing it cuts it to a line.
 */
function noteHeadline(body: string): string {
  const colon = body.indexOf(': ');
  return colon >= 8 && colon <= 100 ? body.slice(0, colon) : body;
}

/**
 * What the details card says before it is opened: one line counting what is
 * inside, and the first couple of things LavenderBook checked, as headlines.
 *
 * `answeredReviews` is how many reviews answered any of the tag's questions,
 * or zero when nobody has.
 */
export function detailsTeaser(
  notes: readonly { body: string }[],
  answeredReviews: number
): { line: string; points: string[] } {
  const checked =
    notes.length === 0
      ? null
      : notes.length === 1
        ? '1 thing LavenderBook checked'
        : `${notes.length} things LavenderBook checked`;
  const reported =
    answeredReviews === 0
      ? null
      : answeredReviews === 1
        ? 'answers from 1 visitor'
        : `answers from ${answeredReviews} visitors`;

  return {
    line: [checked, reported].filter(Boolean).join(' \u00b7 ') || 'What visitors reported',
    points: notes.slice(0, 2).map((note) => noteHeadline(note.body)),
  };
}
