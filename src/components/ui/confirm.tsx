import { Portal } from '@rn-primitives/portal';
import * as React from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsWideViewport } from '@/components/tab-bar';
import { useElevatedSurface } from '@/components/skin-provider';
import { Text } from '@/components/ui/text';
import { useDisplaySettings } from '@/lib/accessibility';
import { spring } from '@/lib/motion';
import { CONTINUOUS } from '@/lib/shape';
import { cn } from '@/lib/utils';

/**
 * Chenfeng's confirmations, through one call each, so no screen builds a
 * dialog by hand (guideline sections 13.12 and 13.13).
 *
 *   alert        an interruption that needs a decision now. iOS and Android:
 *                the system's own alert (UIAlertController, and Android's -
 *                Android's should look like Android's, and Play forbids
 *                imitating the system's). The website: drawn, since React
 *                Native Web's Alert does nothing.
 *   actionSheet  a choice about an action the person started: deleting a
 *                review, discarding changes, turning off a privacy switch. iOS:
 *                the system's action sheet - ActionSheetIOS cannot anchor it to
 *                the control on an iPhone, so it rises from the bottom, the
 *                older way; @expo/ui's anchored ConfirmationDialog is the
 *                upgrade once it can be checked on a device. Elsewhere: drawn,
 *                a bottom panel inset 8 pt with Cancel in its own group.
 *
 * Each resolves to the index of the button pressed, or null for Cancel and
 * for dismissing it some other way.
 */

export type ConfirmButton = { label: string; style?: 'default' | 'cancel' | 'destructive' };

type AlertRequest = {
  kind: 'alert';
  title: string;
  message?: string;
  buttons: ConfirmButton[];
};

type SheetRequest = {
  kind: 'actionSheet';
  title?: string;
  message?: string;
  /** Not Cancel: that is added, last, in its own group. */
  actions: ConfirmButton[];
  cancelLabel?: string;
};

type Request = (AlertRequest | SheetRequest) & { resolve: (index: number | null) => void };

let current: Request | null = null;
const listeners = new Set<() => void>();

function show(request: Request | null) {
  current = request;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function confirmAlert(request: Omit<AlertRequest, 'kind'>): Promise<number | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      let settled = false;
      const once = (value: number | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      Alert.alert(
        request.title,
        request.message,
        request.buttons.map((button, index) => ({
          text: button.label,
          style: button.style,
          onPress: () => once(button.style === 'cancel' ? null : index),
        })),
        { cancelable: true, onDismiss: () => once(null) }
      );
      return;
    }
    current?.resolve(null);
    show({ kind: 'alert', ...request, resolve });
  });
}

export function confirmActionSheet(request: Omit<SheetRequest, 'kind'>): Promise<number | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      const options = [
        ...request.actions.map((action) => action.label),
        request.cancelLabel ?? 'Cancel',
      ];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: request.title,
          message: request.message,
          options,
          cancelButtonIndex,
          destructiveButtonIndex: request.actions
            .map((action, index) => (action.style === 'destructive' ? index : -1))
            .filter((index) => index >= 0),
        },
        (index) => resolve(index === cancelButtonIndex ? null : index)
      );
      return;
    }
    current?.resolve(null);
    show({ kind: 'actionSheet', ...request, resolve });
  });
}

/**
 * Where the drawn ones appear: rendered once in the root layout, inside the
 * skin, through the portal host - so under "Leave now", like every sheet.
 */
export function ConfirmHost() {
  const request = React.useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
  if (!request) return null;

  const answer = (index: number | null) => {
    show(null);
    request.resolve(index);
  };

  return (
    <Portal name="chenfeng-confirm">
      {request.kind === 'alert' ? (
        <DrawnAlert request={request} onAnswer={answer} />
      ) : (
        <DrawnActionSheet request={request} onAnswer={answer} />
      )}
    </Portal>
  );
}

function useAppear() {
  const { reduceMotion } = useDisplaySettings();
  const shown = useSharedValue(0);
  React.useEffect(() => {
    shown.set(withTiming(1, { duration: 200 }));
  }, [shown]);
  const scale = useSharedValue(reduceMotion ? 1 : 1.1);
  React.useEffect(() => {
    scale.set(withSpring(1, spring('snappy', reduceMotion)));
  }, [scale, reduceMotion]);
  return { shown, scale };
}

function Dim({ onPress, shown }: { onPress: () => void; shown: { get(): number } }) {
  const style = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <Animated.View className="absolute inset-0 bg-black/20 dark:bg-black/40" style={style}>
      <Pressable
        className="flex-1"
        onPress={onPress}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Animated.View>
  );
}

/** The surface both are drawn on: opaque enough to read, frosted on the website. */
const PANEL = cn(
  'bg-popover/95',
  Platform.select({ web: 'backdrop-blur-[20px] backdrop-saturate-[1.8]' })
);

