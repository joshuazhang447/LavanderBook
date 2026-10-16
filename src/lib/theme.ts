import { DarkTheme, DefaultTheme, type Theme } from 'expo-router/react-navigation';

import type { Skin } from '@/lib/skin';

/** Basic: the values in src/global.css, as colour strings. */
export const THEME = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(0 0% 3.9%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(0 0% 3.9%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(0 0% 3.9%)',
    primary: 'hsl(0 0% 9%)',
    primaryForeground: 'hsl(0 0% 98%)',
    secondary: 'hsl(0 0% 96.1%)',
    secondaryForeground: 'hsl(0 0% 9%)',
    muted: 'hsl(0 0% 96.1%)',
    mutedForeground: 'hsl(0 0% 45.1%)',
    accent: 'hsl(0 0% 96.1%)',
    accentForeground: 'hsl(0 0% 9%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    border: 'hsl(0 0% 89.8%)',
    input: 'hsl(0 0% 89.8%)',
    ring: 'hsl(0 0% 63%)',
    radius: '0.625rem',
    chart1: 'hsl(12 76% 61%)',
    chart2: 'hsl(173 58% 39%)',
    chart3: 'hsl(197 37% 24%)',
    chart4: 'hsl(43 74% 66%)',
    chart5: 'hsl(27 87% 67%)',
  },
  dark: {
    background: 'hsl(0 0% 3.9%)',
    foreground: 'hsl(0 0% 98%)',
    card: 'hsl(0 0% 3.9%)',
    cardForeground: 'hsl(0 0% 98%)',
    popover: 'hsl(0 0% 3.9%)',
    popoverForeground: 'hsl(0 0% 98%)',
    primary: 'hsl(0 0% 98%)',
    primaryForeground: 'hsl(0 0% 9%)',
    secondary: 'hsl(0 0% 14.9%)',
    secondaryForeground: 'hsl(0 0% 98%)',
    muted: 'hsl(0 0% 14.9%)',
    mutedForeground: 'hsl(0 0% 63.9%)',
    accent: 'hsl(0 0% 14.9%)',
    accentForeground: 'hsl(0 0% 98%)',
    destructive: 'hsl(0 70.9% 59.4%)',
    border: 'hsl(0 0% 14.9%)',
    input: 'hsl(0 0% 14.9%)',
    ring: 'hsl(300 0% 45%)',
    radius: '0.625rem',
    chart1: 'hsl(220 70% 50%)',
    chart2: 'hsl(160 60% 45%)',
    chart3: 'hsl(30 80% 55%)',
    chart4: 'hsl(280 65% 60%)',
    chart5: 'hsl(340 75% 55%)',
  },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};


/**
 * The variables in src/global.css that change with the skin, as the bare
 * "H S% L%" the stylesheet uses. --admin and the charts are the same in every
 * skin, so they are not here.
 *
 * The second group came with Chenfeng, which needs colours the shadcn set has
 * no names for: the grouped page behind settings-like screens, the label
 * hierarchy, hairline separators and the translucent control fills. Basic and
 * Material map them onto colours they already have (global.css and below), so
 * a component can use them without asking which skin it is in.
 *
 * The third group is Material's roles that neither set has
 * (docs/material-design-guideline.md, section 4.3). Only Material defines
 * them; every other skin gets them filled in from colours it already has
 * (roleFallbacks), so nothing it draws changes and its palette needs no edit.
 */
export type SkinColor =
  | 'background'
  | 'foreground'
  | 'card'
  | 'card-foreground'
  | 'popover'
  | 'popover-foreground'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'border'
  | 'input'
  | 'ring'
  | 'switch-on'
  | ExtraColor
  | MaterialRole;

type MaterialRole =
  | 'primary-container'
  | 'on-primary-container'
  | 'tertiary'
  | 'tertiary-container'
  | 'on-tertiary-container'
  | 'error-container'
  | 'on-error-container'
  | 'surface-container-lowest'
  | 'inverse-surface'
  | 'inverse-on-surface'
  | 'inverse-primary'
  /** Material's secondary role. Our `secondary` is its secondary container. */
  | 'm3-secondary';

