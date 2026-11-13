import * as React from 'react';
import { View } from 'react-native';

import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { VENUE_DESCRIPTION_MAX } from '@/lib/admin';
import { cn } from '@/lib/utils';

type DescriptionFieldProps = {
  value: string;
  onChangeText: (next: string) => void;
  /** What the example in the empty field should sound like. */
  placeholder?: string;
  autoFocus?: boolean;
};

/**
 * What the place is, in a sentence or two - the one field both "Add a place"
 * and "Edit" share, so the advice and the limit under it cannot drift apart.
 *
 * The counter is always there rather than appearing near the limit: this is the
 * text the list prints under the name, and how much room is left is the whole
 * question while writing it.
 */
export function DescriptionField({
  value,
  onChangeText,
  placeholder = 'A 2SLGBTQIA+ community centre with drop-in hours, peer groups and a library.',
  autoFocus,
}: DescriptionFieldProps) {
  const length = value.trim().length;
  const left = VENUE_DESCRIPTION_MAX - length;

  return (
    <View className="gap-1.5">
      <Label nativeID="place-description">Description</Label>
      <Textarea
        aria-labelledby="place-description"
        value={value}
        onChangeText={onChangeText}
        maxLength={VENUE_DESCRIPTION_MAX}
        placeholder={placeholder}
        autoFocus={autoFocus}
        numberOfLines={3}
      />
      <View className="flex-row items-start gap-3">
        <Text className="flex-1 text-xs text-muted-foreground">
          What it is and who it is for, in a sentence or two. The app prints this under the name
          in the list and on the place&apos;s card, marked as written by LavenderBook. Leave the
          details - hours, which door, who to ask for - to the notes.
        </Text>
        <Text
          className={cn('text-xs', left < 40 ? 'text-destructive' : 'text-muted-foreground')}
          style={{ fontVariant: ['tabular-nums'] }}>
          {length}/{VENUE_DESCRIPTION_MAX}
        </Text>
      </View>
    </View>
  );
}
