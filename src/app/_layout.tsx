import '@/global.css';
// Side-effect import: registers className support on reanimated components.
import '@/lib/nativewind-animated';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BehindSafetyNotice, SafetyLayer } from '@/components/safety-notice';
import { SkinProvider, Unskinned } from '@/components/skin-provider';
import { ConfirmHost } from '@/components/ui/confirm';
import { AuthProvider } from '@/lib/auth';
import { useAppSkin } from '@/lib/skin';
import { SKIN_NAV_THEME } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Basic on the admin panel whatever is chosen.
  const skin = useAppSkin();

  return (
    // Gestures - Chenfeng's sheets, switches and swipe actions - need this
    // around everything. It is a plain full-screen view; nothing else changes.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <KeyboardProvider>
          <ThemeProvider value={SKIN_NAV_THEME[skin][colorScheme]}>
            {/* Icons were white on a white map, so invisible. Contrast the scheme. */}
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <AnimatedSplashOverlay />
            <BehindSafetyNotice>
              {/* Around the portal host too, so sheets and dialogs are skinned. */}
              <SkinProvider skin={skin}>
                <Stack screenOptions={{ headerShown: false }} />
                {/* Chenfeng's drawn alerts and action sheets; renders through
                    the host below, and nothing in any other skin. */}
                <ConfirmHost />
                <PortalHost />
              </SkinProvider>
            </BehindSafetyNotice>
            {/* After the portal host, so no sheet or dialog covers "Leave now" or
              the notice. Unskinned: both look the same in every skin. */}
            <Unskinned>
              <SafetyLayer />
            </Unskinned>
          </ThemeProvider>
        </KeyboardProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
