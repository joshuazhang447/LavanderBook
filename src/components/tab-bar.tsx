import { TabTrigger, useTabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { CircleUser, Map as MapIcon, Search, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import type { ReactNode } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, GlassGroup, GlassWash, useGlassPress } from '@/components/glass';
import { LogoImage } from '@/components/logo-image';
import { OauHeaderCredit } from '@/components/oau-badge';
import { Icon } from '@/components/ui/icon';
import { Text, TextClassContext } from '@/components/ui/text';
import { useDisplaySettings } from '@/lib/accessibility';
import { BOOK_MARK } from '@/lib/logos';
import { openMapSearch, useMapSearchOpen } from '@/lib/map-search-state';
import { stateLayerOpacity } from '@/lib/material';
import { materialSpring, spring } from '@/lib/motion';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/**
 * The tabs, in display order. Each `name` MUST match a <TabTrigger name> in the
 * hidden <TabList> of src/app/(tabs)/_layout.tsx — a mismatch gives no error, no
 * focus state, and a dead tap.
 *
 * Lucide's `Map` export shadows the JS Map global, hence the alias.
 */
const TABS = [
  { name: 'map', label: 'Map', chenfengLabel: 'Map', icon: MapIcon },
  // iOS uses possessives sparingly: Chenfeng says "Account".
  { name: 'account', label: 'My Account', chenfengLabel: 'Account', icon: CircleUser },
] as const satisfies readonly {
  name: string;
  label: string;
  chenfengLabel: string;
  icon: LucideIcon;
}[];

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

/**
 * Wide viewports: a header row — app name left, icon + label tabs right.
 *
 * `trailing` goes after the tabs: the layout passes the space the website's
 * "Leave now" button is drawn over (it lives outside the tabs so nothing can
 * cover it, and is passed in so this file need not import it).
 */
export function TopTabBar({ trailing }: { trailing?: ReactNode }) {
  const { skin } = useSkin();
  if (skin === 'chenfeng') return <ChenfengTopBar trailing={trailing} />;
  return <BasicTopBar trailing={trailing} />;
}

/** Basic and Material: the book and the name, OAU's credit, then the tabs. */
function BasicTopBar({ trailing }: { trailing?: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}
      className="border-b border-border bg-background">
      <View className="h-14 w-full max-w-5xl flex-row items-center justify-between self-center px-6">
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-2">
            <LogoImage logo={BOOK_MARK} />
            <Text className="text-lg font-semibold text-foreground">LavenderBook</Text>
          </View>
          <OauHeaderCredit />
        </View>
        <View className="flex-row items-center gap-1">
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} asChild>
              <TabButton icon={tab.icon} label={tab.label} showLabel />
            </TabTrigger>
          ))}
          {trailing}
        </View>
      </View>
    </View>
  );
}

/**
 * Narrow viewports: a bottom bar, drawn per skin. Only Chenfeng's floats over
 * the screen; the others take their own space below it.
 */
export function BottomTabBar() {
  const { skin } = useSkin();
  if (skin === 'material') return <MaterialTabBar />;
  if (skin === 'chenfeng') return <GlassTabBar />;
  return <BasicTabBar />;
}

/** Basic: icons only. */
function BasicTabBar() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      className="border-t border-border bg-background">
      {/* Bar height. h-11 = 48px; h-14 was 56. The safe-area inset below is on top of this. */}
      <View className="h-11 flex-row items-center justify-around">
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <TabButton icon={tab.icon} label={tab.label} />
          </TabTrigger>
        ))}
      </View>
    </View>
  );
}

/** Material 3 Expressive's indicator pill (NavigationBarVerticalItemTokens). */
const PILL_WIDTH = 56;
const PILL_HEIGHT = 32;

/**
 * One Material destination (docs/material-design-guideline.md, section 13.1):
 * the icon in a 56 x 32 pill that grows out from the icon's centre when the tab
 * becomes current, a state layer on the pill while pressed or hovered, and the
 * label under it. The pill's corners are a style, not rounded-full: the class
 * left them square on Android.
 */
