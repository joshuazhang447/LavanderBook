/**
 * What the privacy settings say, kept in one place so every skin says the same
 * thing: Basic and Material in the account tab's PrivacyToggle boxes
 * (src/components/privacy-settings.tsx), Chenfeng on a page of its own per
 * setting (src/components/chenfeng/setting-pages.tsx). A skin changes how these
 * look, never what they say.
 *
 * Every explanation answers the same four questions, in the same order, so
 * that reading one teaches you how to read the other. Each says plainly what
 * the feature cannot do as well as what it does: someone relying on it for
 * their safety needs to know what can still identify them, and that
 * moderators can still see more than the public does. Overselling a privacy
 * control is how people get hurt by one.
 */

export type Explained = {
  lead: string;
  whyItMatters: string;
  whatItDoes: string;
  whatItCantHide: string;
  ifTurnedOff: string;
};

/** The four questions' headings, in sentence case and in Chenfeng's title case. */
export const EXPLANATION_HEADINGS = {
  sentence: {
    whyItMatters: 'Why it matters',
    whatItDoes: 'What it does',
    whatItCantHide: "What it can't hide",
    ifTurnedOff: 'If turned off',
  },
  title: {
    whyItMatters: 'Why It Matters',
    whatItDoes: 'What It Does',
    whatItCantHide: "What It Can't Hide",
    ifTurnedOff: 'If Turned Off',
  },
} as const;

export type ConfirmOff = { title: string; body: string; keep: string; confirm: string };

export const LOCATION_EXPLAINED: Explained = {
  lead: 'The map can follow you without LavenderBook learning exactly where you are.',
  whyItMatters:
    'Where you go says a lot about who you are. Your exact position stays on your phone and is only used to move the map.',
  whatItDoes:
    "The map follows you as you walk. To load nearby places, your phone sends only the rough block you're in, and never with your account attached.",
  whatItCantHide:
    'Google, which draws the map, sees the area the map is showing, like any map app. Your internet connection is still visible to us.',
  ifTurnedOff:
    "The map opens in a general area based on your phone's time zone, or a city you choose. Everything else works the same, including posting reviews.",
};

export function locationSummary(usingDevice: boolean, place: string | undefined): string {
  return usingDevice
    ? 'The map follows you as you move.'
    : `Map opens at ${place ?? 'a city you choose'}.`;
}

export const LOCATION_DENIED = "Location wasn't allowed. Try again, or keep using a place.";

export const LEAVE_NOW_EXPLAINED: Explained = {
  lead: 'One tap takes you off LavenderBook and onto an everyday website.',
  whyItMatters:
    'If someone comes near while LavenderBook is open, there may be no time to close it. In some places, being seen using it is dangerous.',
  whatItDoes:
    "Signs you out, clears LavenderBook's data from this browser and swaps the page for an everyday website in your language. On a computer, pressing Shift 3 times does the same.",
  whatItCantHide:
    "Your browser's history still shows the visit. Delete it in your browser's settings, or use a private window.",
  ifTurnedOff:
    'The button disappears from every screen. On a computer, pressing Shift 3 times still leaves.',
};

export function leaveNowSummary(on: boolean): string {
  return on
    ? 'A button on every screen that leaves the site at once.'
    : 'Hidden. On a computer, Shift 3 times still leaves.';
}

export const LEAVE_NOW_OFF_WARNING = "Off: there's no one-tap way out if someone comes near.";

export function namesSummary(on: boolean, name: string): string {
  return on ? 'Each review gets its own random name.' : `New reviews show ${name}.`;
}

export const NAMES_OFF_WARNING =
  'Off: reviews you post now all share one name, so they can be linked to each other.';

export function namesExplained(name: string): Explained {
  return {
    lead: "Each review you post gets its own name, so your reviews can't be linked together.",
    whyItMatters:
      "If all your reviews share one name, anyone can see every place you've been. A few places can be enough to work out who you are.",
    whatItDoes: `Each review shows a new random name instead of ${name}. Editing a review keeps its name.`,
    whatItCantHide:
      'What you write, and when, can still give you away, so leave out personal details. Moderators can still see which account posted a review.',
    ifTurnedOff: `New reviews will show ${name}. Reviews you've already posted keep their own names.`,
  };
}

export function namesConfirmOff(name: string): ConfirmOff {
  return {
    title: 'Turn off per-place names?',
    body: `Reviews you post from now on will all show ${name}, so anyone can tell they came from the same person. Reviews you have already posted keep their own names.`,
    keep: 'Keep them on',
    confirm: 'Turn off',
  };
}

export function datesSummary(on: boolean): string {
  return on
    ? 'Reviews show a rough time, like "a few weeks ago".'
    : 'New reviews show the day you post them.';
}

export const DATES_OFF_WARNING =
  'Off: the day you post can be matched against other records of who was there.';

export const DATES_EXPLAINED: Explained = {
  lead: 'Your reviews show roughly when you posted them, never the exact day.',
  whyItMatters:
    'Apps, advertisers and phone companies keep records of where phones were and when. The exact day of a review can be matched against them to work out who was there.',
  whatItDoes:
    'Readers see a rough time, like "a few weeks ago", instead of the date, and never the time of day. Each review keeps the setting it was posted with.',
  whatItCantHide:
    "Anyone watching closely can still notice when a new review appears, so it's safer to post after you've left. Moderators can still see exact times.",
  ifTurnedOff:
    "New reviews will show the day you post them. Reviews you've already posted keep showing a rough time.",
};

export const DATES_CONFIRM_OFF: ConfirmOff = {
  title: 'Show dates on new reviews?',
  body: "Reviews you post from now on will show the day you posted them, and that day can be matched against other records of who was there. Reviews you've already posted keep showing a rough time.",
  keep: 'Keep them hidden',
  confirm: 'Show dates',
};

/** The account name line, before and after the profile arrives. */
export function accountNameNote(perPlaceNames: boolean | null): string {
  return perPlaceNames === null
    ? 'Your account name. Your email is never public.'
    : perPlaceNames
      ? 'Your account name. Your reviews never show it: each one has its own. Your email is never public.'
      : 'Your account name, shown on reviews you post from now on. Your email is never public.';
}

/** Why to sign in, said where someone is asked to. */
export const SIGN_IN_PITCH =
  'An account lets you post reviews. You are given an anonymous name, and each review gets a name of its own, so nothing you write is tied to your real identity, or to your other reviews, in public.';