function DrawnAlert({
  request,
  onAnswer,
}: {
  request: AlertRequest;
  onAnswer: (index: number | null) => void;
}) {
  const { width } = useWindowDimensions();
  const elevated = useElevatedSurface();
  const { shown, scale } = useAppear();
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: scale.get() }],
  }));
  const stacked = request.buttons.length > 2;
  // Cancel leading (or last, stacked); the default action trailing (or first).
  const order = request.buttons
    .map((button, index) => ({ button, index }))
    .sort((a, b) =>
      stacked
        ? Number(a.button.style === 'cancel') - Number(b.button.style === 'cancel')
        : Number(b.button.style === 'cancel') - Number(a.button.style === 'cancel')
    );

  return (
    <View className="absolute inset-0 items-center justify-center" pointerEvents="box-none">
      <Dim onPress={() => onAnswer(null)} shown={shown} />
      <Animated.View
        role="alertdialog"
        aria-modal
        aria-label={request.title}
        className={cn('gap-4 p-5', PANEL, elevated.className)}
        style={[
          { width: Math.min(width - 64, 300), borderRadius: 32 },
          CONTINUOUS,
          { boxShadow: '0px 16px 48px rgba(0, 0, 0, 0.22)' },
          elevated.style,
          style,
        ]}>
        <View className="gap-1.5">
          <Text textStyle="headline" className="text-foreground">
            {request.title}
          </Text>
          {request.message ? (
            <Text textStyle="subheadline" className="text-foreground">
              {request.message}
            </Text>
          ) : null}
        </View>
        <View className={cn('gap-2', stacked ? 'flex-col' : 'flex-row')}>
          {order.map(({ button, index }) => {
            const isDefault = button.style !== 'cancel' && button.style !== 'destructive';
            return (
              <Pressable
                key={index}
                onPress={() => onAnswer(button.style === 'cancel' ? null : index)}
                role="button"
                className={cn(
                  'h-11 items-center justify-center rounded-full px-4 active:opacity-75',
                  !stacked && 'flex-1',
                  isDefault ? 'bg-primary' : 'bg-fill-tertiary',
                  Platform.select({
                    web: 'cursor-pointer select-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  })
                )}>
                <Text
                  textStyle="body"
                  numberOfLines={1}
                  className={cn(
                    isDefault
                      ? 'font-semibold text-primary-foreground'
                      : button.style === 'destructive'
                        ? 'text-destructive'
                        : 'text-foreground'
                  )}>
                  {button.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

function DrawnActionSheet({
  request,
  onAnswer,
}: {
  request: SheetRequest;
  onAnswer: (index: number | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  const elevated = useElevatedSurface();
  const { reduceMotion } = useDisplaySettings();
  const shown = useSharedValue(0);
  const rise = useSharedValue(isWide || reduceMotion ? 0 : 40);
  React.useEffect(() => {
    shown.set(withTiming(1, { duration: 200 }));
    rise.set(withSpring(0, spring('smooth', reduceMotion)));
  }, [shown, rise, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: rise.get() }],
  }));

  // The shadow on each rounded group, outside the one that clips: on the
  // column around them it would be a grey rectangle showing at the corners and
  // in the gap between the groups.
  const group = (children: React.ReactNode) => (
    <View style={[{ borderRadius: 26, boxShadow: '0px 8px 28px rgba(0, 0, 0, 0.16)' }, CONTINUOUS]}>
      <View
        className={cn('overflow-hidden', PANEL, elevated.className)}
        style={[{ borderRadius: 26 }, CONTINUOUS, elevated.style]}>
        {children}
      </View>
    </View>
  );

  return (
    <View
      className={cn('absolute inset-0', isWide ? 'items-center justify-center' : 'justify-end')}
      pointerEvents="box-none">
      <Dim onPress={() => onAnswer(null)} shown={shown} />
      <Animated.View
        role="dialog"
        aria-modal
        aria-label={request.title ?? request.message ?? 'Choose an action'}
        className="gap-2 px-2"
        style={[isWide ? { width: 360 } : { paddingBottom: Math.max(insets.bottom, 8) }, style]}>
        {group(
          <>
            {request.title || request.message ? (
              <View className="items-center gap-1 px-4 py-3.5">
                {request.title ? (
                  <Text
                    textStyle="footnote"
                    emphasized
                    className="text-center text-label-secondary">
                    {request.title}
                  </Text>
                ) : null}
                {request.message ? (
                  <Text textStyle="footnote" className="text-center text-label-secondary">
                    {request.message}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {request.actions.map((action, index) => (
              <Pressable
                key={index}
                onPress={() => onAnswer(index)}
                role="button"
                className={cn(
                  'min-h-14 items-center justify-center px-4 active:bg-accent',
                  Platform.select({
                    web: 'cursor-pointer select-none outline-none hover:bg-fill-quaternary',
                  })
                )}>
                {index > 0 || request.title || request.message ? (
                  <View
                    className="absolute left-0 right-0 top-0 bg-separator"
                    style={{ height: StyleSheet.hairlineWidth }}
                  />
                ) : null}
                <Text
                  textStyle="body"
                  className={cn(
                    'text-center',
                    action.style === 'destructive' ? 'text-destructive' : 'text-primary'
                  )}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </>
        )}
        {group(
          <Pressable
            onPress={() => onAnswer(null)}
            role="button"
            className={cn(
              'min-h-14 items-center justify-center px-4 active:bg-accent',
              Platform.select({
                web: 'cursor-pointer select-none outline-none hover:bg-fill-quaternary',
              })
            )}>
            <Text textStyle="body" emphasized className="text-center text-primary">
              {request.cancelLabel ?? 'Cancel'}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}