function MaterialTab({
  icon,
  label,
  isFocused,
  // Dropped for the same reason as in TabButton. Do not "clean up".
  style: _injected,
  ...rest
}: TabButtonProps) {
  const { reduceMotion } = useDisplaySettings();
  const shown = useSharedValue(isFocused ? 1 : 0);

  React.useEffect(() => {
    shown.set(withSpring(isFocused ? 1 : 0, materialSpring('fastSpatial', reduceMotion)));
  }, [isFocused, shown, reduceMotion]);

  const pill = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get() * 2),
    transform: [{ scaleX: Math.max(0, shown.get()) }],
  }));

  return (
    <Pressable
      {...rest}
      role="tab"
      aria-selected={!!isFocused}
      aria-label={label}
      className={cn('flex-1 items-center justify-center', Platform.select({ web: 'cursor-pointer' }))}>
      {(state) => (
        <>
          <View
            style={{ width: PILL_WIDTH, height: PILL_HEIGHT, borderRadius: PILL_HEIGHT / 2 }}
            className="items-center justify-center">
            <Animated.View
              className="absolute inset-0 bg-secondary-container"
              style={[{ borderRadius: PILL_HEIGHT / 2 }, pill]}
            />
            <View
              pointerEvents="none"
              className={cn(
                'absolute inset-0',
                isFocused ? 'bg-on-secondary-container' : 'bg-on-surface'
              )}
              style={{
                borderRadius: PILL_HEIGHT / 2,
                opacity: stateLayerOpacity(state as Parameters<typeof stateLayerOpacity>[0]),
              }}
            />
            <Icon
              as={icon}
              size={24}
              className={isFocused ? 'text-on-secondary-container' : 'text-on-surface-variant'}
            />
          </View>
          <Text
            type="label-medium"
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            className={cn('mt-1', isFocused ? 'text-m3-secondary' : 'text-on-surface-variant')}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/**
 * Material: Material 3 Expressive's flexible navigation bar - 64 tall on the
 * surface container, no rule above it, no shadow (NavigationBarTokens).
 */
function MaterialTabBar() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      className="bg-surface-container">
      <View className="h-16 flex-row">
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} asChild>
            <MaterialTab icon={tab.icon} label={tab.label} />
          </TabTrigger>
        ))}
      </View>
    </View>
  );
}


/** iOS 26's floating bar: 62 pt tall (measured 61-62). */
const GLASS_BAR_HEIGHT = 62;
/** The bar's least distance from the window's bottom edge. */
const GLASS_BAR_FLOOR = 12;
/** From the screen's sides. */
const GLASS_BAR_SIDE = 16;
/** One tab's width while the bar hugs two of them (estimate). */
const GLASS_TAB_WIDTH = 96;
/** The capsule's padding around the selected pill. */
const GLASS_BAR_PADDING = 4;

/**
 * Google's logo and its terms line along the bottom of the website's map,
 * which must stay visible and which a page cannot move. The phone app's map
 * moves its own legal labels up instead (react-native-maps' mapPadding).
 */
const WEB_MAP_CREDITS = 30;

/**
 * How far above the window's bottom edge the floating bar sits: low in the
 * home indicator's space, as iOS puts it - 16 above the inset's top, so 18 on a
 * phone with a 34 inset - but never closer to the edge than 12; and on the
 * website, clear of the map's credits.
 */
function glassBarBottom(insetBottom: number) {
  if (Platform.OS === 'web') return Math.max(insetBottom, WEB_MAP_CREDITS);
  return Math.max(insetBottom - 16, GLASS_BAR_FLOOR);
}

/**
 * How much of a narrow screen's bottom edge the tab bar covers. Zero unless it
 * floats over the screen, as Chenfeng's does: a scroll view then pads its end
 * by this so its last item can scroll clear, and anything pinned to the bottom
 * moves up by it. It already includes the safe-area inset - the bar still owns
 * that, so screens add this and nothing else.
 */
export function useTabBarOverlap(): number {
  const { skin } = useSkin();
  const { isNarrow } = useIsWideViewport();
  const insets = useSafeAreaInsets();
  if (skin !== 'chenfeng' || !isNarrow) return 0;
  return glassBarBottom(insets.bottom) + GLASS_BAR_HEIGHT;
}

type GlassTabProps = TabButtonProps & { index: number; onPressed: (index: number | null) => void };

/**
 * One Chenfeng tab: the symbol over a 10 pt semibold label, in the tint when
 * current and in the label colour otherwise - never grey. The pill behind the
 * current one belongs to the bar, so it can slide.
 */
