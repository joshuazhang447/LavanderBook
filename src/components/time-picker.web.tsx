import type { TimePickerProps } from '@/components/time-picker';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/**
 * The web: the browser's own time field. It already has a clock button, arrow
 * keys and a 12- or 24-hour face from the person's settings, and its value is
 * 'HH:MM' - exactly what is stored. @expo/ui's picker renders nothing here.
 */
export function TimePicker({ value, onChange, label, disabled }: TimePickerProps) {
  const chenfeng = useSkin().skin === 'chenfeng';
  return (
    <input
      type="time"
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
              'h-9 w-32 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm shadow-black/5 outline-none transition-[color,box-shadow] dark:bg-input/30 dark:[color-scheme:dark]',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )
      }
    />
  );
}
