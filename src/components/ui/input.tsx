import { useSkin } from '@/lib/skin';
import { skinColor } from '@/lib/theme';
import { useFieldText } from '@/lib/use-field-text';
import { cn } from '@/lib/utils';
import { useColorScheme } from 'nativewind';
import { Platform, TextInput } from 'react-native';

/**
 * Chenfeng's text field, two ways (guideline section 13.9):
 *
 *   field  standing alone: a 44 pt capsule in the tertiary fill, iOS 27's
 *          bordered text field
 *   row    a row of a form: no border, no fill, Body text, 16 pt in from the
 *          section's edges, 52 tall - the section is the field's shape
 *
 * No focus ring, no red outline for an error: iOS shows neither. A single line
 * sets no line height, which would push the text off centre on iOS.
 */
const CHENFENG_INPUT = {
  field: 'h-11 rounded-full bg-fill-tertiary px-4',
  row: 'min-h-[52px] bg-transparent px-4 py-[15px]',
} as const;

/**
 * Chenfeng's placeholder, as a colour rather than a class, on every platform.
 *
 * label-tertiary is translucent, its alpha in a variable of its own. As a
 * class it reached Android as one colour with the alpha dropped - solid dark
 * grey - and the website's text area not at all, which drew the stylesheet's
 * default blue-grey. A colour worked out here is the same everywhere.
 */
export function chenfengPlaceholder(scheme: string | undefined): string {
  return skinColor('chenfeng', scheme === 'dark' ? 'dark' : 'light', 'label-tertiary');
}

function Input({
  className,
  value,
  onChangeText,
  look = 'field',
  ...props
}: React.ComponentProps<typeof TextInput> &
  React.RefAttributes<TextInput> & {
    /** Chenfeng only: alone, or a row of a form. */
    look?: keyof typeof CHENFENG_INPUT;
  }) {
  // On a phone, the field keeps its own text - see useFieldText.
  const field = useFieldText({ value, onChangeText });
  const { skin } = useSkin();
  const { colorScheme } = useColorScheme();

  if (skin === 'chenfeng') {
    return (
      <TextInput
        key={field.key}
        keyboardAppearance={colorScheme === 'dark' ? 'dark' : 'light'}
        className={cn(
          'w-full min-w-0 border-0 text-[17px] text-foreground',
          CHENFENG_INPUT[look],
          props.editable === false && 'text-label-tertiary',
          Platform.select({
            web: 'outline-none selection:bg-primary/30',
          }),
          className
        )}
        placeholderTextColor={chenfengPlaceholder(colorScheme)}
        {...props}
        {...field.props}
      />
    );
  }

  return (
    <TextInput
      key={field.key}
      className={cn(
        'dark:bg-input/30 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',
        props.editable === false &&
        cn(
          'opacity-50',
          Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
        ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
          native: 'placeholder:text-muted-foreground/50',
        }),
        className
      )}
      {...props}
      {...field.props}
    />
  );
}

export { Input };
