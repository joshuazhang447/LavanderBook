import { useRipple } from '@/components/ui/ripple';
import { TextClassContext } from '@/components/ui/text';
import { useSkin, type Skin } from '@/lib/skin';
import { skinColor, type SkinColor } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { useColorScheme } from 'nativewind';
import { Platform, Pressable, type PressableAndroidRippleConfig } from 'react-native';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-primary active:bg-primary/90 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-primary/90' })
        ),
        destructive: cn(
          'bg-destructive active:bg-destructive/90 dark:bg-destructive/60 shadow-sm shadow-black/5',
          Platform.select({
            web: 'hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
          })
        ),
        outline: cn(
          'border-border bg-background active:bg-accent dark:bg-input/30 dark:border-input dark:active:bg-input/50 border shadow-sm shadow-black/5',
          Platform.select({
            web: 'hover:bg-accent dark:hover:bg-input/50',
          })
        ),
        secondary: cn(
          'bg-secondary active:bg-secondary/80 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-secondary/80' })
        ),
        ghost: cn(
          'active:bg-accent dark:active:bg-accent/50',
          Platform.select({ web: 'hover:bg-accent dark:hover:bg-accent/50' })
        ),
        link: '',
      },
      size: {
        default: cn('h-10 px-4 py-2 sm:h-9', Platform.select({ web: 'has-[>svg]:px-3' })),
        sm: cn('h-9 gap-1.5 rounded-md px-3 sm:h-8', Platform.select({ web: 'has-[>svg]:px-2.5' })),
        lg: cn('h-11 rounded-md px-6 sm:h-10', Platform.select({ web: 'has-[>svg]:px-4' })),
        icon: 'h-10 w-10 sm:h-9 sm:w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  cn(
    'text-foreground text-sm font-medium',
    Platform.select({ web: 'pointer-events-none transition-colors' })
  ),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-white',
        outline: cn(
          'group-active:text-accent-foreground',
          Platform.select({ web: 'group-hover:text-accent-foreground' })
        ),
        secondary: 'text-secondary-foreground',
        ghost: 'group-active:text-accent-foreground',
        link: cn(
          'text-primary group-active:underline',
          Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })
        ),
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * Hovered, in Material, for buttons with a fill: a step darker, the nearest a
 * class gets to Material's hover overlay. A press is the ripple's: Android's
 * own (materialRipple), and a drawn one elsewhere (MaterialRippleButton).
 */
const MATERIAL_HOVER_FILL = Platform.select({ web: 'hover:brightness-95', default: '' });

/** The same for buttons without one: a faint wash of the label's colour. */
const MATERIAL_HOVER_BARE = Platform.select({ web: 'hover:bg-primary/[0.08]', default: '' });

/**
 * Material 3's common buttons, all full pills:
 *
 *   default      filled
 *   destructive  filled, in the error colour
 *   outline      outlined
 *   secondary    filled tonal
 *   ghost, link  text buttons
 */
const materialButtonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 overflow-hidden rounded-full',
    Platform.select({
      web: "focus-visible:ring-ring/50 whitespace-nowrap outline-none transition-[filter,background-color] focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn('bg-primary', MATERIAL_HOVER_FILL),
        destructive: cn('bg-destructive', MATERIAL_HOVER_FILL),
        outline: cn('border border-border', MATERIAL_HOVER_BARE),
        secondary: cn('bg-secondary', MATERIAL_HOVER_FILL),
        ghost: MATERIAL_HOVER_BARE,
        link: '',
      },
      size: {
        default: cn('h-10 px-6', Platform.select({ web: 'has-[>svg]:px-4' })),
        sm: cn('h-8 gap-1.5 px-4', Platform.select({ web: 'has-[>svg]:px-3' })),
        lg: cn('h-14 px-8', Platform.select({ web: 'has-[>svg]:px-6' })),
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const materialButtonTextVariants = cva(
  cn('text-sm font-medium tracking-[0.1px]', Platform.select({ web: 'pointer-events-none' })),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-destructive-foreground',
        outline: 'text-primary',
        secondary: 'text-secondary-foreground',
        ghost: 'text-primary',
        link: cn(
          'text-primary group-active:underline',
          Platform.select({ web: 'underline-offset-4 group-hover:underline' })
        ),
      },
      size: {
        default: '',
        sm: '',
        lg: 'text-base',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type Variant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;

/** What colour each Material button's ripple is: its label's. */
const MATERIAL_RIPPLE: Record<Variant, SkinColor> = {
  default: 'primary-foreground',
  destructive: 'destructive-foreground',
  outline: 'primary',
  secondary: 'secondary-foreground',
  ghost: 'primary',
  link: 'primary',
};

function materialRipple(
  variant: Variant | null | undefined,
  scheme: 'light' | 'dark' | undefined
): PressableAndroidRippleConfig {
  return {
    color: skinColor('material', scheme ?? 'light', MATERIAL_RIPPLE[variant ?? 'default'], 0.24),
    // Over the label too, as Material's ripple is; clipped to the pill by
    // overflow-hidden.
    foreground: true,
  };
}

/**
 * SwiftUI's button styles in content - a list, a sheet - as iOS 26 draws them,
 * capsules all (guideline section 13.4). What floats over content is glass
 * instead, and has its own component (GlassButton in glass.tsx).
 *
 *   default      .borderedProminent: the tint, filled, a white Headline label
 *   secondary    .bordered: the tint faint behind a tinted label
 *   outline      the same - iOS has no outlined button
 *   destructive  .bordered in red: a red label on red at 15%
 *   ghost, link  .borderless: the label alone, in the tint
 *
 * Pressed, the button dims to 75% at once - a label alone to 30% - and comes
 * back over a fifth of a second, as UIKit's do. Disabled, the label goes to
 * the tertiary label colour and a filled button to a grey fill: iOS never
 * shows the tint at half strength. No ripple, no outline, no grey box.
 */
const chenfengButtonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-1.5 rounded-full',
    Platform.select({
      web: "focus-visible:ring-ring/50 cursor-pointer select-none whitespace-nowrap outline-none transition-opacity duration-200 focus-visible:ring-[3px] active:duration-0 disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: 'bg-primary active:opacity-75',
        destructive: 'bg-destructive/15 active:opacity-75',
        outline: 'bg-tint-fill active:opacity-75',
        secondary: 'bg-tint-fill active:opacity-75',
        ghost: 'active:opacity-30',
        link: 'active:opacity-30',
      },
      size: {
        default: 'h-9 px-4',
        sm: 'h-[30px] gap-1 px-3',
        lg: 'h-[50px] px-5',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const chenfengButtonTextVariants = cva(
  cn('text-body', Platform.select({ web: 'pointer-events-none' })),
  {
    variants: {
      variant: {
        default: 'font-semibold text-primary-foreground',
        destructive: 'text-destructive',
        outline: 'text-primary',
        secondary: 'font-semibold text-primary',
        ghost: 'text-primary',
        link: 'text-primary',
      },
      size: {
        default: '',
        sm: 'text-subheadline',
        lg: 'font-semibold',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/** A disabled Chenfeng button: grey where it was filled, its label faded. */
const CHENFENG_DISABLED = {
  button: { default: 'bg-fill-tertiary', destructive: 'bg-fill-tertiary', outline: 'bg-fill-tertiary', secondary: 'bg-fill-tertiary', ghost: '', link: '' },
  text: 'text-label-tertiary',
} as const;

/** Each skin's button and label classes. Basic's are the originals, untouched. */
const SKIN_BUTTONS = {
  basic: { button: buttonVariants, text: buttonTextVariants },
  material: { button: materialButtonVariants, text: materialButtonTextVariants },
  chenfeng: { button: chenfengButtonVariants, text: chenfengButtonTextVariants },
} satisfies Record<Skin, { button: typeof buttonVariants; text: typeof buttonTextVariants }>;

type ButtonProps = React.ComponentProps<typeof Pressable> & React.RefAttributes<typeof Pressable> & VariantProps<typeof buttonVariants>;

function Button(props: ButtonProps) {
  const { skin } = useSkin();
  // A component of its own rather than a branch in this one, so the ripple's
  // state exists only on the buttons that draw it.
  if (skin === 'material' && Platform.OS !== 'android') return <MaterialRippleButton {...props} />;
  return <SkinnedButton skin={skin} {...props} />;
}

function SkinnedButton({ skin, className, variant, size, ...props }: ButtonProps & { skin: Skin }) {
  const { colorScheme } = useColorScheme();
  const looks = SKIN_BUTTONS[skin];
  // Chenfeng greys a disabled button rather than fading it (CHENFENG_DISABLED).
  const greyed = skin === 'chenfeng' && !!props.disabled;

  return (
    <TextClassContext.Provider
      value={
        greyed ? cn(looks.text({ variant, size }), CHENFENG_DISABLED.text) : looks.text({ variant, size })
      }>
      <Pressable
        // Material on Android: a new button when the variant changes (an answer
        // picked). Android draws a background that arrives after mount over the
        // children of a clipped, rounded view - the label vanished into the
        // fill - and Material's pills clip, to keep the ripple inside them.
        key={skin === 'material' ? (variant ?? 'default') : undefined}
        className={cn(
          props.disabled && !greyed && 'opacity-50',
          looks.button({ variant, size }),
          greyed && CHENFENG_DISABLED.button[variant ?? 'default'],
          className
        )}
        role="button"
        android_ripple={skin === 'material' ? materialRipple(variant, colorScheme) : undefined}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

/** A Material button on the website and iOS, with Material's ripple drawn in. */
function MaterialRippleButton({
  className,
  variant,
  size,
  children,
  onLayout,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const { colorScheme } = useColorScheme();
  const ripple = useRipple(
    skinColor('material', colorScheme ?? 'light', MATERIAL_RIPPLE[variant ?? 'default'])
  );

  return (
    <TextClassContext.Provider value={materialButtonTextVariants({ variant, size })}>
      <Pressable
        className={cn(
          props.disabled && 'opacity-50',
          materialButtonVariants({ variant, size }),
          className
        )}
        role="button"
        onLayout={(event) => {
          ripple.onLayout(event);
          onLayout?.(event);
        }}
        onPressIn={(event) => {
          ripple.onPressIn(event);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          ripple.onPressOut();
          onPressOut?.(event);
        }}
        {...props}>
        {(state) => (
          <>
            {ripple.wave}
            {typeof children === 'function' ? children(state) : children}
          </>
        )}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
