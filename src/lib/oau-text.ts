/**
 * Words OAU's layout needs that no other skin says (LavenderBookStyle,
 * implementation plan section 3). Everything a reader is told about a setting,
 * a review or a place stays in the shared files - privacy-text.ts,
 * moderation-text.ts, directory-text.ts - so it reads the same in every skin.
 */

export const OAU_ACCOUNT_TEXT = {
  title: 'My Account',
  signedInWith: 'Signed in with Google',
  loadingName: 'Loading name…',
  welcome: 'Sign in to write reviews',
  privacy: 'Your privacy',
  /** Under "Your privacy": the switches open their explanations. */
  privacyLine: 'Tap a setting to read what it does and what it cannot hide.',
  look: 'Look',
  lookLine: 'How buttons, switches and the tab bar look on this device.',
  reviews: 'Your reviews',
  noReviews: 'No reviews yet',
  noReviewsLine: 'Tap a place on the map to write the first one.',
  more: 'More',
  safetyNotice: 'Read the safety notice again',
  privacyPolicy: 'Privacy policy',
  signOut: 'Sign out',
  signingIn: 'Opening Google…',
  continueWithGoogle: 'Continue with Google',
  /** The default skin's tag on the Appearance cards. */
  default: 'Default',
  chosen: (label: string) => `${label}, chosen`,
} as const;

/** OAU's review form. The questions and hints are the shared ones (review-form.ts). */
export const OAU_REVIEW_TEXT = {
  newTitle: 'Your review',
  editTitle: 'Edit your review',
  rating: 'How LGBTQ+ friendly is this place?',
  ratingHint: '1 is hostile, 5 is actively welcoming',
  bathroom: 'Is there a bathroom trans people can use safely?',
  bathroomHint: 'Pick "Not sure" if you did not check - a guess helps nobody.',
  body: 'What happened?',
  optional: '(optional)',
  bodyPlaceholder: 'Anything worth knowing before someone else walks in.',
  bodyWarning: 'Leave out names, dates, times and anything that could identify you.',
  whatToLeaveOut: 'What to leave out',
  post: 'Post review',
  save: 'Save changes',
  saving: 'Saving…',
  delete: 'Delete review',
  deleteMessage: "This review will be removed from LavenderBook. This can't be undone.",
  failed: (existing: boolean) => (existing ? "Couldn't save the review" : "Couldn't post the review"),
  signIn: 'Sign in to write a review',
} as const;

/** More details, inside OAU's place card. */
export const OAU_DETAILS_TEXT = {
  back: 'Back',
  checked: 'What LavenderBook checked',
  reported: 'What visitors reported',
  /** Coverage, so "7 of 9 said yes" is read against how many answered at all. */
  reportedLine: (answered: number, total: number) =>
    `Answers from ${answered} of ${total} ${total === 1 ? 'review' : 'reviews'}. Visitors' own accounts, not checked by LavenderBook.`,
  noLongerAsked: 'No longer asked here',
} as const;

/** "Shown as Amber Finch": the name readers see on one of your reviews. */
export function shownAs(alias: string | null): string {
  return alias ? `Shown as ${alias}` : 'Shown under your account name';
}