type ExtraColor =
  | 'star'
  | 'segment-thumb'
  | 'system-purple'
  | 'system-indigo'
  | 'system-gray'
  | 'grouped'
  | 'label-secondary'
  | 'label-tertiary'
  | 'separator'
  | 'fill'
  | 'fill-secondary'
  | 'fill-tertiary'
  | 'fill-quaternary'
  | 'tint-fill';

/**
 * The colours that may be translucent. Each has a second variable for its
 * alpha, --x-a, and tailwind.config.js writes them as
 * hsl(var(--x) / var(--x-a)). The alpha lives outside --x so that --x stays the
 * bare "H S% L%" every other token is. These never take an opacity modifier
 * (bg-separator/50): the alpha is already spoken for.
 */
export const TRANSLUCENT_COLORS: readonly SkinColor[] = [
  'label-secondary',
  'label-tertiary',
  'separator',
  'fill',
  'fill-secondary',
  'fill-tertiary',
  'fill-quaternary',
  'tint-fill',
];

/** "H S% L%", or "H S% L% / A" for a translucent colour. */
type SkinPalette = Record<SkinColor, string>;

/** A skin's own palette: Material's roles optional, filled in by roleFallbacks. */
type TokenPalette = Omit<SkinPalette, MaterialRole> & Partial<Pick<SkinPalette, MaterialRole>>;

export type SkinTokens = {
  /** --radius in px: rounded-lg; md, sm and xl are worked out from it. */
  radius: number;
  light: TokenPalette;
  dark: TokenPalette;
  /**
   * Dark mode inside anything presented above the app - a sheet, a menu. iOS
   * draws those on lighter backgrounds so they read as nearer. Light mode is
   * unchanged.
   */
  elevated?: Partial<SkinPalette>;
  /**
   * What changes under the device's Increase Contrast (iOS), high contrast
   * text (Android) or prefers-contrast: more (the web).
   */
  contrast?: {
    light: Partial<SkinPalette>;
    dark: Partial<SkinPalette>;
    /** Dark, inside a sheet, with contrast raised. */
    elevated?: Partial<SkinPalette>;
  };
};

type CorePalette = Omit<SkinPalette, ExtraColor | MaterialRole>;

/**
 * Material's roles, for a skin without them: each on a colour of the same job
 * it already has. Nothing outside Material reads them; they exist so a class
 * resolves to something sensible in every skin. global.css repeats Basic's.
 */
function roleFallbacks(palette: TokenPalette): Pick<SkinPalette, MaterialRole> {
  return {
    'primary-container': palette.secondary,
    'on-primary-container': palette['secondary-foreground'],
    tertiary: palette.primary,
    'tertiary-container': palette.secondary,
    'on-tertiary-container': palette['secondary-foreground'],
    'error-container': palette.muted,
    'on-error-container': palette.destructive,
    'surface-container-lowest': palette.background,
    'inverse-surface': palette.foreground,
    'inverse-on-surface': palette.background,
    'inverse-primary': palette['primary-foreground'],
    'm3-secondary': palette['muted-foreground'],
  };
}

/** Material's own values for its roles (PaletteTokens, baseline scheme). */
const MATERIAL_ROLES_LIGHT: Pick<SkinPalette, MaterialRole> = {
  'primary-container': '262.9 100% 93.3%', // #EADDFF
  // Tone 30, not Compose's 10: the guideline's section 4.2 note.
  'on-primary-container': '257.1 43.3% 38%', // #4F378B
  tertiary: '340.5 20.8% 40.6%', // #7D5260
  'tertiary-container': '341.5 100% 92.4%', // #FFD8E4
  'on-tertiary-container': '340.5 25.3% 31%', // #633B48
  'error-container': '4.1 70.7% 92%', // #F9DEDC
  'on-error-container': '2.6 70.7% 32.2%', // #8C1D18
  'surface-container-lowest': '0 0% 100%', // #FFFFFF
  'inverse-surface': '270 6% 19.6%', // #322F35
  'inverse-on-surface': '285 33.3% 95.3%', // #F5EFF7
  'inverse-primary': '257.9 100% 86.9%', // #D0BCFF
  'm3-secondary': '259.1 10.8% 40%', // #625B71
};

