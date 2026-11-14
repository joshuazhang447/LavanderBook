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

/** Over the organisations with no place to visit, in the list and the Directory. */
export const ONLINE_TEXT = {
  heading: 'Online and by phone',
  headingTitle: 'Online and by Phone',
  lead: 'No place to visit: reach them from anywhere.',
} as const;

/**
 * The distance meter, over the list and the Directory: how far either looks.
 * One choice for both (src/lib/search-distance.ts).
 */
export const DISTANCE_TEXT = {
  label: 'Distance',
  labelTitle: 'Distance',
  within: (km: number) => `Within ${km} km`,
  /** One stop, read out. */
  spoken: (km: number) => `Within ${km} kilometres`,
} as const;

/** The Map tab's list: every listed or reviewed place around the map. */
export const LIST_TEXT = {
  search: 'Search the list',
  searchTitle: 'Search the List',
  listedNoReviews: 'Listed by LavenderBook · no reviews yet',
  /** Where every row is a listed place, and saying so on each would be noise. */
  noReviews: 'No reviews yet',
  empty: (km: number) => `Nothing is listed or reviewed within ${km} km of here yet.`,
  emptyTitle: 'No Places Here Yet',
  emptyHint: 'Move the distance further, or search for a place in Map view to add the first review.',
  failed: 'Could not load the places around here. Check your connection and try again.',
  failedTitle: 'Couldn’t Load Places',
  retry: 'Try again',
  retryTitle: 'Try Again',
} as const;

/**
 * The Directory tab: every place LavenderBook lists around here, by kind - for
 * somebody new to a city asking where the community centres, the trans
 * clinics, the shelters and the queer-owned businesses are.
 */
export const DIRECTORY_TEXT = {
  title: 'Directory',
  /** Under the title. */
  lead: (where: string) =>
    `LGBTQ+ community centres, clinics, support groups, shelters and queer-owned places ${where}, checked and listed by LavenderBook.`,
  nearYou: 'near you',
  near: (label: string) => `near ${label}`,
  search: 'Search: trans clinic, youth, bar…',
  searchLabel: 'Search the directory',
  /** Over the kinds, where it opens. */
  question: 'What are you looking for?',
  questionTitle: 'What Are You Looking For?',
  every: 'Everything',
  everyLead: 'Every listed place, nearest first',
  back: 'All kinds',
  backTitle: 'All Kinds',
  /** On the open kind's header, which goes back to choosing one. */
  change: 'Change',
  changeTitle: 'Change',
  changeSpoken: (label: string) => `${label}. Choose another kind`,
  count: (n: number) => (n === 1 ? '1 place' : `${n} places`),
  found: (n: number, query: string) =>
    n === 1 ? `1 place matches “${query}”` : `${n} places match “${query}”`,
  nothingFound: (query: string) => `Nothing listed matches “${query}”`,
  nothingFoundTitle: (query: string) => `No Results for “${query}”`,
  nothingFoundHint: (km: number) =>
    `Searched names, descriptions and kinds within ${km} km. Try another word, or move the distance further.`,
  emptyTitle: 'Nothing listed here yet',
  emptyTitleTitle: 'Nothing Listed Here Yet',
  empty: (km: number) =>
    `LavenderBook lists no places within ${km} km yet. Move the distance further: the directory is built one city at a time.`,
  failedTitle: 'Could not load the directory',
  failedTitleTitle: 'Couldn’t Load the Directory',
  failed: 'Check your connection and try again.',
} as const;

/** The list's filter: every place, the ones LavenderBook lists, or the reviewed ones. */
export const LIST_FILTER_TEXT = {
  label: 'Show',
  all: { label: 'All', title: 'All', spoken: 'All places' },
  listed: { label: 'Listed', title: 'Listed', spoken: 'Listed by LavenderBook' },
  reviewed: { label: 'Reviewed', title: 'Reviewed', spoken: 'Reviewed by visitors' },
  /** When the filter, not the distance, is what empties the list. */
  empty: (filter: 'listed' | 'reviewed', km: number) =>
    filter === 'reviewed'
      ? `Nobody has reviewed a place within ${km} km yet.`
      : `LavenderBook lists no places within ${km} km yet.`,
  emptyHint: 'Choose All to see every place here.',
} as const;
