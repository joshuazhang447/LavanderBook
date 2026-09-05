import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

import { BottomTabBar, TopTabBar, useIsWideViewport } from '@/components/tab-bar';

export default function TabsLayout() {
  const { isWide, isNarrow } = useIsWideViewport();

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

      {/*
        JSX order is layout order: header above the slot, tab bar below it. No status-bar
        spacer on narrow - the map is meant to run edge to edge under the notch, so screens
        that need to clear it pad themselves.
      */}
      {isWide ? <TopTabBar /> : null}
      <TabSlot />
      {isNarrow ? <BottomTabBar /> : null}
    </Tabs>
  );
}
