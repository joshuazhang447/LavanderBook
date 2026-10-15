import type { LucideIcon } from 'lucide-react-native';
import { X } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
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