const MATERIAL_ROLES_DARK: Pick<SkinPalette, MaterialRole> = {
  'primary-container': '257.1 43.3% 38%', // #4F378B
  'on-primary-container': '262.9 100% 93.3%', // #EADDFF
  tertiary: '342.5 63.2% 82.9%', // #EFB8C8
  'tertiary-container': '340.5 25.3% 31%', // #633B48
  'on-tertiary-container': '341.5 100% 92.4%', // #FFD8E4
  'error-container': '2.6 70.7% 32.2%', // #8C1D18
  'on-error-container': '4.1 70.7% 92%', // #F9DEDC
  'surface-container-lowest': '260 18.8% 6.3%', // #0F0D13
  'inverse-surface': '280 17% 89.6%', // #E6E0E9
  'inverse-on-surface': '270 6% 19.6%', // #322F35
  'inverse-primary': '256.4 34.4% 47.8%', // #6750A4
  'm3-secondary': '263.1 27.1% 81.2%', // #CCC2DC
};

/**
 * The second group, for a skin with no colours of its own for them: the page
 * for the grouped page, the muted foreground for secondary labels, the border
 * for separators, muted for the fills. Nothing translucent, so nothing looks
 * different from before they existed.
 */
function plainExtras(palette: CorePalette, star: string): Pick<SkinPalette, ExtraColor> {
  return {
    star,
    'segment-thumb': palette.background,
    'system-purple': palette.primary,
    'system-indigo': palette.primary,
    'system-gray': palette['muted-foreground'],
    grouped: palette.background,
    'label-secondary': palette['muted-foreground'],
    'label-tertiary': palette['muted-foreground'],
    separator: palette.border,
    fill: palette.muted,
    'fill-secondary': palette.muted,
    'fill-tertiary': palette.muted,
    'fill-quaternary': palette.muted,
    'tint-fill': palette.secondary,
  };
}

const BASIC_LIGHT: CorePalette = {
  background: '0 0% 100%',
  foreground: '0 0% 3.9%',
  card: '0 0% 100%',
  'card-foreground': '0 0% 3.9%',
  popover: '0 0% 100%',
  'popover-foreground': '0 0% 3.9%',
  primary: '0 0% 9%',
  'primary-foreground': '0 0% 98%',
  secondary: '0 0% 96.1%',
  'secondary-foreground': '0 0% 9%',
  muted: '0 0% 96.1%',
  'muted-foreground': '0 0% 45.1%',
  accent: '0 0% 96.1%',
  'accent-foreground': '0 0% 9%',
  destructive: '0 84.2% 60.2%',
  'destructive-foreground': '0 0% 98%',
  border: '0 0% 89.8%',
  input: '0 0% 89.8%',
  ring: '0 0% 63%',
  'switch-on': '0 0% 9%',
};

const BASIC_DARK: CorePalette = {
  background: '0 0% 3.9%',
  foreground: '0 0% 98%',
  card: '0 0% 3.9%',
  'card-foreground': '0 0% 98%',
  popover: '0 0% 3.9%',
  'popover-foreground': '0 0% 98%',
  primary: '0 0% 98%',
  'primary-foreground': '0 0% 9%',
  secondary: '0 0% 14.9%',
  'secondary-foreground': '0 0% 98%',
  muted: '0 0% 14.9%',
  'muted-foreground': '0 0% 63.9%',
  accent: '0 0% 14.9%',
  'accent-foreground': '0 0% 98%',
  destructive: '0 70.9% 59.4%',
  'destructive-foreground': '0 0% 98%',
  border: '0 0% 14.9%',
  input: '0 0% 14.9%',
  ring: '300 0% 45%',
  'switch-on': '0 0% 98%',
};

