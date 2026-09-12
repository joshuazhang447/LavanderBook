/**
 * Turning a tag's one stored colour into the four a chip actually needs.
 *
 * A chip has a background and a text colour, in light mode and in dark - and
 * asking an admin for four is both tedious and a reliable way to produce
 * something illegible. So they choose one, and this works out the rest.
 *
 * The important part is that the text lightness is SOLVED FOR rather than fixed.
 * Perceived lightness varies enormously by hue: yellow at 32% lightness and blue
 * at 32% lightness are nowhere near equally bright, so any single value passes
 * contrast for some hues and fails badly for others. Walking the lightness until
 * the WCAG ratio clears means an admin cannot pick an unreadable chip by
 * accident, whatever hue they land on.
 */

/** WCAG AA for normal text. Chip labels are 12px, so this is the bar that applies. */
export const CONTRAST_TARGET = 4.5;

/** The ten seeded tag colours, offered as one-click swatches. */
export const TAG_COLOR_PRESETS = [
  '#F0530F', // orange
  '#F0B80F', // amber
  '#92F00F', // lime
  '#0FF080', // green
  '#0FE8F0', // teal
  '#0F92F0', // sky
  '#0F22F0', // indigo
  '#6D0FF0', // violet
  '#DD0FF0', // purple
  '#F00F92', // pink
] as const;

const FALLBACK = '#71717A';

type Rgb = [number, number, number];
type Hsl = { h: number; s: number; l: number };

export function isValidHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function hexToRgb(hex: string): Rgb {
  const clean = hex.trim().replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl([r, g, b]: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === red) h = ((green - blue) / delta) % 6;
  else if (max === green) h = (blue - red) / delta + 2;
  else h = (red - green) / delta + 4;

  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;

  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];

  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** WCAG relative luminance. The 0.03928 kink and the 2.4 exponent are from the spec. */
function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Contrast between two hex colours, for the readout in the editor. */
export function contrastRatio(a: string, b: string): number {
  if (!isValidHex(a) || !isValidHex(b)) return 0;
  return ratio(hexToRgb(a), hexToRgb(b));
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Walks lightness one step at a time until the text clears CONTRAST_TARGET
 * against its background.
 *
 * Returns the best it managed if nothing clears - which only happens for a
 * background that is already mid-grey, where no same-hue text can reach 4.5:1.
 * Returning the best attempt rather than throwing keeps a bad colour rendering
 * as a merely poor chip rather than a crash, and the editor shows the ratio so
 * the person choosing can see the problem.
 */
function solveLightness(h: number, s: number, background: Rgb, from: number, to: number): string {
  const step = from < to ? 1 : -1;
  let best = from;
  let bestRatio = 0;

  for (let l = from; step > 0 ? l <= to : l >= to; l += step) {
    const candidate = hslToRgb({ h, s, l });
    const contrast = ratio(candidate, background);
    if (contrast >= CONTRAST_TARGET) return rgbToHex(candidate);
    if (contrast > bestRatio) {
      bestRatio = contrast;
      best = l;
    }
  }

  return rgbToHex(hslToRgb({ h, s, l: best }));
}

export type ChipColors = {
  background: string;
  foreground: string;
  /** Measured, so the editor can show it rather than promise it. */
  contrast: number;
};

export type TagColors = {
  light: ChipColors;
  dark: ChipColors;
  /** True when the two colours were taken literally rather than derived. */
  manual: boolean;
};

/**
 * The chip's colours in both themes.
 *
 * Two modes, because they answer two different intentions:
 *
 *   Automatic (textColor null) - the stored colour is a HUE, rendered as a pale
 *   tint in light mode and a deep one in dark, with text solved for contrast in
 *   each. "Make this look right."
 *
 *   Manual (textColor set) - the two colours are used exactly as given, the same
 *   in both themes. "Do what I said." The background is no longer tinted,
 *   because someone who typed a text colour meant it to sit on the colour they
 *   picked, not on a pale derivative of it.
 */
export function deriveTagColors(color: string, textColor?: string | null): TagColors {
  const base = isValidHex(color) ? color : FALLBACK;

  if (textColor && isValidHex(textColor)) {
    const literal: ChipColors = {
      background: base.toUpperCase(),
      foreground: textColor.toUpperCase(),
      contrast: contrastRatio(base, textColor),
    };
    return { light: literal, dark: literal, manual: true };
  }

  const { h, s } = rgbToHsl(hexToRgb(base));

  // A grey base has no hue to tint with, so both grounds stay neutral.
  //
  // The zero check has to survive the clamps below, not just precede them:
  // greyscale converts to h=0, and clamping a saturation of 0 up to a minimum of
  // 55 turns "no colour" into red. Grey, white and black are all legitimate
  // choices for a tag, and all three came out pink before this.
  const tint = s < 8 ? 0 : s;
  const sat = (low: number, high: number) => (tint === 0 ? 0 : clamp(tint, low, high));

  const lightBg = hslToRgb({ h, s: sat(55, 100), l: 95 });
  const darkBg = hslToRgb({ h, s: tint === 0 ? 0 : clamp(tint * 0.5, 20, 55), l: 19 });

  // Light text starts mid and darkens; dark text starts mid and lightens. Both
  // stop the moment they clear the target, so the chip keeps as much of its
  // colour as legibility allows rather than defaulting to near-black.
  const lightFg = solveLightness(h, sat(45, 85), lightBg, 45, 5);
  const darkFg = solveLightness(h, sat(60, 95), darkBg, 60, 97);

  return {
    light: {
      background: rgbToHex(lightBg),
      foreground: lightFg,
      contrast: ratio(hexToRgb(lightFg), lightBg),
    },
    dark: {
      background: rgbToHex(darkBg),
      foreground: darkFg,
      contrast: ratio(hexToRgb(darkFg), darkBg),
    },
    manual: false,
  };
}
