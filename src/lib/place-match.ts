import type { PlaceRow } from '@/lib/directory';
import type { NearbyVenue } from '@/lib/use-nearby-venues';

/**
 * Search over the places LavenderBook already has on the device: the
 * Directory's search, the lists' search and the map's search bar.
 *
 * Every row is already here (a city has tens to a few hundred), so this is
 * worked out on the device, as fast as typing, and nothing typed is sent for
 * it. What it does that "every word appears somewhere" did not:
 *
 * - Small words do not have to appear: "a trans clinic near me" is "trans
 *   clinic". Words every place here would answer to ("queer", "LGBTQ+",
 *   "services") count when they match but never rule a place out.
 * - Accents, apostrophes, plurals and spelling: "sante" finds "santé",
 *   "womens" "women's", "clinics" "clinic", "center" "centre".
 * - What a word means, not only how it is spelt: "doctor" finds the places of
 *   the Affirming healthcare kind, "HRT" Trans healthcare, "church" Faith
 *   community, "food bank" Food & essentials - in English and French.
 * - Typing in progress and typos: "therap" and "theraphy" find therapy. Only a
 *   word nothing here contains is treated as a typo, so "queer" never turns
 *   into "Queen Street".
 * - Best first: a place whose name is what was typed, then names, then kinds,
 *   then descriptions; equal matches nearest first.
 */

