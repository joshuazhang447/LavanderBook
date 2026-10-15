import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { CalendarDays } from 'lucide-react-native';
import * as React from 'react';

import type { DatePickerProps } from '@/components/date-picker';
import { PickerButton } from '@/components/picker-button';
import { dateToDay, dayToDate } from '@/lib/calendar-day';

/**
 * Android: the system calendar dialog, mounted only while open like the clock
 * one. Material's calendar selects UTC days - it is handed one and reports
 * one - so days go in and come out in UTC.
 */
export function DatePicker({ value, onChange, label, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <PickerButton
        value={value}
        label={label}
        icon={CalendarDays}
        className="w-40"
        disabled={disabled}
        onPress={() => setOpen(true)}
        onClear={() => onChange('')}
      />
      {open ? (
        <DateTimePicker
          mode="date"
          value={dayToDate(value, 'utc')}
          onValueChange={(_, date) => {
            setOpen(false);
            onChange(dateToDay(date, 'utc'));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
