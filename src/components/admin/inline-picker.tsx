import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/**
 * A wrapped row of buttons, used where a Select would normally go.
 *
 * Deliberately NOT `@/components/ui/select` inside a dialog. On web both are
 * Radix: the Select portals its list to document.body and toggles
 * `pointer-events` on body while open, so a click around that transition lands
 * on the Dialog's own overlay - whose handler closes the dialog when
 * `event.target === event.currentTarget`. The effect is that opening the picker
 * dismisses the whole form.
 *
 * A portal inside a portal is the problem, so this has no portal. It also shows
 * every option at once, which for a short list is better than a dropdown anyway.
 * Selects elsewhere in the panel are fine - none of them are inside a dialog.
 *
 * Also the queue's list switcher, where the counts on every option are the
 * point and a dropdown would hide all but one.
 */
export function InlinePicker<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={value === option.value ? 'default' : 'outline'}
          disabled={disabled}
          aria-pressed={value === option.value}
          onPress={() => onChange(option.value)}>
          <Text>{option.label}</Text>
        </Button>
      ))}
    </View>
  );
}
