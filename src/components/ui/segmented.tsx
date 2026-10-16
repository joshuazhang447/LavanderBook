import NativeSegmentedControl from '@expo/ui/community/segmented-control';
import * as React from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { SEE_THROUGH_GLASS } from '@/components/glass';
import { Text } from '@/components/ui/text';
import { useDisplaySettings } from '@/lib/accessibility';
import { selectionTick } from '@/lib/haptics';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type Segment<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  segments: readonly Segment<T>[];
  /** Null: nothing chosen yet - a question not answered. */
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** What the control chooses, for screen readers ("Is there a bathroom..."). */
  accessibilityLabel?: string;
  /**
   * Draw it even on iOS, where the system's own is used otherwise: for one
   * that floats on glass over the map, which iOS draws in a toolbar.
   */
  drawn?: boolean;
  /** Sits on glass: a clear track rather than a grey one. */
  onGlass?: boolean;
  /** A toolbar's: 36 tall with 15 pt labels, rather than 32 and 13. */
  large?: boolean;
  className?: string;
};

/**
 * iOS's segmented control: one of two to five short choices, side by side.
 *
 * On iOS it is SwiftUI's own Picker in the segmented style (through @expo/ui),
 * with its haptic and VoiceOver - except while nothing is chosen, which it
 * cannot show, and when it floats on glass. Elsewhere, and in those two cases,
 * it is drawn to the same measurements: a 32 pt capsule track in the tertiary
 * fill, a white thumb (grey in dark) sliding with .smooth, 13 pt labels with
 * the chosen one semibold, no separators (iOS 26 removed them). The thumb can be
 * dragged across.
 */
export function Segmented<T extends string>({
  segments,
  value,
  onChange,
  disabled,
  accessibilityLabel,
  drawn,
  onGlass,
  large,
  className,
}: SegmentedProps<T>) {
  const index = value === null ? -1 : segments.findIndex((segment) => segment.value === value);

  if (Platform.OS === 'ios' && !drawn && index >= 0) {
    return (
      <View className={className} accessibilityLabel={accessibilityLabel}>
        <NativeSegmentedControl
          values={segments.map((segment) => segment.label)}
          selectedIndex={index}
          enabled={!disabled}
          onChange={(event) => {
            const next = segments[event.nativeEvent.selectedSegmentIndex];
            if (next) onChange(next.value);
          }}
        />
      </View>
    );
  }

  return (
    <DrawnSegmented
      segments={segments}
      index={index}
      onChange={onChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onGlass={onGlass}
      large={large}
      className={className}
    />
  );
}

const TRACK_HEIGHT = 32;
const THUMB_INSET = 2;

function DrawnSegmented<T extends string>({
  segments,
  index,
  onChange,
  disabled,
  accessibilityLabel,
  onGlass,
  large,
  className,
}: Omit<SegmentedProps<T>, 'value' | 'drawn'> & { index: number }) {
  const trackHeight = large ? 36 : TRACK_HEIGHT;
  const { reduceMotion } = useDisplaySettings();
  const [width, setWidth] = React.useState(0);
  const count = segments.length;
  const segmentWidth = width > 0 ? (width - THUMB_INSET * 2) / count : 0;
  const x = useSharedValue(0);
  const shown = useSharedValue(index >= 0 ? 1 : 0);
  // Set while a drag is moving the thumb, so the settle below waits for it.
  const dragging = useSharedValue(false);

  React.useEffect(() => {
    if (segmentWidth === 0) return;
    const target = THUMB_INSET + Math.max(index, 0) * segmentWidth;
    // The first placement jumps; every change after it slides.
    x.set(
      shown.get() === 0 && index >= 0 ? target : withSpring(target, spring('smooth', reduceMotion))
    );
    shown.set(withSpring(index >= 0 ? 1 : 0, spring('snappy', reduceMotion)));
  }, [index, segmentWidth, x, shown, reduceMotion]);

  function choose(next: number) {
    const segment = segments[next];
    if (!segment || disabled || next === index) return;
    selectionTick();
    onChange(segment.value);
  }

  const pan = Gesture.Pan()
    .enabled(!disabled && index >= 0 && segmentWidth > 0)
    .activeOffsetX([-8, 8])
    .runOnJS(true)
    .onStart(() => {
      dragging.set(true);
    })
    .onUpdate((event) => {
      const start = THUMB_INSET + index * segmentWidth;
      const max = THUMB_INSET + (count - 1) * segmentWidth;
      x.set(Math.min(max, Math.max(THUMB_INSET, start + event.translationX)));
    })
    .onEnd(() => {
      dragging.set(false);
      const landed = Math.round((x.get() - THUMB_INSET) / segmentWidth);
      if (landed === index) {
        x.set(withSpring(THUMB_INSET + index * segmentWidth, spring('smooth', reduceMotion)));
      } else {
        choose(landed);
      }
    });

  const thumb = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateX: x.get() }, { scale: 0.9 + 0.1 * shown.get() }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        role="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={{ height: trackHeight }}
        className={cn(
          'flex-row rounded-full',
          // A clear track only on glass you can see through: on Android's
          // nearly opaque glass the white thumb would vanish into it.
          onGlass && SEE_THROUGH_GLASS ? 'bg-transparent' : 'bg-fill-tertiary',
          disabled && 'opacity-50',
          className
        )}>
        {segmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            className="absolute rounded-full bg-segment-thumb"
            style={[
              {
                top: THUMB_INSET,
                bottom: THUMB_INSET,
                left: 0,
                width: segmentWidth,
                boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12), 0px 1px 1px rgba(0, 0, 0, 0.04)',
              },
              thumb,
            ]}
          />
        ) : null}
        <View className="flex-1 flex-row" style={{ paddingHorizontal: THUMB_INSET }}>
          {segments.map((segment, i) => {
            const selected = i === index;
            return (
              <Pressable
                key={segment.value}
                onPress={() => choose(i)}
                disabled={disabled}
                role="radio"
                aria-checked={selected}
                accessibilityLabel={segment.label}
                accessibilityHint={`${i + 1} of ${count}`}
                className={cn(
                  'flex-1 items-center justify-center px-1 active:opacity-60',
                  Platform.select({
                    web: 'cursor-pointer select-none outline-none focus-visible:opacity-70',
                  })
                )}>
                {/* Segment labels do not grow with the text size: iOS caps them,
                    so they never truncate. */}
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1}
                  className={cn(
                    large ? 'text-[15px] leading-5' : 'text-[13px] leading-[18px]',
                    'text-foreground',
                    selected ? 'font-semibold' : 'font-medium'
                  )}>
                  {segment.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </GestureDetector>
  );
}
