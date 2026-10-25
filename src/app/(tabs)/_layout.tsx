import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { Platform } from 'react-native';

import { BackdropView, GlassBackdrop, useBackdrop } from '@/components/glass';
import { LeaveNowHeaderSpace } from '@/components/leave-now';
import { BottomTabBar, TopTabBar, useIsWideViewport } from '@/components/tab-bar';

export default function TabsLayout() {
  const { isWide, isNarrow } = useIsWideViewport();
  const screens = useBackdrop();

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
      {isWide ? <TopTabBar trailing={<LeaveNowHeaderSpace />} /> : null}
      {/*
        detachInactiveScreens defaults to true, which tears the map's native view
        down while you are on another tab. A camera move issued during the
        re-attach window is silently dropped - which is why Locate moved the map
        only sometimes. Two screens is cheap to keep alive.

        Native only. react-native-screens' web Screen drops the style prop
        outright on its not-detaching path, discarding both expo-router's
        `flex: 1, height: 100%` - so no screen is height-bounded and nothing on
        one can scroll - and the `display: none` that hides the inactive tab.
        The web map is a DOM node that survives being hidden anyway, so it has
        nothing to gain here.
      */}
      {/*
        flexShrink overrides expo-router's own `flexShrink: 0` on this container.
        With it at 0 the container grows to fit its content instead of being
        bounded by the window, so a screen taller than the viewport overflows it
        and a ScrollView inside can never scroll - it is handed the full content
        height and has nothing left to scroll. Shrinking keeps it window-sized.
      */}
      {/* What the tab bar's glass blurs on Android: the screen under it. No
          view at all on the website or iOS - see BackdropView. */}
      <BackdropView backdropRef={screens.ref} style={{ flex: 1 }}>
        <TabSlot
          detachInactiveScreens={Platform.OS === 'web'}
          style={{ flexShrink: 1 }}
        />
      </BackdropView>
      <GlassBackdrop target={screens.target}>
        {isNarrow ? <BottomTabBar /> : null}
      </GlassBackdrop>
    </Tabs>
  );
}
