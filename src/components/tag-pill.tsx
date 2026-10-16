import { ChevronRight } from 'lucide-react-native';
import { Pressable, useColorScheme, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSkin } from '@/lib/skin';
import { deriveTagColors } from '@/lib/tag-colors';
import { cn } from '@/lib/utils';
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
  // Chenfeng: a 24 pt capsule, Footnote semibold, its chevron 11 pt - and the
  // colours still the admin's: tags are content, not chrome.
  const chenfeng = useSkin().skin === 'chenfeng';
  const label = chenfeng ? 'text-[13px] font-semibold leading-4' : 'text-xs font-medium';

  if (!onPress) {
    return (
      <View
        style={{ backgroundColor: colors.background }}
        className={cn('flex-row items-center rounded-full py-1', chenfeng ? 'px-2.5' : 'px-2.5')}>
        <Text style={{ color: colors.foreground }} className={label}>
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
      className={cn(
        'flex-row items-center gap-0.5 rounded-full py-1 pl-2.5',
        chenfeng ? 'pr-2 active:opacity-75' : 'pr-1 active:opacity-80'
      )}>
      <Text style={{ color: colors.foreground }} className={label}>
        {tag.label}
      </Text>
      <Icon
        as={ChevronRight}
        color={colors.foreground}
        weight="semibold"
        className={chenfeng ? 'size-[11px]' : 'size-3.5'}
      />
    </Pressable>
  );
}
