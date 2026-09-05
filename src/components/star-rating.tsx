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

/**
 * Pixel sizes matching the size-N classes below. Needed as numbers because a
 * partly-filled star is drawn by clipping a filled copy to a fraction of its
 * width, and a clip needs a concrete width.
 */
const SIZE_PX = { sm: 16, lg: 36 } as const;

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

/**
 * A star filled `fraction` of the way across.
 *
 * Two stacked copies with the filled one clipped, rather than lucide's StarHalf
 * - that icon traces only the left half's outline, so on its own it renders as a
 * floating half shape with no right-hand edge. This also handles 3.7 as easily
 * as 3.5.
 */
function PartialStar({
  fraction,
  className,
  sizePx,
}: {
  fraction: number;
  className: string;
  sizePx: number;
}) {
  if (fraction <= 0) return <StarIcon earned={false} className={className} />;
  if (fraction >= 1) return <StarIcon earned className={className} />;

  return (
    <View style={{ width: sizePx, height: sizePx }}>
      <StarIcon earned={false} className={className} />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: sizePx,
          width: sizePx * fraction,
          overflow: 'hidden',
        }}>
        <StarIcon earned className={className} />
      </View>
    </View>
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
        // A small, quickly-damped nudge. Anything larger reads as a jump.
        // .set rather than .value =, which the React Compiler rejects as a mutation.
        scale.set(
          withSequence(
            withSpring(1.15, { damping: 18, stiffness: 450 }),
            withSpring(1, { damping: 20, stiffness: 300 })
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
          // Picking a rating is always a whole star; only averages are fractional.
          <StarButton key={star} star={star} value={value} className={starClass} onChange={onChange} />
        ) : (
          <View key={star}>
            <PartialStar
              fraction={value === null ? 0 : Math.min(Math.max(value - (star - 1), 0), 1)}
              className={starClass}
              sizePx={SIZE_PX[size]}
            />
          </View>
        )
      )}
    </View>
  );
}
