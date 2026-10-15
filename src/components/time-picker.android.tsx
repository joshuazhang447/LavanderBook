import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Clock } from 'lucide-react-native';
import * as React from 'react';

import { PickerButton } from '@/components/picker-button';
import type { TimePickerProps } from '@/components/time-picker';
import { clockToDate, dateToClock, uses24HourClock } from '@/lib/clock-time';

/**
 * Android: the system clock dialog. It opens when mounted and reports once -
 * a time on OK, nothing on Cancel - so it is mounted only while open.
 */
export function TimePicker({ value, onChange, label, defaultTime, disabled }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <PickerButton
        value={value}
        label={label}
        icon={Clock}
        className="w-28"
        disabled={disabled}
        onPress={() => setOpen(true)}
        onClear={() => onChange('')}
      />
      {open ? (
        <DateTimePicker
          mode="time"
          value={clockToDate(value, defaultTime)}
          is24Hour={uses24HourClock()}
          onValueChange={(_, date) => {
            setOpen(false);
            onChange(dateToClock(date));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
