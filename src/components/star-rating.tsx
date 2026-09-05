import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

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

function StarIcon({ earned, className }: { earned: boolean; className: string }) {
  return (
    <Icon
      as={Star}
      // Gold when earned, a solid grey outline otherwise. Anything fainter
      // disappears against the white sheet.
      className={cn(className, earned ? 'text-star' : 'text-muted-foreground')}
      fill={earned ? 'currentColor' : 'none'}
    />
  );
}

function StarButton({
  star,
  value,
  className,
  onChange,
}: {
  star: number;
  value: number | null;
  className: string;
  onChange: (value: number) => void;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPress={() => {
        // A quick overshoot and settle, so a tap feels like it landed.
        // .set rather than .value =, which the React Compiler rejects as a mutation.
        scale.set(
          withSequence(
            withSpring(1.35, { damping: 9, stiffness: 400 }),
            withSpring(1, { damping: 14, stiffness: 260 })
          )
        );
        onChange(star);
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: value === star }}
      accessibilityLabel={`${star} of 5, ${STAR_HINT[star]}`}
      className="rounded-md p-1 active:bg-accent">
      <Animated.View style={style}>
        <StarIcon earned={value !== null && star <= value} className={className} />
      </Animated.View>
    </Pressable>
  );
}

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
      {VALUES.map((star) =>
        onChange ? (
          <StarButton key={star} star={star} value={value} className={starClass} onChange={onChange} />
        ) : (
          <View key={star}>
            <StarIcon earned={value !== null && star <= value} className={starClass} />
          </View>
        )
      )}
    </View>
  );
}
