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

/** "Shown as Amber Finch": the name readers see on one of your reviews. */
export function shownAs(alias: string | null): string {
  return alias ? `Shown as ${alias}` : 'Shown under your account name';
}
