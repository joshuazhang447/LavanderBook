import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { Platform, View, type ScrollViewProps } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { GlassButton } from '@/components/glass';
import { useLeaveNowReserve } from '@/components/leave-now';
import { useChenfengTopInset, useTabBarOverlap } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Whether this screen's navigation bar is iOS's own: Chenfeng on iOS, where the
 * Account stack's layout turns the native header on (large title, collapse on
 * scroll, glass back button, swipe back - all the system's). Everywhere else
 * the bar is drawn here.
 */
export const NATIVE_HEADER = Platform.OS === 'ios';

/** iOS 26's inline bar, under the status bar (measured; it was 44). */
const BAR_HEIGHT = 54;

type LargeTitleScreenProps = Omit<ScrollViewProps, 'children'> & {
  title: string;
  /** Settings-like: the grouped grey page. */
  grouped?: boolean;
  /** A back button: pushed pages. */
  back?: boolean;
  /** A 44 pt glass button at the bar's trailing end. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * A Chenfeng screen with a large title (guideline section 13.2): the 34 pt bold
 * title at the top of the content, collapsing into a 17 pt inline title in the
 * bar as it scrolls under it, a soft scroll edge under the bar once content is
 * beneath, and the same at the bottom under the floating tab bar.
 *
 * Drawn on Android and the website. On iOS the native header does all of it,
 * so this is only the scroll view, with the inset adjustment that lets the
 * title collapse.
 */
export function LargeTitleScreen({
  title,
  grouped,
  back,
  trailing,
  children,
  contentContainerStyle,
  ...props
}: LargeTitleScreenProps) {
  const topInset = useChenfengTopInset();
  const leaveNow = useLeaveNowReserve();
  const tabBarOverlap = useTabBarOverlap();
  const scrollY = useSharedValue(0);
  const background = grouped ? 'bg-grouped' : 'bg-background';

  if (NATIVE_HEADER) {
    return (
      <Animated.ScrollView
        {...props}
        contentInsetAdjustmentBehavior="automatic"
        className={cn('flex-1', background)}
        contentContainerStyle={[
          { paddingTop: 8, paddingBottom: 24 + tabBarOverlap },
          contentContainerStyle,
        ]}>
        <View className="w-full max-w-[680px] self-center">{children}</View>
      </Animated.ScrollView>
    );
  }

  // Wide: the header row above already clears the status bar.
  const top = topInset + leaveNow.top;

  return (
    <DrawnLargeTitle
      title={title}
      background={background}
      top={top}
      bottomOverlap={tabBarOverlap}
      back={back}
      trailing={trailing}
      scrollY={scrollY}
      contentContainerStyle={contentContainerStyle}
      scrollProps={props}>
      {children}
    </DrawnLargeTitle>
  );
}

function DrawnLargeTitle({
  title,
  background,
  top,
  bottomOverlap,
  back,
  trailing,
  scrollY,
  contentContainerStyle,
  scrollProps,
  children,
}: {
  title: string;
  background: string;
  top: number;
  bottomOverlap: number;
  back?: boolean;
  trailing?: React.ReactNode;
  scrollY: ReturnType<typeof useSharedValue<number>>;
  contentContainerStyle: ScrollViewProps['contentContainerStyle'];
  scrollProps: Omit<ScrollViewProps, 'children'>;
  children: React.ReactNode;
}) {
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // The large title is 41 tall; the inline one fades in as it passes under
  // the bar, and the bar's edge effect as soon as anything does.
  const inlineTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [30, 46], [0, 1], Extrapolation.CLAMP),
  }));
  const largeTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [24, 44], [1, 0], Extrapolation.CLAMP),
  }));
  const edge = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 12], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View className={cn('flex-1', background)}>
      <Animated.ScrollView
        {...scrollProps}
        onScroll={onScroll}
        scrollEventThrottle={16}
        className="flex-1"
        contentContainerStyle={[
          { paddingTop: top + BAR_HEIGHT, paddingBottom: 24 + bottomOverlap },
          contentContainerStyle,
        ]}>
        <View className="w-full max-w-[680px] self-center">
          <Animated.View style={largeTitle} className="px-4 pb-3">
            <Text textStyle="large-title" emphasized role="heading" className="text-foreground">
              {title}
            </Text>
          </Animated.View>
          {children}
        </View>
      </Animated.ScrollView>

      {/* The bar: nothing of its own but the edge effect, its buttons and the
          inline title. */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 top-0"
        style={{ height: top + BAR_HEIGHT + FADE }}>
        <Animated.View pointerEvents="none" className="absolute inset-0" style={edge}>
          <ScrollEdge position="top" tone={background} />
        </Animated.View>
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 flex-row items-center px-4"
          style={{ top, height: BAR_HEIGHT }}>
          <View className="min-w-11 flex-1 flex-row" pointerEvents="box-none">
            {back ? (
              <GlassButton
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))}
                accessibilityLabel="Back">
                <Icon
                  as={ChevronLeft}
                  size={21}
                  weight="semibold"
                  strokeWidth={2.5}
                  className="text-foreground"
                />
              </GlassButton>
            ) : null}
          </View>
          <Animated.View style={inlineTitle} pointerEvents="none" className="shrink">
            <Text
              textStyle="headline"
              numberOfLines={1}
              maxFontSizeMultiplier={1}
              className="text-center text-foreground">
              {title}
            </Text>
          </Animated.View>
          <View className="min-w-11 flex-1 flex-row justify-end" pointerEvents="box-none">
            {trailing}
          </View>
        </View>
      </View>

      {bottomOverlap > 0 ? (
        <View
          pointerEvents="none"
          className="absolute bottom-0 left-0 right-0"
          style={{ height: bottomOverlap + FADE }}>
          <ScrollEdge position="bottom" tone={background} />
        </View>
      ) : null}
    </View>
  );
}

