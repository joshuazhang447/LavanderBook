import type { DatePickerProps } from '@/components/date-picker';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/**
 * The web: the browser's own date field, with its calendar popup and the
 * person's own day/month order. Its value is 'YYYY-MM-DD' - exactly what is
 * stored - with no Date and so no zone in between.
 */
export function DatePicker({ value, onChange, label, disabled }: DatePickerProps) {
  const chenfeng = useSkin().skin === 'chenfeng';
  return (
    <input
      type="date"
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={
        // Chenfeng: iOS's compact pill - the tertiary fill, Body, no border.
        chenfeng
          ? cn(
              'h-[34px] rounded-full border-0 bg-fill-tertiary px-3 text-[17px] text-foreground outline-none dark:[color-scheme:dark]',
              'focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )
          : cn(
              'h-9 w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm shadow-black/5 outline-none transition-[color,box-shadow] dark:bg-input/30 dark:[color-scheme:dark]',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )
      }
    />
  );
}
