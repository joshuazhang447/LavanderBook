import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { CircleUser, Map as MapIcon, type LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * The tabs, in display order. Each `name` MUST match a <TabTrigger name> in the
 * hidden <TabList> of src/app/(tabs)/_layout.tsx — a mismatch gives no error, no
 * focus state, and a dead tap.
 *
 * Lucide's `Map` export shadows the JS Map global, hence the alias.
 */
const TABS = [
  { name: 'map', label: 'Map', icon: MapIcon },
  { name: 'account', label: 'My Account', icon: CircleUser },
] as const satisfies readonly { name: string; label: string; icon: LucideIcon }[];

export type TabName = (typeof TABS)[number]['name'];

export const WIDE_BREAKPOINT = 768;

/**
 * Wide viewports get the header row, narrow ones the bottom bar. Screens need
 * this too: the layout no longer pads for the status bar, so each screen
 * decides whether to sit under it (the map) or clear it (everything else).
 */
export function useIsWideViewport() {
  const { width } = useWindowDimensions();
  return {
    isWide: width >= WIDE_BREAKPOINT,
    // width is 0 during the static web prerender - treat that as unknown.
    isNarrow: width > 0 && width < WIDE_BREAKPOINT,
  };
}

type TabButtonProps = TabTriggerSlotProps & {
  icon: LucideIcon;
  label: string;
  showLabel?: boolean;
};

function TabButton({
  icon,
  label,
  showLabel,
  isFocused,
  // TabTrigger injects style={{flexDirection:'row',justifyContent:'space-between'}} through
  // the Slot. An inline style beats className in NativeWind, so drop it and lay out with
  // classes instead. Do not "clean up" this unused binding.
  style: _injected,
  ...rest
}: TabButtonProps) {
  const textClass = isFocused ? 'text-primary font-semibold' : 'text-muted-foreground';

  return (
    <TextClassContext.Provider value={textClass}>
      <Pressable
        {...rest}
        role="tab"
        // aria-selected works on both: React Native maps it to accessibilityState.selected
        // on native, and react-native-web writes the DOM attribute directly.
        aria-selected={!!isFocused}
        aria-label={label}
        className={cn(
          'flex-row items-center justify-center gap-2 rounded-md px-3 py-2',
          'active:bg-accent',
          Platform.select({ web: 'cursor-pointer transition-colors hover:bg-accent' })
        )}>
        <Icon as={icon} className="size-6" />
        {showLabel ? <Text className="text-sm">{label}</Text> : null}
      </Pressable>
    </TextClassContext.Provider>
  );
}

/** Wide viewports: a header row — app name left, icon + label tabs right. */
export function TopTabBar() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}
      className="border-b border-border bg-background">
      <View className="h-14 w-full max-w-5xl flex-row items-center justify-between self-center px-6">
        <Text className="text-lg font-semibold text-foreground">LavenderBook</Text>
        <View className="flex-row items-center gap-1">
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} asChild>
              <TabButton icon={tab.icon} label={tab.label} showLabel />
            </TabTrigger>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Narrow viewports: a bottom bar, icons only. */
export function BottomTabBar() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      className="border-t border-border bg-background">
      <View className="h-14 flex-row items-center justify-around">
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <TabButton icon={tab.icon} label={tab.label} />
          </TabTrigger>
        ))}
      </View>
    </View>
  );
}
