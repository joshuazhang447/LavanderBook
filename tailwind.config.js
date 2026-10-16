const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        star: 'hsl(var(--star))',
        admin: 'hsl(var(--admin))',
        'switch-on': 'hsl(var(--switch-on))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Chenfeng's (src/lib/theme.ts); in Basic and Material they fall back on
        // colours those already have. The translucent ones carry their alpha in
        // a variable of their own, so they take no opacity modifier.
        grouped: 'hsl(var(--grouped))',
        'segment-thumb': 'hsl(var(--segment-thumb))',
        'system-purple': 'hsl(var(--system-purple))',
        'system-indigo': 'hsl(var(--system-indigo))',
        'system-gray': 'hsl(var(--system-gray))',
        'label-secondary': 'hsl(var(--label-secondary) / var(--label-secondary-a))',
        'label-tertiary': 'hsl(var(--label-tertiary) / var(--label-tertiary-a))',
        separator: 'hsl(var(--separator) / var(--separator-a))',
        fill: {
          DEFAULT: 'hsl(var(--fill) / var(--fill-a))',
          secondary: 'hsl(var(--fill-secondary) / var(--fill-secondary-a))',
          tertiary: 'hsl(var(--fill-tertiary) / var(--fill-tertiary-a))',
          quaternary: 'hsl(var(--fill-quaternary) / var(--fill-quaternary-a))',
        },
        'tint-fill': 'hsl(var(--tint-fill) / var(--tint-fill-a))',
        // Material's roles (docs/material-design-guideline.md, section 4.3).
        // First the ones only Material defines; then its names for roles the
        // set above already has, so a Material component reads like the spec.
        'primary-container': 'hsl(var(--primary-container))',
        'on-primary-container': 'hsl(var(--on-primary-container))',
        tertiary: 'hsl(var(--tertiary))',
        'tertiary-container': 'hsl(var(--tertiary-container))',
        'on-tertiary-container': 'hsl(var(--on-tertiary-container))',
        'error-container': 'hsl(var(--error-container))',
        'on-error-container': 'hsl(var(--on-error-container))',
        'surface-container-lowest': 'hsl(var(--surface-container-lowest))',
        'inverse-surface': 'hsl(var(--inverse-surface))',
        'inverse-on-surface': 'hsl(var(--inverse-on-surface))',
        'inverse-primary': 'hsl(var(--inverse-primary))',
        'm3-secondary': 'hsl(var(--m3-secondary))',
        surface: 'hsl(var(--background))',
        'surface-container-low': 'hsl(var(--card))',
        'surface-container': 'hsl(var(--popover))',
        'surface-container-high': 'hsl(var(--accent))',
        'surface-container-highest': 'hsl(var(--muted))',
        'secondary-container': 'hsl(var(--secondary))',
        'on-secondary-container': 'hsl(var(--secondary-foreground))',
        'on-primary': 'hsl(var(--primary-foreground))',
        'on-surface': 'hsl(var(--foreground))',
        'on-surface-variant': 'hsl(var(--muted-foreground))',
        outline: 'hsl(var(--input))',
        'outline-variant': 'hsl(var(--border))',
        error: 'hsl(var(--destructive))',
        'on-error': 'hsl(var(--destructive-foreground))',
      },
      // The iOS text styles at the default text size, for Chenfeng (see the
      // Text component's textStyle). In rem, so the browser's text size and
      // zoom still apply; metro's inlineRem: 16 makes them points on a phone.
      // Basic and Material keep text-sm and friends.
      fontSize: {
        'large-title': ['2.125rem', { lineHeight: '2.5625rem' }], // 34/41
        title1: ['1.75rem', { lineHeight: '2.125rem' }], // 28/34
        title2: ['1.375rem', { lineHeight: '1.75rem' }], // 22/28
        title3: ['1.25rem', { lineHeight: '1.5625rem' }], // 20/25
        headline: ['1.0625rem', { lineHeight: '1.375rem' }], // 17/22
        body: ['1.0625rem', { lineHeight: '1.375rem' }], // 17/22
        callout: ['1rem', { lineHeight: '1.3125rem' }], // 16/21
        subheadline: ['0.9375rem', { lineHeight: '1.25rem' }], // 15/20
        footnote: ['0.8125rem', { lineHeight: '1.125rem' }], // 13/18
        caption1: ['0.75rem', { lineHeight: '1rem' }], // 12/16
        caption2: ['0.6875rem', { lineHeight: '0.8125rem' }], // 11/13
        // Material's type scale (TypeScaleTokens; the guideline's section 5.2),
        // for the Text component's `type`. Size, line height and tracking: the
        // weight is the component's, so it can pick the font file for it.
        'm3-display-large': ['3.5625rem', { lineHeight: '4rem', letterSpacing: '-0.2px' }], // 57/64
        'm3-display-medium': ['2.8125rem', { lineHeight: '3.25rem' }], // 45/52
        'm3-display-small': ['2.25rem', { lineHeight: '2.75rem' }], // 36/44
        'm3-headline-large': ['2rem', { lineHeight: '2.5rem' }], // 32/40
        'm3-headline-medium': ['1.75rem', { lineHeight: '2.25rem' }], // 28/36
        'm3-headline-small': ['1.5rem', { lineHeight: '2rem' }], // 24/32
        'm3-title-large': ['1.375rem', { lineHeight: '1.75rem' }], // 22/28
        'm3-title-medium': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0.2px' }], // 16/24
        'm3-title-small': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.1px' }], // 14/20
        'm3-body-large': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0.5px' }], // 16/24
        'm3-body-medium': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.2px' }], // 14/20
        'm3-body-small': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.4px' }], // 12/16
        'm3-label-large': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.1px' }], // 14/20
        'm3-label-medium': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.5px' }], // 12/16
        'm3-label-small': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.5px' }], // 11/16
      },
      borderRadius: {
        // Tailwind's own xl is 0.75rem, which is exactly --radius + 2px in
        // Basic, so Basic is unchanged - and cards, which use xl, follow the
        // skin's radius like everything else.
        xl: 'calc(var(--radius) + 2px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require('tailwindcss-animate')],
};
