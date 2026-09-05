import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/lib/auth';
import { NAV_THEME } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <AuthProvider>
      <KeyboardProvider>
        <ThemeProvider value={NAV_THEME[colorScheme]}>
          {/* Icons were white on a white map, so invisible. Contrast the scheme. */}
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }} />
          <PortalHost />
        </ThemeProvider>
      </KeyboardProvider>
    </AuthProvider>
  );
}