/** Written out whole: Tailwind only builds classes it finds spelled in full. */
const WEB_FADE = {
  top: {
    plain: 'bg-[linear-gradient(to_bottom,hsl(var(--background)/0.92),transparent)]',
    grouped: 'bg-[linear-gradient(to_bottom,hsl(var(--grouped)/0.92),transparent)]',
  },
  bottom: {
    plain: 'bg-[linear-gradient(to_top,hsl(var(--background)/0.92),transparent)]',
    grouped: 'bg-[linear-gradient(to_top,hsl(var(--grouped)/0.92),transparent)]',
  },
} as const;

/** How far past the floating thing the content takes to come back. */
const FADE = 24;

/**
 * iOS 26's soft scroll edge effect, where content scrolls under something
 * floating: the content dissolves into the page colour towards the screen's
 * edge, so whatever floats there stays legible - nearly solid behind the bar
 * itself, then fading over the last stretch. On the website the solid part
 * also blurs what is behind it; elsewhere the fade is drawn in bands.
 */
export function ScrollEdge({
  position,
  tone,
}: {
  position: 'top' | 'bottom';
  /** The page's colour class: bg-background or bg-grouped. */
  tone: string;
}) {
  const key = tone === 'bg-grouped' ? 'grouped' : 'plain';
  const solid = (
    <View
      className={cn(
        'flex-1',
        tone,
        Platform.select({ web: 'opacity-[0.92] backdrop-blur-[10px]', default: 'opacity-[0.94]' })
      )}
    />
  );
  const fade =
    Platform.OS === 'web' ? (
      <View style={{ height: FADE }} className={WEB_FADE[position][key]} />
    ) : (
      <View style={{ height: FADE }} className={position === 'top' ? 'flex-col' : 'flex-col-reverse'}>
        {[0.8, 0.62, 0.45, 0.3, 0.17, 0.07].map((opacity) => (
          <View key={opacity} className={cn('flex-1', tone)} style={{ opacity }} />
        ))}
      </View>
    );
  return (
    <View
      className={cn('absolute inset-0', position === 'bottom' ? 'flex-col-reverse' : 'flex-col')}>
      {solid}
      {fade}
    </View>
  );
}