function GlassTab({
  icon,
  label,
  isFocused,
  index,
  onPressed,
  onPressIn,
  onPressOut,
  // Dropped for the same reason as in TabButton. Do not "clean up".
  style: _injected,
  ...rest
}: GlassTabProps) {
  const { reduceMotion } = useDisplaySettings();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <TextClassContext.Provider value={isFocused ? 'text-primary' : 'text-foreground'}>
      <Pressable
        {...rest}
        onPressIn={(event) => {
          onPressed(index);
          if (!reduceMotion) scale.set(withSpring(1.08, spring('snappy')));
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          onPressed(null);
          scale.set(withSpring(1, spring('bouncy', reduceMotion)));
          onPressOut?.(event);
        }}
        role="tab"
        aria-selected={!!isFocused}
        aria-label={label}
        // The bar does not grow with the text size: iOS shows the Large
        // Content Viewer on a long press instead.
        accessibilityShowsLargeContentViewer
        accessibilityLargeContentTitle={label}
        style={{ width: GLASS_TAB_WIDTH }}
        className={cn(
          'h-full items-center justify-center',
          Platform.select({ web: 'cursor-pointer select-none outline-none' })
        )}>
        <Animated.View className="items-center gap-0.5" style={pressStyle}>
          <Icon
            as={icon}
            size={25}
            weight="medium"
            // SF Symbols' filled variant on iOS; Lucide stays outlined.
            filled={isFocused}
          />
          <Text
            maxFontSizeMultiplier={1}
            numberOfLines={1}
            className="text-[10px] font-semibold leading-3">
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </TextClassContext.Provider>
  );
}

/** The search button: a separate glass circle as tall as the bar. */
function GlassSearchButton({ size }: { size: number }) {
  const { switchTab, getTrigger } = useTabTrigger({ name: 'map' });
  const press = useGlassPress();

  return (
    <Animated.View style={press.style} onLayout={press.onLayout}>
      <Glass radius={size / 2} interactive overMap>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            // What it searches is on the Map tab: go there first.
            if (!getTrigger('map')?.isFocused) switchTab('map', {});
            openMapSearch();
          }}
          role="button"
          aria-label="Search"
          accessibilityShowsLargeContentViewer
          accessibilityLargeContentTitle="Search"
          style={{ width: size, height: size }}
          className={cn(
            'items-center justify-center rounded-full',
            Platform.select({ web: 'cursor-pointer select-none outline-none' })
          )}>
          <Icon as={Search} size={22} weight="medium" className="text-foreground" />
        </Pressable>
        <GlassWash style={press.wash} radius={size / 2} />
      </Glass>
    </Animated.View>
  );
}

/**
 * Chenfeng: iOS 26's tab bar - a glass capsule floating over the screen, so the
 * map shows through, hugging its two tabs at the leading margin, with search as
 * its own circle at the trailing one. The pill behind the current tab slides
 * to the next with .smooth. Screens keep their content clear of it with
 * useTabBarOverlap. It stands aside while search is open: the search field
 * takes its place.
 */
