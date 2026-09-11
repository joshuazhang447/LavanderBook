import { List, LocateFixed, Map as MapIcon, RotateCw } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useIsWideViewport } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type MapViewMode = 'map' | 'list';

type ControlProps = {
  active?: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  className?: string;
};

function Control({ active, label, onPress, children, className }: ControlProps) {
  return (
    <TextClassContext.Provider
      value={active ? 'text-primary-foreground' : 'text-foreground'}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!active }}
        className={cn(
          'flex-row items-center gap-1.5 rounded-full px-3 py-2 active:opacity-70',
          active ? 'bg-primary' : 'bg-background',
          className
        )}>
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

/** One full turn per cycle, fast enough to read as activity, slow enough to follow. */
const SPIN_MS = 700;

/** Matches EXPAND_MS in map-search.tsx, so giving way and growing are one move. */
const YIELD_MS = 220;

function RefreshIcon({ spinning }: { spinning: boolean }) {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (spinning) {
      rotation.set(0);
      rotation.set(
        withRepeat(withTiming(360, { duration: SPIN_MS, easing: Easing.linear }), -1, false)
      );
    } else {
      cancelAnimation(rotation);
      rotation.set(withTiming(0, { duration: 150 }));
    }
  }, [spinning, rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <Animated.View style={style}>
      <Icon as={RotateCw} className="size-5" />
    </Animated.View>
  );
}

type MapControlsProps = {
  mode: MapViewMode;
  onChangeMode: (mode: MapViewMode) => void;
  onRefresh: () => void;
  /** Driven only by pressing this button, never by background refetches. */
  refreshing: boolean;
  /**
   * Rendered at the end of the row. The search pill lives here rather than in
   * this file because it expands into the space left on screen, and only the
   * thing that expands should have to know how much that is.
   */
  children?: React.ReactNode;
  /**
   * Whether that search pill is expanded. A narrow screen cannot show both it
   * and these buttons, so on a phone these give way while it is open.
   */
  searchOpen?: boolean;
};

/**
 * Map / List / Refresh, floating over the top-left of the map.
 *
 * The tabs layout adds no top padding - the map runs edge to edge under the
 * notch on purpose - so this clears the status bar itself.
 */
/**
 * Vertical space the floating controls occupy below the status bar: the 12pt
 * offset above them, the 44pt control row, and a 12pt gap under it.
 *
 * They are absolutely positioned, so they overlap whatever shares the screen.
 * That is the point in map mode; content that must sit clear of them (the list)
 * pads its top by this.
 */
export const MAP_CONTROLS_CLEARANCE = 68;

export function MapControls({
  mode,
  onChangeMode,
  onRefresh,
  refreshing,
  children,
  searchOpen = false,
}: MapControlsProps) {
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();

  /**
   * On a phone the row cannot hold these and an open search field: the field
   * would be squeezed to a couple of words, or run off the right edge. So they
   * stand down for as long as it is open, which also puts the field at the left
   * margin where a text field belongs. A wide viewport has room for both.
   */
  const yieldToSearch = searchOpen && !isWide;

  // Measured once at natural size, then held, so collapsing to zero has a
  // number to animate from and the buttons inside never reflow on the way out.
  const [groupWidth, setGroupWidth] = React.useState(0);

  const collapse = useSharedValue(0);
  React.useEffect(() => {
    collapse.set(
      withTiming(yieldToSearch ? 1 : 0, {
        // Same curve and duration as the field's expand, so the two read as one
        // movement rather than two things happening near each other.
        duration: YIELD_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [yieldToSearch, collapse]);

  const groupStyle = useAnimatedStyle(() => ({
    width: groupWidth === 0 ? undefined : groupWidth * (1 - collapse.get()),
    opacity: 1 - collapse.get(),
  }));

  return (
    <View
      pointerEvents="box-none"
      style={{ top: insets.top + 12, left: 12 }}
      // No gap: the spacing lives inside the collapsing group as pr-2, so it
      // animates away too rather than leaving the search pill off the margin.
      className="absolute flex-row">
      {/* py/-my: the clip that makes the collapse work would otherwise cut the
          pills' own shadow off square, which reads as a grey box behind them.
          The padding gives the shadow somewhere to land; the matching negative
          margin keeps the row's geometry exactly as it was. */}
      <Animated.View style={groupStyle} className="overflow-hidden py-3 -my-3">
        <View
          onLayout={(event) => {
            const measured = event.nativeEvent.layout.width;
            if (measured > 0 && groupWidth === 0) setGroupWidth(measured);
          }}
          style={groupWidth > 0 ? { width: groupWidth } : undefined}
          className="flex-row gap-2 pr-2">
          <View className="flex-row gap-1 rounded-full bg-background p-1 shadow-md">
            <Control
              active={mode === 'map'}
              label="Map view"
              onPress={() => onChangeMode('map')}>
              <Icon as={MapIcon} className="size-4" />
              <Text className="text-sm font-medium">Map</Text>
            </Control>
            <Control
              active={mode === 'list'}
              label="List view"
              onPress={() => onChangeMode('list')}>
              <Icon as={List} className="size-4" />
              <Text className="text-sm font-medium">List</Text>
            </Control>
          </View>

          <View className="rounded-full bg-background p-1 shadow-md">
            <Control label={refreshing ? 'Refreshing' : 'Refresh'} onPress={onRefresh}>
              <RefreshIcon spinning={refreshing} />
            </Control>
          </View>
        </View>
      </Animated.View>

      {children}
    </View>
  );
}

type RecenterButtonProps = {
  following: boolean;
  onPress: () => void;
};

/**
 * Bottom-right, where both Google and Apple put it. Filled while following, so
 * the button doubles as the indicator for whether the map is tracking you.
 */
export function RecenterButton({ following, onPress }: RecenterButtonProps) {
  return (
    <View pointerEvents="box-none" className="absolute bottom-5 right-4">
      <TextClassContext.Provider
        value={following ? 'text-primary-foreground' : 'text-foreground'}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={following ? 'Following your location' : 'Recentre on your location'}
          accessibilityState={{ selected: following }}
          className={cn(
            'size-12 items-center justify-center rounded-full shadow-md active:opacity-70',
            following ? 'bg-primary' : 'bg-background'
          )}>
          <Icon as={LocateFixed} className="size-5" />
        </Pressable>
      </TextClassContext.Provider>
    </View>
  );
}
