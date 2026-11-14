import { ChevronRight } from 'lucide-react-native';
import * as React from 'react';
import { I18nManager, Platform, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { deriveTagColors } from '@/lib/tag-colors';
import { cn } from '@/lib/utils';
import type { VenueTag } from '@/lib/venue-tags';

/** The ribbon's height, and the depth of the V cut into its end. */
const HEIGHT = 24;
const NOTCH = 6;

/**
 * The V cut into a ribbon's end: two triangles in the ribbon's colour, drawn
 * with borders so it needs no measuring and no SVG.
 */
function Notch({ color }: { color: string }) {
  const flip = I18nManager.isRTL;
  const side = flip ? 'borderLeftWidth' : 'borderRightWidth';
  const sideColor = flip ? 'borderLeftColor' : 'borderRightColor';
  return (
    <View style={{ width: NOTCH, height: HEIGHT }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: HEIGHT / 2,
          borderTopColor: color,
          [side]: NOTCH,
          [sideColor]: 'transparent',
        }}
      />
      <View
        style={{
          width: 0,
          height: 0,
          borderBottomWidth: HEIGHT / 2,
          borderBottomColor: color,
          [side]: NOTCH,
          [sideColor]: 'transparent',
        }}
      />
    </View>
  );
}

/**
 * A kind of place as a ribbon, after the memorial site's bookmark ribbons:
 * rounded at the start and notched at the end, in the tag's own colours
 * (deriveTagColors - an admin's choice, solved for contrast). One that opens
 * the kind's page carries a chevron before its notch
 * (LavenderBookStyle/oau-style-guide.md, section 13.10).
 */
export function Ribbon({
  tag,
  onPress,
  className,
}: {
  tag: VenueTag;
  onPress?: () => void;
  className?: string;
}) {
  // OAU is light only.
  const colors = deriveTagColors(tag.color, tag.textColor).light;

  const body = (
    <>
      <View
        style={{ backgroundColor: colors.background, height: HEIGHT }}
        className="flex-row items-center gap-0.5 rounded-l-full pl-2.5 pr-1">
        <Text oauStyle="micro" style={{ color: colors.foreground }}>
          {tag.label}
        </Text>
        {onPress ? (
          <Icon as={ChevronRight} color={colors.foreground} className="size-3" />
        ) : null}
      </View>
      <Notch color={colors.background} />
    </>
  );

  if (!onPress) {
    return <View className={cn('flex-row self-start', className)}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tag.label} - see what LavenderBook and visitors know about this place`}
      className={cn(
        'flex-row self-start active:opacity-75',
        Platform.select({ web: 'cursor-pointer' }),
        className
      )}>
      {body}
    </Pressable>
  );
}