function GlassTabBar() {
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useDisplaySettings();
  const searching = useMapSearchOpen();
  const { getTrigger } = useTabTrigger({ name: 'map' });
  const focused = Math.max(
    0,
    TABS.findIndex((tab) => getTrigger(tab.name)?.isFocused)
  );
  const [pressed, setPressed] = React.useState<number | null>(null);
  const pillX = useSharedValue(focused * GLASS_TAB_WIDTH);
  const pillScale = useSharedValue(1);

  React.useEffect(() => {
    pillX.set(withSpring(focused * GLASS_TAB_WIDTH, spring('smooth', reduceMotion)));
  }, [focused, pillX, reduceMotion]);

  React.useEffect(() => {
    // Pressing the current tab swells its pill, as glass.
    pillScale.set(
      pressed === focused && !reduceMotion
        ? withSpring(1.06, spring('snappy'))
        : withSpring(1, spring('bouncy', reduceMotion))
    );
  }, [pressed, focused, pillScale, reduceMotion]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.get() }, { scale: pillScale.get() }],
  }));

  if (searching) return null;

  return (
    <View
      // Wider than the bar; touches beside it go through.
      pointerEvents="box-none"
      style={{
        bottom: glassBarBottom(insets.bottom),
        left: insets.left + GLASS_BAR_SIDE,
        right: insets.right + GLASS_BAR_SIDE,
        height: GLASS_BAR_HEIGHT,
        // Android draws the screens above a later sibling unless it is
        // raised: without these the bar was there, and tappable, but unseen.
        zIndex: 10,
        elevation: 10,
      }}
      className="absolute flex-row items-center justify-between">
      <GlassGroup className="flex-row" spacing={8}>
        <Glass radius={GLASS_BAR_HEIGHT / 2} overMap style={{ height: GLASS_BAR_HEIGHT }}>
          <View className="h-full flex-row" style={{ padding: GLASS_BAR_PADDING }}>
            <Animated.View
              pointerEvents="none"
              className="absolute rounded-full bg-fill"
              style={[
                {
                  top: GLASS_BAR_PADDING,
                  bottom: GLASS_BAR_PADDING,
                  left: GLASS_BAR_PADDING,
                  width: GLASS_TAB_WIDTH,
                },
                pillStyle,
              ]}
            />
            {TABS.map((tab, index) => (
              <TabTrigger key={tab.name} name={tab.name} asChild>
                <GlassTab
                  icon={tab.icon}
                  label={tab.chenfengLabel}
                  index={index}
                  onPressed={setPressed}
                />
              </TabTrigger>
            ))}
          </View>
        </Glass>
      </GlassGroup>
      <GlassSearchButton size={GLASS_BAR_HEIGHT} />
    </View>
  );
}

/** The wide header row's height: the same as Basic's, which "Leave now" is placed for. */
const CHENFENG_TOP_BAR = 56;

/**
 * How far down a Chenfeng screen's content starts to clear what is at the top:
 * the status bar on a phone; on a wide screen the floating tab bar, which -
 * unlike Basic's header row - takes no space of its own. "Leave now" on a
 * phone's browser is on top of this (useLeaveNowReserve).
 */
export function useChenfengTopInset(): number {
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  return insets.top + (isWide ? CHENFENG_TOP_BAR : 0);
}

/**
 * Chenfeng on a wide screen: iPadOS's tab bar, a glass capsule of tab names
 * floating centred over the top of the screen - no app name; the HIG says not
 * to title a window with it - with search beside it, and the space "Leave
 * now" is drawn over at the row's trailing end. After the screens in the
 * layout's order would put it under them, so it sits above them by z-index.
 */
function ChenfengTopBar({ trailing }: { trailing?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { getTrigger } = useTabTrigger({ name: 'map' });

  return (
    <View
      pointerEvents="box-none"
      style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}
      className="absolute left-0 right-0 top-0 z-10">
      <View
        pointerEvents="box-none"
        style={{ height: CHENFENG_TOP_BAR }}
        className="w-full max-w-5xl flex-row items-center self-center px-6">
        <View className="flex-1" pointerEvents="none" />
        <Glass radius={22} style={{ height: 44 }}>
          <View className="h-full flex-row items-center px-1">
            {TABS.map((tab) => {
              const focused = !!getTrigger(tab.name)?.isFocused;
              return (
                <TabTrigger key={tab.name} name={tab.name} asChild>
                  <WideTab label={tab.chenfengLabel} isFocused={focused} />
                </TabTrigger>
              );
            })}
          </View>
        </Glass>
        <View className="flex-1 flex-row items-center justify-end gap-3" pointerEvents="box-none">
          <GlassSearchButton size={44} />
          {trailing}
        </View>
      </View>
    </View>
  );
}

function WideTab({
  label,
  isFocused,
  // Dropped for the same reason as in TabButton. Do not "clean up".
  style: _injected,
  ...rest
}: TabTriggerSlotProps & { label: string }) {
  return (
    <Pressable
      {...rest}
      role="tab"
      aria-selected={!!isFocused}
      aria-label={label}
      className={cn(
        'h-9 items-center justify-center rounded-full px-5',
        isFocused ? 'bg-fill' : 'active:bg-fill-tertiary',
        Platform.select({
          web: cn('cursor-pointer select-none outline-none', !isFocused && 'hover:bg-fill-quaternary'),
        })
      )}>
      <Text
        textStyle="subheadline"
        maxFontSizeMultiplier={1}
        className={cn('font-semibold', isFocused ? 'text-primary' : 'text-foreground')}>
        {label}
      </Text>
    </Pressable>
  );
}
