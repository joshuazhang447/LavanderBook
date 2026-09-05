import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar, TopTabBar } from '@/components/tab-bar';

const WIDE_BREAKPOINT = 768;

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // width is 0 during the static web prerender, where there is no window. Treat that as
  // "unknown" and render neither bar, so the HTML never ships the wrong one.
  const isWide = width >= WIDE_BREAKPOINT;
  const isNarrow = width > 0 && width < WIDE_BREAKPOINT;

  return (
    <Tabs>
      {/*
        Route declarations. Hidden, but ALWAYS rendered and ALWAYS a direct child of <Tabs>:
        expo-router discovers routes by walking Fragment -> TabList -> TabTrigger, so this
        cannot move into a wrapper. Keeping it unconditional means crossing the breakpoint
        swaps only the bar — the navigator is never rebuilt and screens keep their state.
      */}
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="map" href="/" />
        <TabTrigger name="account" href="/account" />
      </TabList>

      {/* JSX order is layout order: header above the slot, tab bar below it. */}
      {isWide ? <TopTabBar /> : <View style={{ height: insets.top }} className="bg-background" />}
      <TabSlot />
      {isNarrow ? <BottomTabBar /> : null}
    </Tabs>
  );
}
