import { useSkin } from '@/lib/skin';
import { useFieldText } from '@/lib/use-field-text';
import { cn } from '@/lib/utils';
import { useColorScheme } from 'nativewind';
import { Platform, TextInput } from 'react-native';

/**
 * Chenfeng's text view: a row of a form that grows with its text from about
 * four lines, or, standing alone, a rounded block in the tertiary fill
 * (guideline section 13.9).
 */
const CHENFENG_TEXTAREA = {
  field: 'min-h-[110px] rounded-[20px] bg-fill-tertiary px-4 py-3',
  row: 'min-h-[110px] bg-transparent px-4 py-[13px]',
} as const;

function Textarea({
  className,
  multiline = true,
  numberOfLines = Platform.select({ web: 2, native: 8 }), // On web, numberOfLines also determines initial height. On native, it determines the maximum height.
  placeholderClassName,
  value,
  onChangeText,
  look = 'field',
  ...props
}: React.ComponentProps<typeof TextInput> &
  React.RefAttributes<TextInput> & {
    /** Chenfeng only: alone, or a row of a form. */
    look?: keyof typeof CHENFENG_TEXTAREA;
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
          'w-full border-0 text-[17px] leading-[22px] text-foreground',
          CHENFENG_TEXTAREA[look],
          Platform.select({
            web: 'field-sizing-content resize-none outline-none',
          }),
          props.editable === false && 'text-label-tertiary',
          className
        )}
        placeholderClassName={cn('text-label-tertiary', placeholderClassName)}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical="top"
        {...props}
        {...field.props}
      />
    );
  }

  return (
    <TextInput
      key={field.key}
      className={cn(
        'text-foreground border-input dark:bg-input/30 flex min-h-16 w-full flex-row rounded-md border bg-transparent px-3 py-2 text-base shadow-sm shadow-black/5 md:text-sm',
        Platform.select({
          web: 'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive field-sizing-content resize-y outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:cursor-not-allowed',
        }),
        props.editable === false && 'opacity-50',
        className
      )}
      placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
      multiline={multiline}
      numberOfLines={numberOfLines}
      textAlignVertical="top"
      {...props}
      {...field.props}
    />
  );
}

export { Textarea };
