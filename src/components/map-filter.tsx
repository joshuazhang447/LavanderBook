import { BadgeCheck, Check, Layers, Users, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/glass';
import { useLeaveNowReserve } from '@/components/leave-now';
import { MAP_CONTROLS_CLEARANCE } from '@/components/map-controls';
import { useChenfengTopInset } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { Segmented } from '@/components/ui/segmented';
import { Text, TextClassContext } from '@/components/ui/text';
import { LIST_FILTER_TEXT } from '@/lib/directory-text';
import { selectionTick } from '@/lib/haptics';
import { setListFilter, useListFilter, type ListFilter } from '@/lib/list-filter';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/**
 * Which places the map shows - all of them, the ones LavenderBook lists, or the
 * ones visitors found - as a row of chips at the top of the map, under its
 * search, where Google's and Apple's maps keep theirs.
 *
 * The same choice as the list's filter (useListFilter): one filter for the Map
 * tab, so the pins and the list under them never disagree. A warning pin shows
 * whatever is chosen (mapShows): a filter must never hide one.
 */

const ORDER: readonly ListFilter[] = ['all', 'listed', 'visitors'];

/** All: every pin. Listed: checked by LavenderBook. Visitors: people who reviewed it. */
const ICONS: Record<ListFilter, LucideIcon> = {
  all: Layers,
  listed: BadgeCheck,
  visitors: Users,
};

const OAU_SHADOW = Platform.select({ web: 'shadow-[0_3px_8px_rgba(166,134,89,0.35)]' });

function useChoose() {
  const value = useListFilter();
  const choose = React.useCallback(
    (next: ListFilter) => {
      if (next === value) return;
      selectionTick();
      setListFilter(next);
    },
    [value]
  );
  return { value, choose };
}

type ChipProps = {
  filter: ListFilter;
  chosen: boolean;
  onPress: () => void;
};

/** OAU: stickers - cream, an ink outline, the chosen one in the tab's colour. */
function OauChip({ filter, chosen, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      role="radio"
      aria-checked={chosen}
      accessibilityState={{ checked: chosen }}
      accessibilityLabel={LIST_FILTER_TEXT[filter].spoken}
      className={cn(
        'h-9 flex-row items-center gap-1.5 rounded-full border-[1.5px] border-outline-ink px-3.5 active:scale-95',
        chosen ? 'bg-sticker' : 'bg-card',
        OAU_SHADOW,
        Platform.select({ web: 'cursor-pointer transition-transform select-none' })
      )}>
      <Icon as={chosen ? Check : ICONS[filter]} className="size-4 text-foreground" />
      <Text oauStyle="label" className="text-foreground">
        {LIST_FILTER_TEXT[filter].label}
      </Text>
    </Pressable>
  );
}

/**
 * Material: elevated filter chips - a low surface with a shadow over the busy
 * map, the chosen one in the secondary container with its check.
 */
function MaterialChip({ filter, chosen, onPress }: ChipProps) {
  return (
    <TextClassContext.Provider value={chosen ? 'text-secondary-foreground' : 'text-on-surface-variant'}>
      <Pressable
        onPress={onPress}
        role="radio"
        aria-checked={chosen}
        accessibilityState={{ checked: chosen }}
        accessibilityLabel={LIST_FILTER_TEXT[filter].spoken}
        className={cn(
          // The same surface and shadow as the map's controls above them, so
          // they hold their own over the map's colours.
          'h-8 flex-row items-center gap-2 rounded-lg pl-2 pr-4 shadow-md',
          chosen ? 'bg-secondary' : 'bg-background',
          Platform.select({ web: 'cursor-pointer select-none' })
        )}>
        <Icon as={chosen ? Check : ICONS[filter]} className="size-[18px]" />
        <Text type="label-large">{LIST_FILTER_TEXT[filter].label}</Text>
      </Pressable>
    </TextClassContext.Provider>
  );
}

/** Basic: pills like the map's own controls beside them. */
function BasicChip({ filter, chosen, onPress }: ChipProps) {
  return (
    <TextClassContext.Provider value={chosen ? 'text-primary-foreground' : 'text-foreground'}>
      <Pressable
        onPress={onPress}
        role="radio"
        aria-checked={chosen}
        accessibilityState={{ checked: chosen }}
        accessibilityLabel={LIST_FILTER_TEXT[filter].spoken}
        className={cn(
          'h-9 flex-row items-center gap-1.5 rounded-full px-3.5 shadow-md active:opacity-80',
          chosen ? 'bg-primary' : 'bg-background',
          Platform.select({ web: 'cursor-pointer select-none' })
        )}>
        <Icon as={ICONS[filter]} className="size-4" />
        <Text className="text-sm font-medium">{LIST_FILTER_TEXT[filter].label}</Text>
      </Pressable>
    </TextClassContext.Provider>
  );
}

/** The chips themselves, in the skin's own drawing. Placed by the caller. */
export function MapFilterChips({ className }: { className?: string }) {
  const { skin } = useSkin();
  const { value, choose } = useChoose();

  if (skin === 'chenfeng') {
    // iOS: a segmented control on a glass capsule, like the Map | List above it.
    return (
      <Glass radius={20} overMap style={{ height: 40, width: 276, padding: 3 }}>
        <Segmented
          segments={ORDER.map((filter) => ({ value: filter, label: LIST_FILTER_TEXT[filter].title }))}
          value={value}
          onChange={choose}
          accessibilityLabel={LIST_FILTER_TEXT.label}
          drawn
          onGlass
        />
      </Glass>
    );
  }

  const Chip = skin === 'oau' ? OauChip : skin === 'material' ? MaterialChip : BasicChip;
  return (
    <View
      role="radiogroup"
      accessibilityLabel={LIST_FILTER_TEXT.label}
      className={cn('flex-row flex-wrap gap-2', className)}>
      {ORDER.map((filter) => (
        <Chip key={filter} filter={filter} chosen={filter === value} onPress={() => choose(filter)} />
      ))}
    </View>
  );
}

/**
 * The chips floating over the map, under its controls: Basic's and Material's
 * at the left under the controls row, Chenfeng's centred under its Map | List.
 * OAU puts its own under its search bar (oau/map-panel.tsx).
 */
export function FloatingMapFilter() {
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const leaveNow = useLeaveNowReserve();
  const chenfengTop = useChenfengTopInset();

  if (skin === 'chenfeng') {
    // Its controls: 44 tall at topInset + leaveNow + 12 (map-chrome.tsx).
    const top = chenfengTop + leaveNow.top + 12 + 44 + 10;
    return (
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 items-center"
        style={{ top }}>
        <MapFilterChips />
      </View>
    );
  }

  return (
    <View
      pointerEvents="box-none"
      className="absolute right-3"
      style={{ top: insets.top + leaveNow.top + MAP_CONTROLS_CLEARANCE - 4, left: 12 }}>
      <MapFilterChips />
    </View>
  );
}
