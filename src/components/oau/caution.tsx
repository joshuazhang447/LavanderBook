import { TriangleAlert, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useDisplaySettings } from '@/lib/accessibility';
import { oauTabColor } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Caution paper (LavenderBookStyle/oau-style-guide.md, section 13.13): the
 * memorial's warning box - a soft brick fill with 45 degree stripes, a 3 pt
 * brick rule down its leading edge, the warning glyph and the title in brick,
 * the words in ink. For a review waiting for a person, the free text's
 * warning, an error that stopped something. Plain fill under more contrast.
 */
export function CautionPaper({
  title,
  icon = TriangleAlert,
  children,
  className,
}: React.PropsWithChildren<{ title?: string; icon?: LucideIcon; className?: string }>) {
  const { highContrast } = useDisplaySettings();
  const id = `oau-caution-${React.useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  return (
    <View className={cn('overflow-hidden rounded-[18px] bg-caution', className)}>
      {highContrast ? null : (
        // The View hides it from screen readers: the SVG would hand those
        // props to the website's DOM, which does not know them.
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height="100%">
            <Defs>
              <Pattern
                id={id}
                patternUnits="userSpaceOnUse"
                width="20"
                height="20"
                patternTransform="rotate(45)">
                <Rect x="0" y="0" width="10" height="20" fill={oauTabColor('map', 'caution-stripe')} />
              </Pattern>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
        </View>
      )}
      <View className="absolute bottom-0 left-0 top-0 w-[3px] bg-caution-foreground" />
      <View className="flex-row items-start gap-2.5 py-3.5 pl-[18px] pr-4">
        <Icon as={icon} className="mt-0.5 size-5 text-caution-foreground" />
        <View className="flex-1 gap-1">
          {title ? (
            <Text oauStyle="label" className="text-caution-foreground">
              {title}
            </Text>
          ) : null}
          {children}
        </View>
      </View>
    </View>
  );
}
