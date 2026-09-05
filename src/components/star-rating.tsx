import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export const STAR_HINT: Record<number, string> = {
  1: 'Hostile',
  2: 'Unwelcoming',
  3: 'Neutral',
  4: 'Welcoming',
  5: 'Actively welcoming',
};

const VALUES = [1, 2, 3, 4, 5];

type StarRatingProps = {
  value: number | null;
  /** Omit to render read-only, as in the list. */
  onChange?: (value: number) => void;
  size?: 'sm' | 'lg';
};

/**
 * One component for both the editable rating in the sheet and the read-only row
 * in the list, so the two can never drift out of step.
 */
export function StarRating({ value, onChange, size = 'lg' }: StarRatingProps) {
  const starClass = size === 'lg' ? 'size-9' : 'size-4';

  return (
    <View className={cn('flex-row', size === 'lg' ? 'gap-1' : 'gap-0.5')}>
      {VALUES.map((star) => {
        const earned = value !== null && star <= value;
        const icon = (
          <Icon
            as={Star}
            // Gold when earned, a solid grey outline otherwise. Anything fainter
            // disappears against the white sheet.
            className={cn(starClass, earned ? 'text-star' : 'text-muted-foreground')}
            fill={earned ? 'currentColor' : 'none'}
          />
        );

        if (!onChange) {
          return <View key={star}>{icon}</View>;
        }

        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === star }}
            accessibilityLabel={`${star} of 5, ${STAR_HINT[star]}`}
            className="rounded-md p-1 active:bg-accent">
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}