/** global.css's --star, which Basic and Material share. */
const STAR_LIGHT = '38 92% 50%';
const STAR_DARK = '38 95% 58%';

const MATERIAL_LIGHT: CorePalette = {
  background: '292.5 100% 98.4%', // #FEF7FF surface
  foreground: '264 8.5% 11.6%', // #1D1B20 on surface
  card: '277.5 44.4% 96.5%', // #F7F2FA surface container low
  'card-foreground': '264 8.5% 11.6%',
  popover: '276 38.5% 94.9%', // #F3EDF7 surface container
  'popover-foreground': '264 8.5% 11.6%',
  primary: '256.4 34.4% 47.8%', // #6750A4
  'primary-foreground': '0 0% 100%',
  secondary: '263.1 65% 92.2%', // #E8DEF8 secondary container
  'secondary-foreground': '258 12.8% 30.6%', // #4A4458
  muted: '280 17% 89.6%', // #E6E0E9 surface container highest
  'muted-foreground': '264 6.8% 29%', // #49454F on surface variant
  accent: '276 25% 92.2%', // #ECE6F0 surface container high
  'accent-foreground': '264 8.5% 11.6%',
  destructive: '3.2 71.3% 41%', // #B3261E error
  'destructive-foreground': '0 0% 100%',
  border: '270 11.3% 79.2%', // #CAC4D0 outline variant
  input: '270 4.1% 47.5%', // #79747E outline
  ring: '256.4 34.4% 47.8%',
  'switch-on': '256.4 34.4% 47.8%',
};

const MATERIAL_DARK: CorePalette = {
  background: '260 14.3% 8.2%', // #141218
  foreground: '280 17% 89.6%', // #E6E0E9
  card: '264 8.5% 11.6%', // #1D1B20
  'card-foreground': '280 17% 89.6%',
  popover: '257.1 10.1% 13.5%', // #211F26
  'popover-foreground': '280 17% 89.6%',
  primary: '257.9 100% 86.9%', // #D0BCFF
  'primary-foreground': '258.6 58.3% 28.2%', // #381E72
  secondary: '258 12.8% 30.6%', // #4A4458
  'secondary-foreground': '263.1 65% 92.2%', // #E8DEF8
  muted: '257.1 6.3% 21.8%', // #36343B
  'muted-foreground': '270 11.3% 79.2%', // #CAC4D0
  accent: '257.1 7.9% 17.5%', // #2B2930
  'accent-foreground': '280 17% 89.6%',
  destructive: '2.8 71.3% 52.2%', // #DC362E
  'destructive-foreground': '0 0% 100%',
  border: '264 6.8% 29%', // #49454F
  input: '264 4.7% 58%', // #938F99
  ring: '257.9 100% 86.9%',
  'switch-on': '257.9 100% 86.9%',
};

/**
 * Every skin's values for those variables.
 *
 * Basic repeats src/global.css exactly - the stylesheet is what draws it, and
 * this copy is only for what has to put Basic back inside another skin (the
 * safety notice on the website). Change one, change the other.
 *
 * Material is the Material 3 baseline scheme, the purple one, which suits a
 * lavender app. Roles map onto these names as: surface -> background,
 * surface container low -> card, surface container -> popover, secondary
 * container -> secondary, surface container highest -> muted, on surface
 * variant -> muted-foreground, outline variant -> border, outline -> input.
 * Its dark error is a deeper red than Material's own, because existing code
 * puts white text on bg-destructive.
 *
 * Chenfeng is the iOS 26 system palette - the year iOS recoloured every system
 * colour, kept by iOS 27 - with each token on the iOS colour that does its job
 * (docs/chenfeng-design-guideline.md, section 4): systemBackground for the
 * page, secondarySystemGroupedBackground for a card (a section on a grouped
 * page), system blue as the tint, the label hierarchy as UIKit resolves it.
 * Muted and muted-foreground are opaque stand-ins for a fill and a secondary
 * label, for whatever cannot take alpha. The glass is not here: it is drawn by
 * the components that float (src/components/glass.tsx).
 */
