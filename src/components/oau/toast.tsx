import { Portal } from '@rn-primitives/portal';
import { CircleCheck } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsWideViewport } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * OAU's toast (LavenderBookStyle/oau-style-guide.md, section 13.18): a cream
 * capsule with an ink outline, an icon and one line, a second line in the
 * hand when there is one to say ("Thank you for looking out for others.").
 * Four seconds, or until tapped; read out when it appears. One at a time.
 */

type Toast = { id: number; title: string; line?: string };

const SHOWN_MS = 4000;

let current: Toast | null = null;
let next = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function dismiss() {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  notify();
}

export function showToast(toast: { title: string; line?: string }) {
  if (timer) clearTimeout(timer);
  current = { id: ++next, ...toast };
  timer = setTimeout(dismiss, SHOWN_MS);
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Where toasts appear: rendered once, from the confirmations' host in the root layout. */
export function OauToastHost() {
  const toast = React.useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  if (!toast) return null;

  // Clear of the tab bar and a sheet's peek on a phone; low on a wide screen.
  const bottom = isWide ? 32 : insets.bottom + 64 + 112;

  return (
    <Portal name="oau-toast">
      <View
        pointerEvents="box-none"
        className="absolute inset-0 items-center justify-end px-4"
        style={{ paddingBottom: bottom }}>
        <Animated.View key={toast.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)}>
          <Pressable
            onPress={dismiss}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className={cn(
              'flex-row items-center gap-2.5 rounded-full border-[1.5px] border-outline-ink bg-card py-2.5 pl-3 pr-5',
              Platform.select({ web: 'cursor-pointer shadow-[0_6px_20px_-6px_rgba(69,49,30,0.4)]' })
            )}>
            <Icon as={CircleCheck} className="size-5 text-positive-foreground" />
            <View>
              <Text oauStyle="subheading" className="text-foreground">
                {toast.title}
              </Text>
              {toast.line ? (
                <Text oauStyle="note" className="text-muted-foreground">
                  {toast.line}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Portal>
  );
}
