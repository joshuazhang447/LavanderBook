import { List, LocateFixed, Map as MapIcon, RotateCw } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

type MapControlsProps = {
  mode: MapViewMode;
  onChangeMode: (mode: MapViewMode) => void;
  onRefresh: () => void;
  refreshing: boolean;
};

/**
 * Map / List / Refresh, floating over the top-left of the map.
 *
 * The tabs layout adds no top padding - the map runs edge to edge under the
 * notch on purpose - so this clears the status bar itself.
 */
export function MapControls({ mode, onChangeMode, onRefresh, refreshing }: MapControlsProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ top: insets.top + 12, left: 12 }}
      className="absolute flex-row gap-2">
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
          <Icon as={RotateCw} className={cn('size-4', refreshing && 'opacity-40')} />
        </Control>
      </View>
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