export const SKIN_TOKENS: Record<Skin, SkinTokens> = {
  basic: {
    radius: 10,
    light: { ...BASIC_LIGHT, ...plainExtras(BASIC_LIGHT, STAR_LIGHT) },
    dark: { ...BASIC_DARK, ...plainExtras(BASIC_DARK, STAR_DARK) },
  },
  material: {
    radius: 12,
    light: {
      ...MATERIAL_LIGHT,
      ...plainExtras(MATERIAL_LIGHT, STAR_LIGHT),
      ...MATERIAL_ROLES_LIGHT,
    },
    dark: { ...MATERIAL_DARK, ...plainExtras(MATERIAL_DARK, STAR_DARK), ...MATERIAL_ROLES_DARK },
  },
  chenfeng: {
    // Means little here: iOS has no one radius. What still reads it - a stray
    // dialog, a card - gets something that looks at home.
    radius: 20,
    light: {
      background: '0 0% 100%', // systemBackground
      foreground: '0 0% 0%', // label
      card: '0 0% 100%', // secondarySystemGroupedBackground
      'card-foreground': '0 0% 0%',
      popover: '0 0% 100%',
      'popover-foreground': '0 0% 0%',
      primary: '208 100% 50%', // #0088FF systemBlue, the tint
      'primary-foreground': '0 0% 100%',
      secondary: '208.4 100% 92.5%', // #D9EDFF the tint at 15% on white
      'secondary-foreground': '208 100% 50%',
      muted: '240 10.6% 90.8%', // #E5E5EA systemGray5
      'muted-foreground': '240 1.7% 54.9%', // #8A8A8E secondaryLabel, flattened
      accent: '240 5.7% 82.9%', // #D1D1D6 systemGray4: a pressed row
      'accent-foreground': '0 0% 0%',
      destructive: '358.8 100% 61%', // #FF383C systemRed
      'destructive-foreground': '0 0% 100%',
      border: '240 1.8% 78%', // #C6C6C8 opaqueSeparator
      input: '240 4.7% 79%', // #C7C7CC systemGray3
      ring: '208 100% 50%',
      'switch-on': '135.1 58.6% 49.2%', // #34C759 systemGreen
      star: '28.2 100% 57.8%', // #FF8D28 systemOrange
      'segment-thumb': '0 0% 100%', // a segmented control's thumb
      'system-purple': '292.8 73.9% 53.3%', // #CB30E0, settings tiles
      'system-indigo': '244.5 88.9% 64.7%', // #6155F5
      'system-gray': '240 2.3% 56.7%', // #8E8E93
      grouped: '240 23.8% 95.9%', // #F2F2F7 systemGroupedBackground
      'label-secondary': '240 5.5% 24.9% / 0.6', // #3C3C43 at 60%
      'label-tertiary': '240 5.5% 24.9% / 0.3',
      separator: '240 5.5% 24.9% / 0.29',
      fill: '240 3.2% 48.6% / 0.2', // #787880 systemFill
      'fill-secondary': '240 3.2% 48.6% / 0.16',
      'fill-tertiary': '240 4.1% 48.2% / 0.12', // #767680
      'fill-quaternary': '240 4.9% 47.8% / 0.08', // #747480
      'tint-fill': '208 100% 50% / 0.15',
    },
    dark: {
      background: '0 0% 0%',
      foreground: '0 0% 100%',
      card: '240 3.4% 11.4%', // #1C1C1E
      'card-foreground': '0 0% 100%',
      popover: '240 3.4% 11.4%',
      'popover-foreground': '0 0% 100%',
      primary: '205.9 100% 50%', // #0091FF
      'primary-foreground': '0 0% 100%',
      secondary: '207 45.5% 17.3%', // #182E40
      'secondary-foreground': '205.9 100% 50%',
      muted: '240 2.2% 17.6%', // #2C2C2E systemGray5
      'muted-foreground': '240 3.5% 61%', // #98989F
      accent: '240 1.7% 23.1%', // #3A3A3C systemGray4
      'accent-foreground': '0 0% 100%',
      destructive: '359 100% 62.9%', // #FF4245
      'destructive-foreground': '0 0% 100%',
      border: '240 1.8% 22.4%', // #38383A
      input: '240 1.4% 28.6%', // #48484A
      ring: '205.9 100% 50%',
      'switch-on': '134.9 63.6% 50.4%', // #30D158
      star: '28.4 100% 59.4%', // #FF9230
      'segment-thumb': '240 1.5% 39.4%', // #636366 systemGray2
      'system-purple': '292.7 88% 57.6%', // #DB34F2
      'system-indigo': '233.8 100% 71.4%', // #6D7CFF
      'system-gray': '240 2.3% 56.7%',
      grouped: '0 0% 0%',
      'label-secondary': '240 33.3% 94.1% / 0.6', // #EBEBF5 at 60%
      'label-tertiary': '240 33.3% 94.1% / 0.3',
      separator: '240 2.3% 33.7% / 0.6', // #545458 at 60%
      fill: '240 3.2% 48.6% / 0.36',
      'fill-secondary': '240 3.2% 48.6% / 0.32',
      'fill-tertiary': '240 4.1% 48.2% / 0.24',
      'fill-quaternary': '240 4.1% 48.2% / 0.18',
      'tint-fill': '205.9 100% 50% / 0.15',
    },
    elevated: {
      background: '240 3.4% 11.4%', // #1C1C1E
      grouped: '240 3.4% 11.4%',
      card: '240 2.2% 17.6%', // #2C2C2E
      popover: '240 2.2% 17.6%',
      muted: '240 1.7% 23.1%', // #3A3A3C
      // A step up again, or a pressed row would vanish into its section.
      accent: '240 1.4% 28.6%', // #48484A
    },
    contrast: {
      light: {
        primary: '217.6 90.7% 53.7%', // #1E6EF4
        'secondary-foreground': '217.6 90.7% 53.7%',
        ring: '217.6 90.7% 53.7%',
        'tint-fill': '217.6 90.7% 53.7% / 0.15',
        destructive: '353.2 83.5% 49.8%', // #E9152D
        'switch-on': '141.9 100% 26.9%', // #008932
        star: '25.3 100% 38.6%', // #C55300
        'muted-foreground': '240 1.8% 43.1%', // #6C6C70
        grouped: '240 14.3% 93.1%', // #EBEBF0
        'label-secondary': '240 5.5% 24.9% / 0.68',
        'label-tertiary': '240 5.5% 24.9% / 0.38',
        separator: '240 5.5% 24.9% / 0.37',
        fill: '240 3.2% 48.6% / 0.28',
        'fill-secondary': '240 3.2% 48.6% / 0.24',
        'fill-tertiary': '240 4.1% 48.2% / 0.2',
        'fill-quaternary': '240 4.9% 47.8% / 0.16',
      },
      dark: {
        primary: '206.1 100% 68%', // #5CB8FF
        'secondary-foreground': '206.1 100% 68%',
        ring: '206.1 100% 68%',
        'tint-fill': '206.1 100% 68% / 0.15',
        destructive: '358.5 100% 69%', // #FF6165
        'switch-on': '132.6 65.3% 57.1%', // #4AD968
        star: '26.3 100% 66.9%', // #FFA056
        'muted-foreground': '240 2.5% 69%', // #AEAEB2
        card: '240 2.7% 14.5%', // #242426
        popover: '240 2.7% 14.5%',
        'label-secondary': '240 33.3% 94.1% / 0.68',
        'label-tertiary': '240 33.3% 94.1% / 0.38',
        separator: '240 2.3% 33.7% / 0.68',
        fill: '240 3.2% 48.6% / 0.44',
        'fill-secondary': '240 3.2% 48.6% / 0.4',
        'fill-tertiary': '240 4.1% 48.2% / 0.32',
        'fill-quaternary': '240 4.1% 48.2% / 0.26',
      },
      elevated: {
        background: '240 2.7% 14.5%', // #242426
        grouped: '240 2.7% 14.5%',
        card: '240 1.8% 21.6%', // #363638
        popover: '240 1.8% 21.6%',
      },
    },
  },
};

