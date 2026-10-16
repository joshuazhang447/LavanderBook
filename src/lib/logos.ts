import type { ImageSourcePropType } from 'react-native';

/**
 * A logo as files drawn at the exact size of each screen density, by
 * scripts/generate-logos.mjs, smallest first. `LogoImage` picks one.
 */
export type Logo = {
  /** In points. */
  width: number;
  height: number;
  files: readonly { scale: number; source: ImageSourcePropType }[];
};

/** The app icon's book, drawn from favicon.svg. */
export const BOOK_MARK: Logo = {
  width: 20,
  height: 24,
  files: [
    { scale: 1, source: require('@/assets/images/book-mark-24.png') },
    { scale: 1.5, source: require('@/assets/images/book-mark-36.png') },
    { scale: 2, source: require('@/assets/images/book-mark-48.png') },
    { scale: 3, source: require('@/assets/images/book-mark-72.png') },
  ],
};

/** OAU's maple leaves, outlined heavier at the smaller sizes so they stay crisp. */
export const OAU_LEAVES: Logo = {
  width: 23,
  height: 24,
  files: [
    { scale: 1, source: require('@/assets/images/oau-logo-24.png') },
    { scale: 1.5, source: require('@/assets/images/oau-logo-36.png') },
    { scale: 2, source: require('@/assets/images/oau-logo-48.png') },
    { scale: 3, source: require('@/assets/images/oau-logo-72.png') },
  ],
};
