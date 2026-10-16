import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { CalendarDays } from 'lucide-react-native';
import * as React from 'react';
import { useColorScheme, View } from 'react-native';

import { ChenfengPill, ClearButton, PickerButton } from '@/components/picker-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { dateToDay, dayToDate } from '@/lib/calendar-day';
import { useSkin } from '@/lib/skin';

export type DatePickerProps = {
  /** 'YYYY-MM-DD', or '' for no answer. */
  value: string;
  onChange: (value: string) => void;
  /** Shown on the button while there is no answer, and as the dialog's title. */
  label: string;
  disabled?: boolean;
};

/**
 * iOS: the system calendar, in a dialog with Done, the same shape as
 * TimePicker. SwiftUI's picker works in local time, so days are read locally.
 * Android and the web have their own files.
 */
export function DatePicker(props: DatePickerProps) {
  const { skin } = useSkin();
  return skin === 'chenfeng' ? <CompactDatePicker {...props} /> : <DialogDatePicker {...props} />;
}

/**
 * Chenfeng: SwiftUI's compact date picker, right in the row - the pill that
 * opens the system calendar - as Settings and Calendar have it. Until there is
 * an answer, a pill that starts one at today; beside an answer, its clear.
 */
function CompactDatePicker({ value, onChange, label, disabled }: DatePickerProps) {
  const dark = useColorScheme() === 'dark';
  if (!value) {
    return (
      <ChenfengPill
        value=""
        label={label}
        disabled={disabled}
        onPress={() => onChange(dateToDay(new Date(), 'local'))}
        onClear={() => onChange('')}
      />
    );
  }
  return (
    <View className="flex-row items-center gap-1.5">
      <DateTimePicker
        mode="date"
        display="compact"
        value={dayToDate(value, 'local')}
        disabled={disabled}
        themeVariant={dark ? 'dark' : 'light'}
        onValueChange={(_, date) => onChange(dateToDay(date, 'local'))}
      />
      {disabled ? null : <ClearButton label={label} onClear={() => onChange('')} />}
    </View>
  );
}

function DialogDatePicker({ value, onChange, label, disabled }: DatePickerProps) {
  const [draft, setDraft] = React.useState<Date | null>(null);
  const dark = useColorScheme() === 'dark';

  return (
    <>
      <PickerButton
        value={value}
        label={label}
        icon={CalendarDays}
        className="w-40"
        disabled={disabled}
        onPress={() => setDraft(dayToDate(value, 'local'))}
        onClear={() => onChange('')}
      />
      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="w-full max-w-sm">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <View className="items-center">
            {draft ? (
              <DateTimePicker
                mode="date"
                display="inline"
                value={draft}
                themeVariant={dark ? 'dark' : 'light'}
                onValueChange={(_, date) => setDraft(date)}
              />
            ) : null}
          </View>
          <DialogFooter>
            <Button
              onPress={() => {
                if (draft) onChange(dateToDay(draft, 'local'));
                setDraft(null);
              }}>
              <Text>Done</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