/** The colour and the alpha of one palette value. */
export function splitColor(value: string): { color: string; alpha: string } {
  const [color, alpha] = value.split('/').map((part) => part.trim());
  return { color, alpha: alpha ?? '1' };
}

/**
 * A palette as CSS variables: --x for each colour, and --x-a beside each one
 * that may be translucent. What both skin providers set.
 */
export function paletteVariables(palette: Partial<SkinPalette>): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [name, value] of Object.entries(palette) as [SkinColor, string][]) {
    const { color, alpha } = splitColor(value);
    variables[`--${name}`] = color;
    if (TRANSLUCENT_COLORS.includes(name)) variables[`--${name}-a`] = alpha;
  }
  return variables;
}

export type SkinVariant = {
  scheme: 'light' | 'dark';
  /** Inside a sheet or a menu: dark mode's lighter surfaces. */
  elevated?: boolean;
  /** The device asks for more contrast. */
  contrast?: boolean;
};

/** A skin's whole palette for one appearance, its overrides applied. */
export function skinPalette(skin: Skin, { scheme, elevated, contrast }: SkinVariant): SkinPalette {
  const tokens = SKIN_TOKENS[skin];
  const dark = scheme === 'dark';
  const palette: TokenPalette = {
    ...tokens[scheme],
    ...(elevated && dark ? tokens.elevated : null),
    ...(contrast ? tokens.contrast?.[scheme] : null),
    ...(elevated && dark && contrast ? tokens.contrast?.elevated : null),
  };
  return { ...roleFallbacks(palette), ...palette };
}

