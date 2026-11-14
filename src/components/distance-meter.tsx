import * as React from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Text } from '@/components/ui/text';
import { DISTANCE_TEXT } from '@/lib/directory-text';
import { selectionTick } from '@/lib/haptics';
import {
  DISTANCE_STEPS_KM,
  setSearchDistance,
  useSearchDistance,
  type DistanceKm,
} from '@/lib/search-distance';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/** Each stop's touch target, and the box its number sits in: one width, so they line up. */
const STOP_WIDTH = 40;
/** The row the track and its stops sit in. Tall enough to press and to drag. */
const TRACK_HEIGHT = 36;
const LAST = DISTANCE_STEPS_KM.length - 1;

/**
 * How far the list and the Directory look: a meter with six stops, 5 km to
 * 250 km. Press a stop or drag along the track; the choice is kept on the
 * device and shared, so the meter on the other screen has already moved
 * (src/lib/search-distance.ts).
 *
 * Stops rather than a free slider: nobody means 37 km, and a stop can be
 * pressed, read out and reached from a keyboard. To assistive technology it is
 * a group of six choices, one of them chosen; the drag is an extra for a
 * finger, not the only way.
 *
 * react-native-reusables has no slider, so this is composed by hand out of the
 * app's own Text and the theme's tokens, per AGENTS.md. One drawing for every
 * skin, with each skin's text styles and its own thumb.
 */
export function DistanceMeter({ className }: { className?: string }) {
  const km = useSearchDistance();
  const { skin } = useSkin();
  const index = Math.max(0, DISTANCE_STEPS_KM.indexOf(km));
  const [width, setWidth] = React.useState(0);

  const choose = React.useCallback(
    (next: DistanceKm) => {
      if (next === km) return;
      selectionTick();
      setSearchDistance(next);
    },
    [km]
  );

  // The stop nearest a point on the track. The first and last stops' centres
  // are half a stop in from the ends, so that is where the scale runs between.
  const chooseAt = React.useCallback(
    (x: number) => {
      if (width <= STOP_WIDTH) return;
      const along = (x - STOP_WIDTH / 2) / (width - STOP_WIDTH);
      const nearest = Math.min(LAST, Math.max(0, Math.round(along * LAST)));
      choose(DISTANCE_STEPS_KM[nearest]);
    },
    [width, choose]
  );

  // A sideways drag only: a finger moving up or down on the meter is scrolling
  // the page it sits in, and must be left to. On the JS thread, because what it
  // does is set state (AGENTS.md, Skins rule 11).
  const drag = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onUpdate((event) => chooseAt(event.x));

  const chenfeng = skin === 'chenfeng';
  const material = skin === 'material';

  return (
    <View className={cn('gap-1', className)}>
      <View className="flex-row items-baseline justify-between gap-3">
        {chenfeng ? (
          <Text textStyle="subheadline" emphasized className="text-foreground">
            {DISTANCE_TEXT.labelTitle}
          </Text>
        ) : material ? (
          <Text type="title-small" className="text-on-surface">
            {DISTANCE_TEXT.label}
          </Text>
        ) : (
          <Text className="text-sm font-medium text-foreground">{DISTANCE_TEXT.label}</Text>
        )}
        {/* Announced when it changes, so dragging says where it has got to. */}
        {chenfeng ? (
          <Text
            textStyle="subheadline"
            accessibilityLiveRegion="polite"
            className="text-label-secondary">
            {DISTANCE_TEXT.within(km)}
          </Text>
        ) : material ? (
          <Text
            type="body-medium"
            accessibilityLiveRegion="polite"
            className="text-on-surface-variant">
            {DISTANCE_TEXT.within(km)}
          </Text>
        ) : (
          <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">
            {DISTANCE_TEXT.within(km)}
          </Text>
        )}
      </View>

      <GestureDetector gesture={drag}>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={DISTANCE_TEXT.label}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
          style={{ height: TRACK_HEIGHT }}
          className={cn('justify-center', Platform.select({ web: 'cursor-pointer select-none' }))}>
          {/* The track, from the first stop's centre to the last one's. */}
          <View
            pointerEvents="none"
            className={cn(
              'absolute h-1 rounded-full',
              chenfeng ? 'bg-fill-secondary' : 'bg-muted'
            )}
            style={{ left: STOP_WIDTH / 2, right: STOP_WIDTH / 2 }}
          />
          {/* Filled as far as the chosen stop. */}
          <View
            pointerEvents="none"
            className="absolute h-1 rounded-full bg-primary"
            style={{
              left: STOP_WIDTH / 2,
              width: width > STOP_WIDTH ? ((width - STOP_WIDTH) * index) / LAST : 0,
            }}
          />
          <View className="flex-row items-center justify-between">
            {DISTANCE_STEPS_KM.map((step, at) => {
              const chosen = at === index;
              return (
                <Pressable
                  key={step}
                  onPress={() => choose(step)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: chosen }}
                  // The website's attribute; accessibilityState is the phone's.
                  aria-checked={chosen}
                  accessibilityLabel={DISTANCE_TEXT.spoken(step)}
                  style={{ width: STOP_WIDTH, height: TRACK_HEIGHT }}
                  className="items-center justify-center">
                  {chosen ? (
                    // The thumb. Chenfeng's is iOS's: white, lifted off the track.
                    <View
                      className={cn(
                        'rounded-full',
                        chenfeng
                          ? 'size-6 bg-white shadow-md shadow-black/25'
                          : 'size-5 border-2 border-background bg-primary'
                      )}
                    />
                  ) : (
                    <View
                      className={cn(
                        'size-1.5 rounded-full',
                        at < index
                          ? 'bg-primary-foreground'
                          : chenfeng
                            ? 'bg-label-tertiary'
                            : 'bg-muted-foreground'
                      )}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </GestureDetector>

      {/* The scale. Not pressable itself - each number sits under the stop
          that is - and hidden from a screen reader, which has the stops. */}
      <View
        className="flex-row justify-between"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {DISTANCE_STEPS_KM.map((step, at) => (
          <View key={step} style={{ width: STOP_WIDTH }} className="items-center">
            {chenfeng ? (
              <Text
                textStyle="caption1"
                maxFontSizeMultiplier={1.3}
                className={at === index ? 'font-semibold text-foreground' : 'text-label-secondary'}
                style={{ fontVariant: ['tabular-nums'] }}>
                {step}
              </Text>
            ) : material ? (
              <Text
                type="label-medium"
                maxFontSizeMultiplier={1.3}
                className={at === index ? 'text-on-surface' : 'text-on-surface-variant'}
                style={{ fontVariant: ['tabular-nums'] }}>
                {step}
              </Text>
            ) : (
              <Text
                maxFontSizeMultiplier={1.3}
                className={cn(
                  'text-xs',
                  at === index ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
                style={{ fontVariant: ['tabular-nums'] }}>
                {step}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
