import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { selectionTick } from '@/lib/haptics';
import { spring } from '@/lib/motion';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

export const STAR_HINT: Record<number, string> = {
  1: 'Hostile',
  2: 'Unwelcoming',
  3: 'Neutral',
  4: 'Welcoming',
  5: 'Actively welcoming',
};

/** The default scale. Reviews are always out of five; tag questions may differ. */
const DEFAULT_MAX = 5;

/**
 * Pixel sizes matching the size-N classes below. Needed as numbers because a
 * partly-filled star is drawn by clipping a filled copy to a fraction of its
 * width, and a clip needs a concrete width.
 */
const SIZE_PX = { xs: 13, sm: 16, md: 17, lg: 36 } as const;

type Size = keyof typeof SIZE_PX;

/**
 * Chenfeng's sizes follow the text a rating sits with - Footnote in a row,
 * Body in the place card - and its input stars are 34, as the App Store's are.
 */
const CHENFENG_PX: Record<Size, number> = { xs: 13, sm: 15, md: 17, lg: 34 };

const STAR_CLASS: Record<Size, string> = {
  xs: 'size-[13px]',
  sm: 'size-4',
  md: 'size-[17px]',
  lg: 'size-9',
};

const CHENFENG_STAR_CLASS: Record<Size, string> = {
  xs: 'size-[13px]',
  sm: 'size-[15px]',
  md: 'size-[17px]',
  lg: 'size-[34px]',
};

function StarIcon({ earned, className }: { earned: boolean; className: string }) {
  const chenfeng = useSkin().skin === 'chenfeng';
  return (
    <Icon
      as={Star}
      // Gold when earned, a solid grey outline otherwise. Anything fainter
      // disappears against the white sheet. Chenfeng's are system orange, the
      // empty ones the quieter grey iOS uses.
      className={cn(
        className,
        earned ? 'text-star' : chenfeng ? 'text-label-tertiary' : 'text-muted-foreground'
      )}
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
  max,
  className,
  onChange,
}: {
  star: number;
  value: number | null;
  max: number;
  className: string;
  onChange: (value: number) => void;
}) {
  const chenfeng = useSkin().skin === 'chenfeng';
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPress={() => {
        // A small, quickly-damped nudge. Anything larger reads as a jump.
        // .set rather than .value =, which the React Compiler rejects as a mutation.
        // Chenfeng's bounces on .bouncy, with the tick iOS plays for a pick.
        scale.set(
          chenfeng
            ? withSequence(withSpring(1.2, spring('snappy')), withSpring(1, spring('bouncy')))
            : withSequence(
                withSpring(1.15, { damping: 18, stiffness: 450 }),
                withSpring(1, { damping: 20, stiffness: 300 })
              )
        );
        if (chenfeng) selectionTick();
        onChange(star);
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: value === star }}
      // The hints describe friendliness out of five. A rating question with
      // its own max is a different scale, and "6 of 8, undefined" helps nobody.
      accessibilityLabel={max === 5 ? `${star} of 5, ${STAR_HINT[star]}` : `${star} of ${max}`}
      // No grey box behind a pressed star in Chenfeng: iOS has none.
      className={chenfeng ? 'p-1 active:opacity-60' : 'rounded-md p-1 active:bg-accent'}>
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
  size?: Size;
  /**
   * How many stars. Five everywhere in the app itself - a review's friendliness
   * rating is out of five by definition - but a `rating` tag question carries
   * its own max in config, so this has to be a parameter rather than a constant.
   */
  max?: number;
};

/**
 * One component for both the editable rating in the sheet and the read-only row
 * in the list, so the two can never drift out of step.
 */
export function StarRating({ value, onChange, size = 'lg', max = DEFAULT_MAX }: StarRatingProps) {
  const chenfeng = useSkin().skin === 'chenfeng';
  const starClass = (chenfeng ? CHENFENG_STAR_CLASS : STAR_CLASS)[size];
  const sizePx = (chenfeng ? CHENFENG_PX : SIZE_PX)[size];
  const stars = Array.from({ length: Math.max(1, Math.round(max)) }, (_, index) => index + 1);

  return (
    <View
      className={cn(
        'flex-row',
        chenfeng ? (size === 'lg' ? 'gap-0' : 'gap-px') : size === 'lg' ? 'gap-1' : 'gap-0.5'
      )}
      // Read-only, Chenfeng reads it as one element: "4.3 out of 5 stars".
      {...(chenfeng && !onChange
        ? {
            accessible: true,
            accessibilityLabel:
              value === null ? 'Not rated' : `${Number(value.toFixed(1))} out of ${stars.length} stars`,
          }
        : null)}>
      {stars.map((star) =>
        onChange ? (
          // Picking a rating is always a whole star; only averages are fractional.
          <StarButton
            key={star}
            star={star}
            value={value}
            max={stars.length}
            className={starClass}
            onChange={onChange}
          />
        ) : (
          <View key={star}>
            <PartialStar
              fraction={value === null ? 0 : Math.min(Math.max(value - (star - 1), 0), 1)}
              className={starClass}
              sizePx={sizePx}
            />
          </View>
        )
      )}
    </View>
  );
}
