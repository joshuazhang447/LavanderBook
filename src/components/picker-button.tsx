import type { LucideIcon } from 'lucide-react-native';
import { CircleX, X } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/**
 * What a time or date question shows on a phone until it is tapped: the chosen
 * value, or a muted prompt, and a way to take the answer back - every question
 * can be skipped, and a picker on its own can only ever set a value.
 */
export function PickerButton({
  value,
  label,
  icon,
  onPress,
  onClear,
  disabled,
  className,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const { skin } = useSkin();
  if (skin === 'chenfeng') {
    return (
      <ChenfengPill
        value={value}
        label={label}
        onPress={onPress}
        onClear={onClear}
        disabled={disabled}
      />
    );
  }

  return (
    <View className="flex-row items-center">
      <Button
        variant="outline"
        disabled={disabled}
        onPress={onPress}
        accessibilityLabel={value ? `${label}: ${value}` : label}
        className={cn('justify-start gap-2 px-3', className)}>
        <Icon as={icon} className="size-4 text-muted-foreground" />
        <Text className={cn('font-normal', !value && 'text-muted-foreground')}>
          {value || label}
        </Text>
      </Button>
      {value && !disabled ? (
        <Button
          variant="ghost"
          size="icon"
          onPress={onClear}
          accessibilityLabel={`Clear ${label.toLowerCase()}`}>
          <Icon as={X} className="size-4 text-muted-foreground" />
        </Button>
      ) : null}
    </View>
  );
}

/**
 * Chenfeng's: iOS's compact date and time pill - about 34 pt, the tertiary
 * fill, the value in Body - with the clear button beside it as a grey
 * xmark.circle.fill.
 */
export function ChenfengPill({
  value,
  label,
  onPress,
  onClear,
  disabled,
}: {
  value: string;
  label: string;
  onPress: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${value}` : `Choose ${label.toLowerCase()}`}
        className={cn(
          'h-[34px] justify-center rounded-full bg-fill-tertiary px-3 active:opacity-75',
          disabled && 'opacity-50',
          Platform.select({ web: 'cursor-pointer select-none' })
        )}>
        <Text textStyle="body" className={value ? 'text-foreground' : 'text-primary'}>
          {value || 'Add'}
        </Text>
      </Pressable>
      {value && !disabled ? <ClearButton label={label} onClear={onClear} /> : null}
    </View>
  );
}

/** The grey ✕ beside a pill, taking the answer back. */
export function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Pressable
      onPress={onClear}
      accessibilityRole="button"
      accessibilityLabel={`Clear ${label.toLowerCase()}`}
      hitSlop={8}
      className={cn('p-1 active:opacity-60', Platform.select({ web: 'cursor-pointer' }))}>
      <Icon as={CircleX} size={17} className="text-label-tertiary" />
    </Pressable>
  );
}
