import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Platform } from 'react-native';

import { useSkin } from '@/lib/skin';
import { skinColor } from '@/lib/theme';

/**
 * The Account tab's own stack. Basic and Material have one screen in it and no
 * header, exactly as before it existed. Chenfeng pushes a page per setting
 * (guideline section 14.6) - and on iOS the navigation bar is the system's,
 * with its large title collapsing on scroll, its glass back button and swipe
 * back; elsewhere the pages draw their own (LargeTitleScreen). Android gets
 * the iOS-style push it asks for, with its own back gesture kept.
 */
export default function AccountLayout() {
  const { skin } = useSkin();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const chenfeng = skin === 'chenfeng';
  const nativeHeader = chenfeng && Platform.OS === 'ios';

  return (
    <Stack
      screenOptions={
        nativeHeader
          ? {
              headerShown: true,
              headerLargeTitleEnabled: true,
              headerTransparent: true,
              headerShadowVisible: false,
              headerLargeTitleShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal',
              // Bar symbols are monochrome; only the primary action is tinted.
              headerTintColor: skinColor('chenfeng', scheme, 'foreground'),
              contentStyle: { backgroundColor: skinColor('chenfeng', scheme, 'grouped') },
            }
          : {
              headerShown: false,
              animation: chenfeng && Platform.OS === 'android' ? 'ios_from_right' : undefined,
            }
      }>
      <Stack.Screen name="index" options={{ title: 'Account' }} />
      <Stack.Screen name="location" options={{ title: 'Use My Location' }} />
      <Stack.Screen name="leave-now" options={{ title: 'Leave Now Button' }} />
      <Stack.Screen name="names" options={{ title: 'Per-Place Names' }} />
      <Stack.Screen name="dates" options={{ title: 'Hide Exact Dates' }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
    </Stack>
  );
}
