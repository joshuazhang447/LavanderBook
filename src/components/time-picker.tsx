import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Clock } from 'lucide-react-native';
import * as React from 'react';
import { useColorScheme, View } from 'react-native';

import { PickerButton } from '@/components/picker-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { clockToDate, dateToClock } from '@/lib/clock-time';

export type TimePickerProps = {
  /** 'HH:MM', or '' for no answer. */
  value: string;
  onChange: (value: string) => void;
  /** Shown on the button while there is no answer, and as the dialog's title. */
  label: string;
  /** Where the picker starts when there is no answer yet, as 'HH:MM'. */
  defaultTime: string;
  disabled?: boolean;
};

/**
 * iOS: the system wheel, in a dialog with Done, so scrolling past a time on the
 * way to another one doesn't answer the question. Android has its own file,
 * because there the system already shows a dialog; the web has the browser's.
 */
export function TimePicker({ value, onChange, label, defaultTime, disabled }: TimePickerProps) {
  const [draft, setDraft] = React.useState<Date | null>(null);
  const dark = useColorScheme() === 'dark';

  return (
    <>
      <PickerButton
        value={value}
        label={label}
        icon={Clock}
        className="w-28"
        disabled={disabled}
        onPress={() => setDraft(clockToDate(value, defaultTime))}
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
                mode="time"
                display="spinner"
                value={draft}
                themeVariant={dark ? 'dark' : 'light'}
                onValueChange={(_, date) => setDraft(date)}
              />
            ) : null}
          </View>
          <DialogFooter>
            <Button
              onPress={() => {
                if (draft) onChange(dateToClock(draft));
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