/** Lower case, no accents or apostrophes: "Women’s Santé" -> "womens sante". */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’‘`]/g, '')
    .replace(/&/g, ' and ');
}

/** One spelling for words Canadian and American English spell two ways. */
const SPELLING: Record<string, string> = {
  center: 'centre',
  theater: 'theatre',
  counseling: 'counselling',
  counselor: 'counsellor',
  organization: 'organisation',
  neighbor: 'neighbour',
  neighborhood: 'neighbourhood',
  program: 'programme',
};

/** A plural's singular, roughly: "clinics" -> "clinic", "communities" -> "community". */
function stem(word: string): string {
  let base = word;
  if (base.length > 4 && base.endsWith('ies')) base = `${base.slice(0, -3)}y`;
  else if (base.length > 4 && /(ch|sh|ss|x|z)es$/.test(base)) base = base.slice(0, -2);
  else if (base.length > 3 && base.endsWith('s') && !/(ss|us|is)$/.test(base)) base = base.slice(0, -1);
  return SPELLING[base] ?? base;
}

/** The words of a text, as they are compared: folded, singular. */
export function wordsOf(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}

/**
 * Words that say nothing about which place is wanted, in English and French.
 * Left out of a search unless they are all it has.
 */
const STOP = new Set(
  wordsOf(
    'a an the and or of for to in at on by with from into near nearby around close closest ' +
      'nearest me my i im we our need want looking look find where wheres whats what is are ' +
      'any some somewhere place there here can get le la les l un une des de du d et ou pour ' +
      'pres au aux en dans sur'
  )
);

/**
 * Words every place in LavenderBook would answer to, and generic nouns that
 * many places' words leave out. A match counts; no match rules nothing out.
 */
const SOFT = new Set(
  wordsOf(
    'lgbt lgbtq lgbtqi lgbtqia lgbtq2 lgbtq2s lgbtq2s+ lgbtq2sia 2slgbtq 2slgbtqi 2slgbtqia ' +
      '2slgbtqqia glbt glbtq queer gay lesbian bi bisexual pan pansexual ace asexual friendly ' +
      'safe affirming inclusive welcoming positive service program resource organisation org ' +
      'agency help info information centre spot space'
  )
);

/** Words that mean one another, compared as one. */
const SAME_AS: readonly string[] = [
  'trans transgender transsexual',
  'nonbinary enby genderqueer',
  'women woman womens femme',
  'men man mens',
];

const ALTERNATES = new Map<string, string[]>();
for (const group of SAME_AS) {
  const words = wordsOf(group);
  for (const word of words) ALTERNATES.set(word, words);
}

/**
 * What a word means, as the kinds (tag slugs) of the places that answer to it.
 * Phrases are comma-separated; a word may mean several kinds. A place need not
 * use the word at all: "doctor" finds a health centre whose words never say it.
 */
const CONCEPTS: readonly (readonly [readonly string[], string])[] = [
  [
    ['crisis'],
    'crisis, emergency, urgent, suicide, suicidal, hotline, helpline, help line, crisis line, ' +
      'distress, abuse, violence, assault, crise, urgence',
  ],
  [
    ['shelter'],
    'shelter, housing, homeless, homelessness, bed, sleep, place to stay, somewhere to stay, ' +
      'hostel, emergency housing, transitional housing, logement, hebergement, refuge, abri',
  ],
  [
    ['food'],
    'food, meal, eat, food bank, foodbank, pantry, grocery, groceries, hungry, hunger, lunch, ' +
      'dinner, breakfast, clothes, clothing, essentials, hygiene, nourriture, ' +
      'banque alimentaire, repas, vetement',
  ],
  [
    ['healthcare', 'trans-healthcare', 'sexual-health'],
    'clinic, health, health centre, community health, nurse, nurse practitioner, clinique, sante',
  ],
  [
    ['healthcare'],
    'doctor, physician, gp, family doctor, medical, healthcare, hospital, primary care, ' +
      'walk in, medecin, soins',
  ],
  [
    ['trans-healthcare'],
    'hrt, hormone, estrogen, oestrogen, testosterone, transition, gender affirming, ' +
      'gender affirming care, gac, surgery, top surgery, bottom surgery, vaginoplasty, ' +
      'phalloplasty, gender clinic, puberty blocker, blocker, hormonotherapie',
  ],
  [
    ['mental-health'],
    'therapy, therapist, counselling, counsellor, psychologist, psychiatrist, psychiatry, ' +
      'mental, mental health, depression, anxiety, wellbeing, wellness, psychotherapy, ' +
      'psychotherapist, sante mentale, therapie, psychologue',
  ],
  [
    ['youth'],
    'youth, young, teen, teenager, kid, child, children, student, school, gsa, jeune, ' +
      'jeunesse, adolescent, ado',
  ],
  [
    ['legal'],
    'legal, lawyer, law, rights, human rights, name change, gender marker, discrimination, ' +
      'legal aid, paralegal, court, tribunal, juridique, aide juridique, avocat, droit',
  ],
  [
    ['hub'],
    'community centre, drop in, hub, event, hangout, meetup, social, community space, ' +
      'centre communautaire',
  ],
  [
    ['support-group'],
    'support group, peer support, support, group, peer, meeting, circle, groupe, soutien, entraide',
  ],
  [
    ['nightlife'],
    'bar, pub, club, nightclub, drag, drag show, dance, dancing, party, karaoke, cabaret, ' +
      'nightlife, night out, boite de nuit',
  ],
  [
    ['queer-owned'],
    'cafe, coffee, shop, store, bookstore, bookshop, restaurant, studio, salon, barber, ' +
      'tattoo, business, queer owned, boutique, librairie, commerce',
  ],
  [
    ['sexual-health'],
    'sexual health, hiv, aids, sti, std, sti testing, testing, prep, pep, condom, ' +
      'harm reduction, needle, naloxone, syphilis, depistage, vih, its, sante sexuelle',
  ],
  [
    ['online'],
    'online, virtual, website, chat, text, phone, call, internet, zoom, en ligne, virtuel',
  ],
  [['pride'], 'pride, parade, march, festival, fierte'],
  [
    ['faith'],
    'faith, church, mosque, synagogue, temple, gurdwara, spiritual, spirituality, religion, ' +
      'religious, congregation, worship, prayer, christian, muslim, jewish, buddhist, sikh, ' +
      'hindu, ministry, chapel, eglise, foi, spirituel',
  ],
  [
    ['sports'],
    'sport, team, league, soccer, football, hockey, volleyball, softball, baseball, ' +
      'basketball, curling, running, run club, swim, swimming, gym, fitness, yoga, climbing, ' +
      'hiking, outdoors, recreation, roller derby, dodgeball, bowling, rugby, tennis, ' +
      'badminton, loisir',
  ],
  [
    ['arts'],
    'art, artist, culture, choir, chorus, singing, theatre, film, cinema, movie, music, band, ' +
      'writing, poetry, gallery, museum, library, book club, culturel, chorale',
  ],
  [
    ['seniors'],
    'senior, older, older adult, elder, aging, ageing, retired, retirement, aine, aines',
  ],
  [
    ['family'],
    'family, parent, mom, mum, dad, partner, pflag, famille, parents',
  ],
  [
    ['newcomers'],
    'newcomer, immigrant, immigration, refugee, asylum, claimant, refugee claimant, ' +
      'settlement, esl, international, nouveaux arrivants, nouvel arrivant, refugie, demandeur',
  ],
  [
    ['campus'],
    'campus, university, college, uni, student union, pride centre, universite, cegep',
  ],
  [
    ['two-spirit'],
    'two spirit, two spirited, twospirit, 2 spirit, 2 spirited, 2spirit, 2s, indigenous, native, first nations, metis, inuit, aboriginal, ' +
      'bispirituel, autochtone',
  ],
  [['bathhouse'], 'bathhouse, bath, sauna, steam'],
  [['dangerous'], 'danger, dangerous, unsafe, avoid, warning, hostile'],
];

/** One word's kinds, and every phrase's, as compared. */
const WORD_KINDS = new Map<string, Set<string>>();
const PHRASES: { words: string[]; kinds: Set<string> }[] = [];

for (const [kinds, triggers] of CONCEPTS) {
  for (const trigger of triggers.split(',')) {
    const words = wordsOf(trigger);
    if (words.length === 0) continue;
    if (words.length === 1) {
      const set = WORD_KINDS.get(words[0]) ?? new Set<string>();
      for (const kind of kinds) set.add(kind);
      WORD_KINDS.set(words[0], set);
    } else {
      const known = PHRASES.find((phrase) => phrase.words.join(' ') === words.join(' '));
      if (known) for (const kind of kinds) known.kinds.add(kind);
      else PHRASES.push({ words, kinds: new Set(kinds) });
    }
  }
}
// Longest first, so "gender affirming care" is read before "gender affirming".
PHRASES.sort((a, b) => b.words.length - a.words.length);

/**
 * Edits between two words (insert, delete, change, swap two neighbours),
 * giving up past `limit`.
 */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current.push(value);
      if (value < rowBest) rowBest = value;
    }
    if (rowBest > limit) return limit + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length];
}

/** How many edits a word of this length may be off by and still be meant. */
function typoLimit(word: string): number {
  return word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;
}

/** Whether `typed` reads as a slip for `word`: few edits off, first letter right if short. */
function nearMiss(typed: string, word: string): boolean {
  const limit = typoLimit(typed);
  if (limit === 0) return false;
  if (typed.length < 6 && typed[0] !== word[0]) return false;
  if (editDistance(typed, word, limit) <= limit) return true;
  // Still typing a word that has a slip in it: "helthc" for "healthcare".
  return (
    word.length > typed.length &&
    (editDistance(typed, word.slice(0, typed.length), limit) <= limit ||
      editDistance(typed, word.slice(0, typed.length + 1), limit) <= limit)
  );
}

/** One part of a search: a word, or a phrase such as "food bank". */
type Term = {
  /** Every one must match, for the term's own words to count. */
  words: string[];
  /** Words compared as the same as a one-word term: "trans" and "transgender". */
  alternates: string[];
  /** The kinds the term means, and how sure that reading is (1, a word started, a slip). */
  kinds: Map<string, number>;
  /** Counts when it matches; rules nothing out. */
  soft: boolean;
  /** Not a word any place or kind here has: worth reading as a slip. */
  unknown: boolean;
  /**
   * The last word, still being typed (nothing after it yet): it may be the
   * start of a longer word. A finished "bar" is a bar, not a barber.
   */
  typing: boolean;
};

function addKinds(target: Map<string, number>, kinds: Iterable<string>, sureness: number) {
  for (const kind of kinds) target.set(kind, Math.max(target.get(kind) ?? 0, sureness));
}

/** The kinds a single word means: by itself, as the start of one, or as a slip for one. */
function kindsOfWord(word: string, unknown: boolean, typing: boolean): Map<string, number> {
  const kinds = new Map<string, number>();
  const exact = WORD_KINDS.get(word);
  if (exact) addKinds(kinds, exact, 1);
  if (!exact && typing && word.length >= 3) {
    for (const [trigger, set] of WORD_KINDS) {
      if (trigger !== word && trigger.startsWith(word)) addKinds(kinds, set, 0.8);
    }
  }
  if (unknown && kinds.size === 0 && word.length >= 5) {
    for (const [trigger, set] of WORD_KINDS) {
      if (nearMiss(word, trigger)) addKinds(kinds, set, 0.6);
    }
  }
  return kinds;
}

/** A search read into its terms. `vocabulary` is every word the places searched use. */
function readQuery(query: string, vocabulary: ReadonlySet<string>): Term[] {
  const tokens = wordsOf(query);
  // Nothing typed after the last word yet: it may be unfinished.
  const stillTyping = /[a-z0-9]$/i.test(fold(query));
  const isKnown = (word: string, typing: boolean) => {
    if (vocabulary.has(word) || WORD_KINDS.has(word)) return true;
    if (!typing) return false;
    for (const known of vocabulary) if (known.startsWith(word)) return true;
    for (const known of WORD_KINDS.keys()) if (known.startsWith(word)) return true;
    return false;
  };

  const terms: Term[] = [];
  const stops: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    const phrase = PHRASES.find((candidate) =>
      candidate.words.every((word, offset) => tokens[i + offset] === word)
    );
    if (phrase) {
      terms.push({
        words: phrase.words,
        alternates: [],
        kinds: new Map([...phrase.kinds].map((kind) => [kind, 1])),
        soft: false,
        unknown: false,
        typing: false,
      });
      i += phrase.words.length;
      continue;
    }

    const word = tokens[i];
    i += 1;
    const typing = stillTyping && i === tokens.length;
    if (STOP.has(word) && !typing) {
      stops.push(word);
      continue;
    }
    // A word every place answers to is never a slip for another word: a
    // city whose places never say "queer" must not read it as "Queen".
    const unknown = !SOFT.has(word) && !STOP.has(word) && !isKnown(word, typing);
    terms.push({
      words: [word],
      alternates: ALTERNATES.get(word) ?? [word],
      kinds: kindsOfWord(word, unknown, typing),
      // Unfinished, a small word may be the start of a real one ("the" of
      // "theatre"): it counts if it matches, and rules nothing out.
      soft: SOFT.has(word) || STOP.has(word),
      unknown,
      typing,
    });
  }

  // Nothing left but words that rule nothing out: then they are the search.
  if (terms.length > 0 && terms.every((term) => term.soft)) {
    for (const term of terms) term.soft = false;
  }
  if (terms.length === 0) {
    for (const word of stops) {
      terms.push({
        words: [word],
        alternates: [word],
        kinds: new Map(),
        soft: false,
        unknown: false,
        typing: false,
      });
    }
  }
  return terms;
}

/** A place's words, ready to compare. Kept per venue object for the session. */
type Indexed = {
  name: string[];
  /** The name's words joined: what the whole search is compared with. */
  nameLine: string;
  kinds: string[];
  slugs: Set<string>;
  text: string[];
};

const indexes = new WeakMap<NearbyVenue, Indexed>();

function indexOf(row: PlaceRow): Indexed {
  const cached = indexes.get(row.venue);
  if (cached) return cached;
  const name = wordsOf(row.venue.name);
  const text = new Set([
    ...wordsOf(row.venue.description ?? ''),
    // An online organisation's city: "Ottawa" finds the ones serving Ottawa.
    ...wordsOf((row.venue as { serves_city?: string | null }).serves_city ?? ''),
  ]);
  const indexed: Indexed = {
    name,
    nameLine: name.join(' '),
    kinds: [...new Set(row.tags.flatMap((tag) => wordsOf(tag.label)))],
    slugs: new Set(row.tags.map((tag) => tag.slug)),
    text: [...text],
  };
  indexes.set(row.venue, indexed);
  return indexed;
}

/** How a name's word counts against a kind's, against a description's. */
const WEIGHT = { name: 3, kinds: 2, text: 1 } as const;

/**
 * How well one typed word fits one field's words: 1 the word, less for the
 * start of one while it is being typed, part of one ("care" of "healthcare"),
 * or a slip.
 */
function fit(typed: string, words: readonly string[], term: Term): number {
  let best = 0;
  for (const word of words) {
    if (word === typed) return 1;
    if (term.typing && word.startsWith(typed)) best = Math.max(best, 0.6);
    else if (typed.length >= 4 && word.includes(typed)) best = Math.max(best, 0.4);
  }
  if (best === 0 && term.unknown) {
    for (const word of words) {
      if (nearMiss(typed, word)) return 0.5;
    }
  }
  return best;
}

/** How well a term fits a place: by its own words in any field, or by what it means. */
function termScore(term: Term, place: Indexed): number {
  let literal = Infinity;
  for (const word of term.words) {
    const options = term.words.length === 1 ? term.alternates : [word];
    let best = 0;
    for (const option of options) {
      best = Math.max(
        best,
        WEIGHT.name * fit(option, place.name, term),
        WEIGHT.kinds * fit(option, place.kinds, term),
        WEIGHT.text * fit(option, place.text, term)
      );
    }
    literal = Math.min(literal, best);
  }
  let meant = 0;
  for (const [kind, sureness] of term.kinds) {
    if (place.slugs.has(kind)) meant = Math.max(meant, WEIGHT.kinds * sureness);
  }
  const said = literal === Infinity ? 0 : literal;
  // A place that both is the kind and says the word comes first: of the
  // queer-owned places, the cafe that calls itself one before the barber.
  return Math.max(said, meant) + Math.min(said, meant) / 4;
}

/** What a word that rules nothing out adds when it matches: enough to order, never to lead. */
const SOFT_SCORE = 0.25;

/** The least a place missing one word must score to be listed anyway: a word of its name. */
const NEAR_MISS_MIN_SCORE = 3;

/**
 * The rows `query` finds, best first. An empty query finds every row, in the
 * order given.
 *
 * `weight` scales a row's score: the map's search bar halves it for places
 * beyond the distance, so a youth group 150 km away whose name says "youth"
 * does not come before the youth services nearby - but "Kind Space", typed
 * from another city, still finds Kind Space.
 */
export function matchPlaces(
  rows: readonly PlaceRow[],
  query: string,
  weight?: (row: PlaceRow) => number
): PlaceRow[] {
  if (wordsOf(query).length === 0) return [...rows];

  const indexed = rows.map((row) => ({ row, place: indexOf(row) }));
  const vocabulary = new Set<string>();
  for (const { place } of indexed) {
    for (const word of place.name) vocabulary.add(word);
    for (const word of place.kinds) vocabulary.add(word);
    for (const word of place.text) vocabulary.add(word);
  }

  const terms = readQuery(query, vocabulary);
  if (terms.length === 0) return [...rows];
  // The search as one line, for a name that is it, starts with it or holds
  // it - in whole words, but for the one still being typed.
  const lineWords = terms.filter((term) => !term.soft || terms.length === 1).flatMap((term) => term.words);
  const line = lineWords.join(' ');
  const typingLast = terms[terms.length - 1]?.typing ?? false;
  const lineBonus = (name: string): number => {
    if (lineWords.length < 2) return 0;
    if (name === line) return 6;
    if (name.startsWith(`${line} `) || (typingLast && name.startsWith(line))) return 4;
    const spaced = ` ${name} `;
    if (spaced.includes(` ${line} `) || (typingLast && spaced.includes(` ${line}`))) return 3;
    return 0;
  };

  const found: { row: PlaceRow; score: number }[] = [];
  /** Rows that match every word but one: kept for a long search, or when nothing matches all. */
  const nearly: { row: PlaceRow; score: number }[] = [];
  for (const { row, place } of indexed) {
    let score = 0;
    let missing = 0;
    for (const term of terms) {
      const one = termScore(term, place);
      if (one === 0 && !term.soft) {
        missing += 1;
        if (missing > 1) break;
      }
      score += term.soft ? (one > 0 ? SOFT_SCORE : 0) : one;
    }
    if (missing > 1) continue;
    score += lineBonus(place.nameLine);
    if (weight) score *= weight(row);
    (missing === 0 ? found : nearly).push({ row, score });
  }

  const best = (a: { row: PlaceRow; score: number }, b: { row: PlaceRow; score: number }) =>
    b.score - a.score ||
    (a.row.distance ?? Infinity) - (b.row.distance ?? Infinity) ||
    a.row.venue.name.localeCompare(b.row.venue.name);
  found.sort(best);

  // One word too many is common, and usually a place's own city or a word
  // its description happens not to use: "ottawa senior pride" for the Senior
  // Pride Network. After everything that matches all of a search of three
  // words or more; for a shorter one only when nothing does, since "trans
  // clinic" missing a word would be every trans place and every clinic.
  // Only a strong near miss, though - about as good as the matches, and more
  // than a couple of words a description happens to use: "one among us" must
  // not bring every description that says "one" and "us".
  const required = terms.filter((term) => !term.soft).length;
  if (required >= 3 || (required === 2 && found.length === 0)) {
    const bar = Math.max(NEAR_MISS_MIN_SCORE, (found[0]?.score ?? 0) / 2);
    const kept = nearly.filter((entry) => entry.score >= bar).sort(best);
    return [...found, ...kept].map((entry) => entry.row);
  }
  return found.map((entry) => entry.row);
}
