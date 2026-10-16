import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

export type SwipeAction = {
  label: string;
  icon: LucideIcon;
  tone: 'tint' | 'destructive';
  onPress: () => void;
};

const BUTTON = 52;
const GAP = 8;

/**
 * A list row with trailing swipe actions, as iOS 26 draws them: capsules in the
 * action's colour with a filled symbol, revealed as the row slides. The same
 * actions must also be in the row's context menu and its VoiceOver actions -
 * a swipe is never the only way to do something.
 */
export function SwipeRow({ actions, children }: React.PropsWithChildren<{ actions: SwipeAction[] }>) {
  const ref = React.useRef<SwipeableMethods>(null);
  const width = actions.length * (BUTTON + GAP) + GAP;

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      rightThreshold={width / 2}
      overshootRight={false}
      // The page's own back gesture keeps the leading edge.
      dragOffsetFromLeftEdge={Platform.OS === 'web' ? 10 : 30}
      renderRightActions={(progress) => (
        <Actions
          progress={progress}
          width={width}
          actions={actions}
          onDone={() => ref.current?.close()}
        />
      )}>
      {children}
    </ReanimatedSwipeable>
  );
}

function Actions({
  progress,
  width,
  actions,
  onDone,
}: {
  progress: SharedValue<number>;
  width: number;
  actions: SwipeAction[];
  onDone: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.6], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.7, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <Animated.View
      style={[{ width, gap: GAP, paddingHorizontal: GAP / 2 }, style]}
      className="flex-row items-center justify-end">
      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={() => {
            onDone();
            action.onPress();
          }}
          role="button"
          accessibilityLabel={action.label}
          style={{ width: BUTTON, height: 40 }}
          className={cn(
            'items-center justify-center rounded-full active:opacity-75',
            action.tone === 'destructive' ? 'bg-destructive' : 'bg-primary',
            Platform.select({ web: 'cursor-pointer' })
          )}>
          <View>
            <Icon as={action.icon} size={18} weight="semibold" filled className="text-white" />
          </View>
        </Pressable>
      ))}
    </Animated.View>
  );
}
