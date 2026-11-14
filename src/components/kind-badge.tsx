import type { LucideIcon } from 'lucide-react-native';
import { useColorScheme, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { CONTINUOUS } from '@/lib/shape';
import { deriveTagColors } from '@/lib/tag-colors';
import type { VenueTag } from '@/lib/venue-tags';

type KindBadgeProps = {
  /** Whose colours. None: the app's own, for "Everything". */
  tag?: VenueTag;
  icon: LucideIcon;
  size?: number;
  /** Chenfeng's settings-tile square, rather than a circle. */
  square?: boolean;
};

/**
 * A kind of place's symbol, in that kind's own colours - the same pair its tag
 * pill is drawn in on every row, so a kind chosen in the Directory and the
 * pills on the places it lists are visibly the same thing.
 *
 * Inline `style` for the colours: they are values an admin stored, and
 * Tailwind cannot emit a class for a string it has never seen (as TagPill).
 */
export function KindBadge({ tag, icon, size = 40, square }: KindBadgeProps) {
  const scheme = useColorScheme();
  const colors = tag
    ? deriveTagColors(tag.color, tag.textColor)[scheme === 'dark' ? 'dark' : 'light']
    : null;

  return (
    <View
      className={colors ? 'items-center justify-center' : 'items-center justify-center bg-primary'}
      style={[
        {
          width: size,
          height: size,
          borderRadius: square ? Math.round(size * 0.27) : size / 2,
        },
        square ? CONTINUOUS : null,
        colors ? { backgroundColor: colors.background } : null,
      ]}>
      <Icon
        as={icon}
        size={Math.round(size * 0.5)}
        weight="medium"
        color={colors?.foreground}
        className={colors ? undefined : 'text-primary-foreground'}
      />
    </View>
  );
}
