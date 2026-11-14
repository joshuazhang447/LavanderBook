import { Check } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { selectionTick } from '@/lib/haptics';
import { cn } from '@/lib/utils';

/**
 * Segments (LavenderBookStyle/oau-style-guide.md, section 13.7): a row of
 * stickers joined into one - cream band, an ink outline round the whole, the
 * chosen one filled with the tab's sticker colour, bold, with a small check.
 * No sliding thumb: OAU's segments are paper tabs. The bathroom question's
 * Yes / No / Not sure, and any short choice like it.
 */
export function OauSegments<T extends string>({
  options,
  value,
  onChange,
  disabled,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string; spoken?: string }[];
  value: T | null;
  onChange: (next: T) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <View
      role="radiogroup"
      aria-label={accessibilityLabel}
      className={cn(
        'min-h-11 flex-row overflow-hidden rounded-[14px] border-[1.5px] border-outline-ink bg-band',
        disabled && 'opacity-60'
      )}>
      {options.map((option, index) => {
        const chosen = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={chosen}
            accessibilityState={{ checked: chosen, disabled }}
            accessibilityLabel={option.spoken ?? option.label}
            disabled={disabled}
            onPress={() => {
              if (chosen) return;
              selectionTick();
              onChange(option.value);
            }}
            className={cn(
              'flex-1 flex-row items-center justify-center gap-1.5 px-2 py-2',
              index > 0 && 'border-l border-input',
              chosen ? 'bg-sticker' : 'active:bg-muted',
              Platform.select({ web: 'cursor-pointer select-none' })
            )}>
            {chosen ? <Icon as={Check} className="size-4 text-sticker-foreground" /> : null}
            <Text
              oauStyle="label"
              numberOfLines={1}
              className={chosen ? 'font-bold text-sticker-foreground' : 'text-foreground'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
