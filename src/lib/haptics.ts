import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * The haptics iOS's own controls play, for Chenfeng's drawn copies of them -
 * and nothing else: an ordinary button, a tab or a sheet plays none. Android
 * gets its own system haptic for the same moment; the web gets nothing (Safari
 * on an iPhone cannot vibrate, and buzzing a computer means nothing). Material
 * plays the same ones: on Android they are already Android's own constants
 * (docs/material-design-guideline.md, section 11).
 *
 * A build made before expo-haptics was added has no module: every call then
 * fails, and is dropped, rather than taking the press that caused it down too.
 * iOS mutes all of these itself when System Haptics is off.
 */

function play(run: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  try {
    run().catch(() => {});
  } catch {
    // No native module in this build.
  }
}

/** A value picked: a segment, a picker row, a star. */
export function selectionTick() {
  play(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
      : Haptics.selectionAsync()
  );
}

/** A drawn switch flipped. The native switch plays its own. */
export function toggleTick(on: boolean) {
  play(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(
          on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off
        )
      : Haptics.selectionAsync()
  );
}

/** A long press opening a menu; a swipe passing the point where it acts. */
export function lightImpact() {
  play(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  );
}

/** Something worked that took a moment: a review posted. */
export function successTick() {
  play(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  );
}

/** Something failed that someone was waiting on. */
export function errorTick() {
  play(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  );
}
