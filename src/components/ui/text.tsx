import { useDisplaySettings } from '@/lib/accessibility';
import { useSkin } from '@/lib/skin';
import { cn, M3_TYPES, TEXT_STYLES } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role, type TextStyle } from 'react-native';

const textVariants = cva(
  cn(
    'text-foreground text-base',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: '',
        h1: cn(
          'text-center text-4xl font-extrabold tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'border-border border-b pb-2 text-3xl font-semibold tracking-tight',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn('text-2xl font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        h4: cn('text-xl font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        p: 'mt-3 leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
        code: cn(
          'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'
        ),
        lead: 'text-muted-foreground text-xl',
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium leading-none',
        muted: 'text-muted-foreground text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

/**
 * The iOS text styles, Chenfeng's whole type scale (tailwind.config.js has the
 * sizes). A style sets the size, the line height and the style's own weight,
 * and on iOS hands the scaling to UIKit's Dynamic Type curve for that style -
 * at the largest text sizes Body grows far more than Large Title does, which
 * one multiplier for everything cannot do.
 */
export type TextStyleName = (typeof TEXT_STYLES)[number];

type DynamicTypeRamp = NonNullable<React.ComponentProps<typeof RNText>['dynamicTypeRamp']>;

const RAMP: Record<TextStyleName, DynamicTypeRamp> = {
  'large-title': 'largeTitle',
  title1: 'title1',
  title2: 'title2',
  title3: 'title3',
  headline: 'headline',
  body: 'body',
  callout: 'callout',
  subheadline: 'subheadline',
  footnote: 'footnote',
  caption1: 'caption1',
  caption2: 'caption2',
};

/** Spelled out in full: Tailwind only builds the classes it finds written down. */
const STYLE_CLASS: Record<TextStyleName, string> = {
  'large-title': 'text-large-title',
  title1: 'text-title1',
  title2: 'text-title2',
  title3: 'text-title3',
  headline: 'text-headline',
  body: 'text-body',
  callout: 'text-callout',
  subheadline: 'text-subheadline',
  footnote: 'text-footnote',
  caption1: 'text-caption1',
  caption2: 'text-caption2',
};

/** Each style's size, for the tracking below. */
const SIZE: Record<TextStyleName, number> = {
  'large-title': 34,
  title1: 28,
  title2: 22,
  title3: 20,
  headline: 17,
  body: 17,
  callout: 16,
  subheadline: 15,
  footnote: 13,
  caption1: 12,
  caption2: 11,
};

/**
 * The style's weight, and its emphasised one (SwiftUI's .bold()): the two
 * weights a style comes in.
 */
function weightClass(style: TextStyleName, emphasized: boolean): string {
  if (style === 'headline') return 'font-semibold';
  if (!emphasized) return 'font-normal';
  return style === 'large-title' || style === 'title1' || style === 'title2'
    ? 'font-bold'
    : 'font-semibold';
}

type Weight =
  | 'thin'
  | 'extralight'
  | 'light'
  | 'normal'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'extrabold'
  | 'black';
const WEIGHT_PATTERN =
  /(?:^|\s)font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?=\s|$)/g;

/** The weight a class list ends up drawing in: the last font-* weight wins, as in cn(). */
function weightOf(className: string): Weight {
  let weight: Weight = 'normal';
  for (const match of className.matchAll(WEIGHT_PATTERN)) weight = match[1] as Weight;
  return weight;
}

/** One step heavier, for iOS's Bold Text: Regular -> Semibold, Semibold -> Bold. */
const BOLDER: Partial<Record<Weight, Weight>> = {
  normal: 'semibold',
  medium: 'semibold',
  semibold: 'bold',
  bold: 'extrabold',
};

const NUMERIC: Record<Weight, TextStyle['fontWeight']> = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

/** Inter's files, loaded by SkinProvider on Android: one family per weight. */
function interFamily(weight: Weight): string {
  switch (weight) {
    case 'thin':
    case 'extralight':
    case 'light':
    case 'normal':
      return 'Inter_400Regular';
    case 'medium':
      return 'Inter_500Medium';
    case 'semibold':
      return 'Inter_600SemiBold';
    default:
      return 'Inter_700Bold';
  }
}

/**
 * Inter's own tracking at a size - tighter as text gets larger, as SF's is -
 * from Inter's published dynamic metrics. Only where Inter is drawn: SF tracks
 * itself, and a letter spacing set on iOS would override it.
 */
function interTracking(size: number): number {
  const em = -0.0223 + 0.185 * Math.exp(-0.1745 * size);
  return Math.round(em * size * 100) / 100;
}

/**
 * What Chenfeng adds to a Text's own style: on Android, Inter in the right file
 * for the weight, with its tracking; on iOS under Bold Text, one weight
 * heavier. Nothing on the web, where the stylesheet sets the typeface
 * (skin-provider.web.tsx) and the browser tracks it.
 */
function chenfengStyle(
  className: string,
  textStyle: TextStyleName | undefined,
  fontsReady: boolean,
  boldText: boolean
): TextStyle | undefined {
  if (Platform.OS === 'android') {
    if (!fontsReady) return undefined;
    const weight = weightOf(className);
    return {
      fontFamily: interFamily(weight),
      ...(textStyle ? { letterSpacing: interTracking(SIZE[textStyle]) } : null),
    };
  }
  if (Platform.OS === 'ios' && boldText) {
    const bolder = BOLDER[weightOf(className)];
    return bolder ? { fontWeight: NUMERIC[bolder] } : undefined;
  }
  return undefined;
}

/** Material's type scale (docs/material-design-guideline.md, section 5.2). */
export type M3TypeName = (typeof M3_TYPES)[number];

/** Spelled out in full, as STYLE_CLASS is. */
const M3_CLASS: Record<M3TypeName, string> = {
  'display-large': 'text-m3-display-large',
  'display-medium': 'text-m3-display-medium',
  'display-small': 'text-m3-display-small',
  'headline-large': 'text-m3-headline-large',
  'headline-medium': 'text-m3-headline-medium',
  'headline-small': 'text-m3-headline-small',
  'title-large': 'text-m3-title-large',
  'title-medium': 'text-m3-title-medium',
  'title-small': 'text-m3-title-small',
  'body-large': 'text-m3-body-large',
  'body-medium': 'text-m3-body-medium',
  'body-small': 'text-m3-body-small',
  'label-large': 'text-m3-label-large',
  'label-medium': 'text-m3-label-medium',
  'label-small': 'text-m3-label-small',
};

/**
 * A Material style's weight, and its Emphasized one (M3 Expressive): titles
 * medium and small and the labels are medium and go bold; the rest are regular
 * and go medium.
 */
function m3WeightClass(type: M3TypeName, emphasized: boolean): string {
  const medium = type === 'title-medium' || type === 'title-small' || type.startsWith('label');
  if (medium) return emphasized ? 'font-bold' : 'font-medium';
  return emphasized ? 'font-medium' : 'font-normal';
}

/** Roboto's files, loaded by SkinProvider on iOS: one family per weight. */
function robotoFamily(weight: Weight): string {
  switch (weight) {
    case 'thin':
    case 'extralight':
    case 'light':
    case 'normal':
      return 'Roboto_400Regular';
    case 'medium':
      return 'Roboto_500Medium';
    default:
      return 'Roboto_700Bold';
  }
}

/**
 * What Material adds to a Text's own style: Roboto on iOS, in the file for the
 * weight (one weight heavier under Bold Text). Android draws Roboto already -
 * it is the system's font - and the website's stylesheet sets it there.
 */
function materialStyle(
  className: string,
  fontsReady: boolean,
  boldText: boolean
): TextStyle | undefined {
  if (Platform.OS !== 'ios' || !fontsReady) return undefined;
  const weight = weightOf(className);
  return { fontFamily: robotoFamily(boldText ? (BOLDER[weight] ?? weight) : weight) };
}

function Text({
  className,
  asChild = false,
  variant = 'default',
  textStyle,
  type,
  emphasized = false,
  style,
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
    /**
     * One of the iOS text styles. Chenfeng's vocabulary: Basic and Material
     * keep sizing with classes.
     */
    textStyle?: TextStyleName;
    /**
     * One of Material's type styles. Material's vocabulary, as textStyle is
     * Chenfeng's; Basic keeps sizing with classes.
     */
    type?: M3TypeName;
    /** The style's bold variant (Chenfeng) or its Emphasized one (Material). */
    emphasized?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const { skin, fontsReady } = useSkin();
  const { boldText } = useDisplaySettings();
  const Component = asChild ? Slot : RNText;
  const merged = cn(
    textVariants({ variant }),
    textStyle && cn(STYLE_CLASS[textStyle], weightClass(textStyle, emphasized)),
    type && cn(M3_CLASS[type], m3WeightClass(type, emphasized)),
    textClass,
    className
  );
  const own =
    skin === 'chenfeng'
      ? chenfengStyle(merged, textStyle, fontsReady, boldText)
      : skin === 'material'
        ? materialStyle(merged, fontsReady, boldText)
        : undefined;

  return (
    <Component
      className={merged}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      dynamicTypeRamp={textStyle && Platform.OS === 'ios' ? RAMP[textStyle] : undefined}
      style={own ? [own, style] : style}
      {...props}
    />
  );
}

export { Text, TextClassContext };
