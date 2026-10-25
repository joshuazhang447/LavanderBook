import { Portal } from '@rn-primitives/portal';
import type { LucideIcon } from 'lucide-react-native';
import { Check } from 'lucide-react-native';
import * as React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type View as ViewType,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, GlassBackdrop } from '@/components/glass';
import { useElevatedSurface } from '@/components/skin-provider';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useDisplaySettings } from '@/lib/accessibility';
import { spring } from '@/lib/motion';
import { CONTINUOUS } from '@/lib/shape';
import { cn } from '@/lib/utils';

/**
 * Chenfeng's menus, drawn (guideline section 13.14): a glass panel that grows
 * out of whatever opened it - a button, or a row held down - with the symbols
 * in a leading column (iOS 26 moved them there), groups set apart by a gap
 * rather than a line, and anything destructive in red, last. Used for a
 * review's actions in Account, and for a choice among six or more options.
 *
 * @expo/ui's Menu and ContextMenu are the native versions on iOS; they wait
 * for a device to check them on.
 */

export type MenuItem = {
  label: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** The current value, in a picker: a checkmark in the leading column. */
  checked?: boolean;
  destructive?: boolean;
  onPress: () => void;
};

export type MenuAnchor = { x: number; y: number; width: number; height: number };

/** Where a view is on screen, for a menu to open from it. */
export function measureAnchor(view: ViewType | null): Promise<MenuAnchor | null> {
  return new Promise((resolve) => {
    if (!view) {
      resolve(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

const MENU_WIDTH = 250;
const ROW_HEIGHT = 46;
const GAP = 8;
const EDGE = 16;

type MenuProps = {
  /** Null: closed. */
  anchor: MenuAnchor | null;
  groups: MenuItem[][];
  onClose: () => void;
  /** Read out as the menu's name. */
  accessibilityLabel: string;
  /** A long press on a row opened it: the rest of the screen dims a little. */
  contextual?: boolean;
};

export function Menu({ anchor, groups, onClose, accessibilityLabel, contextual }: MenuProps) {
  if (!anchor) return null;
  return (
    <Portal name="chenfeng-menu">
      {/* Drawn glass: a menu opens over whatever its row is on - a sheet as
          often as the map - and Android can only blur the screens beneath
          every sheet, which would show through the one it was opened from. */}
      <GlassBackdrop target={null}>
        <OpenMenu
          anchor={anchor}
          groups={groups.filter((group) => group.length > 0)}
          onClose={onClose}
          accessibilityLabel={accessibilityLabel}
          contextual={contextual}
        />
      </GlassBackdrop>
    </Portal>
  );
}

function OpenMenu({
  anchor,
  groups,
  onClose,
  accessibilityLabel,
  contextual,
}: MenuProps & { anchor: MenuAnchor }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const elevated = useElevatedSurface();
  const { reduceMotion } = useDisplaySettings();

  const rows = groups.reduce((count, group) => count + group.length, 0);
  const natural = rows * ROW_HEIGHT + (groups.length - 1) * GAP;
  const below = height - insets.bottom - (anchor.y + anchor.height) - GAP - EDGE;
  const above = anchor.y - insets.top - GAP - EDGE;
  const opensDown = below >= Math.min(natural, 280) || below >= above;
  const room = Math.max(120, opensDown ? below : above);
  const menuHeight = Math.min(natural, room);
  const menuWidth = Math.min(MENU_WIDTH, width - EDGE * 2);
  // Lined up with the side of the control nearer the screen's middle.
  const leading = anchor.x + anchor.width / 2 < width / 2;
  const left = Math.min(
    Math.max(EDGE, leading ? anchor.x : anchor.x + anchor.width - menuWidth),
    width - EDGE - menuWidth
  );
  const top = opensDown ? anchor.y + anchor.height + GAP : anchor.y - GAP - menuHeight;

  // It grows out of its control: from that corner, with .snappy.
  const shown = useSharedValue(0);
  React.useEffect(() => {
    shown.set(reduceMotion ? withTiming(1, { duration: 180 }) : withSpring(1, spring('snappy')));
  }, [shown, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get() * 1.4),
    transform: reduceMotion
      ? []
      : [
          { translateX: (leading ? -1 : 1) * (menuWidth / 2) * (1 - shown.get()) },
          { translateY: (opensDown ? -1 : 1) * (menuHeight / 2) * (1 - shown.get()) },
          { scale: 0.6 + 0.4 * shown.get() },
        ],
  }));

  // Nearest the finger first: a menu opening upwards lists from the bottom up.
  const ordered = opensDown ? groups : [...groups].reverse().map((group) => [...group].reverse());

  const rendered = ordered.map((group, groupIndex) => (
    // A menu's shadow is deeper than a button's; it goes on a rounded
    // wrapper so it follows the corners rather than the column's box.
    <View
      key={groupIndex}
      style={[{ borderRadius: 26, boxShadow: '0px 10px 32px rgba(0, 0, 0, 0.18)' }, CONTINUOUS]}>
      <Glass radius={26} className="overflow-hidden" style={CONTINUOUS}>
        <View className="bg-popover/60">
          {group.map((item) => (
            <MenuRow
              key={item.label}
              item={item}
              onChosen={() => {
                onClose();
                item.onPress();
              }}
            />
          ))}
        </View>
      </Glass>
    </View>
  ));

  return (
    <View className="absolute inset-0" pointerEvents="box-none">
      <Pressable
        className={cn('absolute inset-0', contextual && 'bg-black/10 dark:bg-black/30')}
        onPress={onClose}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Animated.View
        role="menu"
        aria-label={accessibilityLabel}
        accessibilityViewIsModal
        className={elevated.className}
        style={[
          { position: 'absolute', left, top, width: menuWidth, maxHeight: menuHeight },
          elevated.style,
          style,
        ]}>
        {/* A scroll view only when it has to scroll: its box clips the
            groups' shadows to a hard edge. */}
        {natural > menuHeight ? (
          <ScrollView contentContainerClassName="gap-2">{rendered}</ScrollView>
        ) : (
          <View className="gap-2">{rendered}</View>
        )}
      </Animated.View>
    </View>
  );
}

function MenuRow({ item, onChosen }: { item: MenuItem; onChosen: () => void }) {
  const color = item.destructive ? 'text-destructive' : 'text-foreground';
  const leading = item.checked ? Check : item.icon;
  return (
    <Pressable
      onPress={onChosen}
      role="menuitem"
      aria-checked={item.checked}
      accessibilityLabel={item.subtitle ? `${item.label}, ${item.subtitle}` : item.label}
      style={{ minHeight: ROW_HEIGHT }}
      className={cn(
        'flex-row items-center gap-2.5 px-4 py-2 active:bg-fill',
        Platform.select({
          web: 'cursor-pointer select-none outline-none hover:bg-fill-tertiary focus-visible:bg-fill-tertiary',
        })
      )}>
      <View className="w-5 items-center">
        {leading ? (
          <Icon
            as={leading}
            size={17}
            weight={item.checked ? 'semibold' : 'regular'}
            strokeWidth={item.checked ? 2.5 : 2}
            className={color}
          />
        ) : null}
      </View>
      <View className="flex-1">
        <Text textStyle="body" numberOfLines={2} className={color}>
          {item.label}
        </Text>
        {item.subtitle ? (
          <Text textStyle="footnote" numberOfLines={2} className="text-label-secondary">
            {item.subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
