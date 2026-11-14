import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Platform } from 'react-native';

import { useSkin } from '@/lib/skin';
import { skinColor } from '@/lib/theme';

/**
 * The Directory tab's stack: one screen, and a stack at all only for the sake
 * of Chenfeng on iOS, where the navigation bar is the system's - a large title
 * that collapses as the list scrolls under it - and a native header needs a
 * stack to live in. Everywhere else there is no header and the screen draws
 * its own title, as the Account tab's does (account/_layout.tsx).
 */
export default function DirectoryLayout() {
  const { skin } = useSkin();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const nativeHeader = skin === 'chenfeng' && Platform.OS === 'ios';

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
              // Bar symbols are monochrome; only the primary action is tinted.
              headerTintColor: skinColor('chenfeng', scheme, 'foreground'),
              // A plain list, not a settings page: the plain background.
              contentStyle: { backgroundColor: skinColor('chenfeng', scheme, 'background') },
            }
          : { headerShown: false }
      }>
      <Stack.Screen name="index" options={{ title: 'Directory' }} />
    </Stack>
  );
}
