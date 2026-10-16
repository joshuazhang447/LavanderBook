import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Chenfeng's text styles (tailwind.config.js), declared as font sizes. Without
 * this tailwind-merge reads text-body as a colour, and cn('text-foreground',
 * 'text-body') would quietly drop the colour.
 */
export const TEXT_STYLES = [
  'large-title',
  'title1',
  'title2',
  'title3',
  'headline',
  'body',
  'callout',
  'subheadline',
  'footnote',
  'caption1',
  'caption2',
] as const;

/** Material's type scale, likewise: tailwind.config.js has them as m3-*. */
export const M3_TYPES = [
  'display-large',
  'display-medium',
  'display-small',
  'headline-large',
  'headline-medium',
  'headline-small',
  'title-large',
  'title-medium',
  'title-small',
  'body-large',
  'body-medium',
  'body-small',
  'label-large',
  'label-medium',
  'label-small',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...TEXT_STYLES, ...M3_TYPES.map((type) => `m3-${type}`)],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