/** A skin's colour as a string, for the APIs that take one rather than a class. */
export function skinColor(
  skin: Skin,
  scheme: 'light' | 'dark',
  color: SkinColor,
  alpha?: number,
  variant?: Omit<SkinVariant, 'scheme'>
): string {
  const { color: hsl, alpha: own } = splitColor(skinPalette(skin, { scheme, ...variant })[color]);
  const [h, s, l] = hsl.split(' ');
  const a = alpha ?? Number(own);
  return a === 1 ? `hsl(${h}, ${s}, ${l})` : `hsla(${h}, ${s}, ${l}, ${a})`;
}

function navTheme(skin: Skin, scheme: 'light' | 'dark'): Theme {
  return {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      background: skinColor(skin, scheme, 'background'),
      border: skinColor(skin, scheme, 'border'),
      card: skinColor(skin, scheme, 'card'),
      notification: skinColor(skin, scheme, 'destructive'),
      primary: skinColor(skin, scheme, 'primary'),
      text: skinColor(skin, scheme, 'foreground'),
    },
  };
}

/** NAV_THEME per skin. Basic's is NAV_THEME itself. */
export const SKIN_NAV_THEME: Record<Skin, Record<'light' | 'dark', Theme>> = {
  basic: NAV_THEME,
  material: { light: navTheme('material', 'light'), dark: navTheme('material', 'dark') },
  chenfeng: { light: navTheme('chenfeng', 'light'), dark: navTheme('chenfeng', 'dark') },
};
