/**
 * The words around what LavenderBook itself says about a place, for every
 * skin: Chenfeng's title case beside the sentence case the others use. Change
 * them here, never in one skin.
 */

/**
 * A place's description: a couple of lines of it under the name on the card,
 * and the whole of it - with how to reach the place - in a window that opens
 * from there.
 */
export const ABOUT_TEXT = {
  /** Under the cut-off description, saying there is more and that it opens. */
  more: 'Read more',
  moreTitle: 'More',
  /** Read out after the description itself, for the whole pressable. */
  moreSpoken: 'Opens the full description and how to reach them',
  /** When there are contacts behind it as well: says so, since "more" did not. */
  withContact: 'Contact & more',
  withContactTitle: 'Contact & More',
  /** Under the name, when there is no description: the contacts alone. */
  contactOnly: 'How to reach them',
  contactOnlyTitle: 'How to Reach Them',
  done: 'Done',
  /**
   * Who is speaking. A description is our own claim, as the notes are, and
   * must never read as something a visitor reported - the same line stands
   * over the notes for the same reason.
   */
  attribution: 'Written by LavenderBook, not by visitors.',
} as const;

/**
 * How to reach a place (venue_contacts): its website, phone, text line, email,
 * and labelled links to a service of its own - "Trans ID Clinic", "Booking".
 */
export const CONTACT_TEXT = {
  heading: 'Contact',
  headingTitle: 'Contact',
  /** What a row is called when it has no label of its own. */
  kinds: {
    website: 'Website',
    phone: 'Phone',
    text: 'Text',
    email: 'Email',
    link: 'Link',
  },
  /** Read out before the value: "Call 613-555-0100". */
  spoken: {
    website: 'Open website',
    phone: 'Call',
    text: 'Send a text to',
    email: 'Email',
    link: 'Open',
  },
  /** When the window has no contact to show. */
  none: 'LavenderBook has no contact details for this place yet.',
} as const;

/**
 * Who is speaking, where a place card keeps LavenderBook's words and visitors'
 * apart under headings of their own (OAU's place card; any skin may use them).
 */
export const VOICES_TEXT = {
  fromLavenderBook: 'From LavenderBook',
  fromVisitors: 'From visitors',
  visitorsLine: "Visitors' own words, not checked by LavenderBook.",
  directions: 'Directions',
  /** Read out for the directions button: where it goes, and what opens. */
  directionsSpoken: (name: string) => `Directions to ${name} in Google Maps`,
  getInTouch: 'Get in touch',
  writeReview: 'Write a review',
  noReviewsYet: 'No reviews yet',
  noWritten: 'No written reviews yet',
  haveYouBeen: 'Have you been? Tell others how it went.',
  seeChecked: 'See everything we checked',
  seeAnswers: 'See all answers',
  /** Read out after the review action when there are new questions. */
  newSpoken: 'There are new questions for you to answer',
  /** A place LavenderBook lists as a warning, over its card. */
  warning: 'LavenderBook lists this place as a warning',
  warningLine: 'What LavenderBook knows about it is in the note below.',
  /** A place with no public address: its first contact, as the thing to do. */
  contactVerb: {
    website: 'Open website',
    phone: 'Call',
    text: 'Send a text',
    email: 'Email',
    link: 'Open link',
  },
} as const;

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

/**
 * Over the organisations with no public address, in the list and the Directory:
 * online groups, and shelters that keep their address private. Only the ones
 * that serve where the reader is (20261114130000).
 */
export const ONLINE_TEXT = {
  heading: 'Online and by phone',
  headingTitle: 'Online and by Phone',
  lead: 'No public address: reach them by phone or online.',
  /** Under the first few, when the section is folded. */
  showAll: (count: number) => `Show all ${count} online and by phone`,
  showAllTitle: (count: number) => `Show All ${count}`,
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
  /** On a place LavenderBook does not list: somebody reviewed it, nobody here checked it. */
  foundByVisitors: 'Found by visitors',
  foundByVisitorsSpoken: 'found by visitors, not listed by LavenderBook',
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

/** The list's filter: every place, the ones LavenderBook lists, or the ones visitors found. */
export const LIST_FILTER_TEXT = {
  label: 'Show',
  all: { label: 'All', title: 'All', spoken: 'All places' },
  listed: { label: 'Listed', title: 'Listed', spoken: 'Listed by LavenderBook' },
  visitors: {
    label: 'Visitors',
    title: 'Visitors',
    spoken: 'Found by visitors, not listed by LavenderBook',
  },
  /** When the filter, not the distance, is what empties the list. */
  empty: (filter: 'listed' | 'visitors', km: number) =>
    filter === 'visitors'
      ? `Every place within ${km} km is listed by LavenderBook.`
      : `LavenderBook lists no places within ${km} km yet.`,
  emptyHint: 'Choose All to see every place here.',
} as const;

/** The list's order: nearest first, or the best rated first. */
export const LIST_ORDER_TEXT = {
  label: 'Order',
  nearest: { label: 'Nearest', title: 'Nearest', spoken: 'Nearest first' },
  rated: { label: 'Top rated', title: 'Top Rated', spoken: 'Best rated first' },
} as const;
