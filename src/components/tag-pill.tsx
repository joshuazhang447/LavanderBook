import { ChevronRight } from 'lucide-react-native';
import { Pressable, useColorScheme, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { deriveTagColors } from '@/lib/tag-colors';
import type { VenueTag } from '@/lib/venue-tags';

type TagPillProps = {
  tag: VenueTag;
  /** Absent when there is nothing behind the tag to open. */
  onPress?: () => void;
};

/**
 * One tag, in its own colours.
 *
 * Inline `style` for the two colours rather than `className`, which is the
 * documented exception: they are values an admin stored, and Tailwind cannot
 * emit a class for a string it has never seen.
 *
 * The chevron is the whole point of the pressable variant - a coloured pill is
 * read as a label, not as a control, unless something says otherwise. A tag
 * with no notes behind it therefore gets no chevron and no press, rather than
 * an affordance that leads nowhere.
 */
export function TagPill({ tag, onPress }: TagPillProps) {
  // Safe despite the static-web caveat in AGENTS.md: this sheet only exists
  // after someone taps a marker, so it is never in prerendered HTML.
  const scheme = useColorScheme();
  const colors = deriveTagColors(tag.color, tag.textColor)[scheme === 'dark' ? 'dark' : 'light'];

  if (!onPress) {
    return (
      <View
        style={{ backgroundColor: colors.background }}
        className="flex-row items-center rounded-full px-2.5 py-1">
        <Text style={{ color: colors.foreground }} className="text-xs font-medium">
          {tag.label}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tag.label} - see what LavenderBook and visitors know about this place`}
      style={{ backgroundColor: colors.background }}
      className="flex-row items-center gap-0.5 rounded-full py-1 pl-2.5 pr-1 active:opacity-80">
      <Text style={{ color: colors.foreground }} className="text-xs font-medium">
        {tag.label}
      </Text>
      <Icon as={ChevronRight} color={colors.foreground} className="size-3.5" />
    </Pressable>
  );
}
