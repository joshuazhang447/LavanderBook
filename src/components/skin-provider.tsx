import * as Font from 'expo-font';
import { useColorScheme, vars } from 'nativewind';
import * as React from 'react';
import { Platform, View } from 'react-native';

import { useDisplaySettings } from '@/lib/accessibility';
import { chooseSkin, SkinContext, useSkin, type Skin } from '@/lib/skin';
import { paletteVariables, SKIN_TOKENS, skinPalette, type SkinColor } from '@/lib/theme';

/**
 * Phone app: the skin's variables set on one view around the screens and the
 * portal host, so every screen, sheet and dialog inherits them - native portals
 * render at the host, inside this view. Anything outside it reads the
 * stylesheet's own values, which are Basic.
 *
 * Basic sets one variable that nothing reads. NativeWind wraps a view in a
 * provider the first time it sets a variable, and a view that starts setting
 * them after its first render is remounted - here that would be every screen,
 * and the navigation state with them.
 */
function skinVars(skin: Skin, scheme: 'light' | 'dark', contrast: boolean) {
  if (skin === 'basic') return vars({ '--skin': 'basic' });
  return vars({
    '--skin': skin,
    '--radius': `${SKIN_TOKENS[skin].radius}px`,
    ...paletteVariables(skinPalette(skin, { scheme, contrast })),
  });
}

type Appearances = Record<'light' | 'dark', Record<'normal' | 'contrast', object>>;

function appearances(skin: Skin): Appearances {
  return {
    light: { normal: skinVars(skin, 'light', false), contrast: skinVars(skin, 'light', true) },
    dark: { normal: skinVars(skin, 'dark', false), contrast: skinVars(skin, 'dark', true) },
  };
}

/** Built once: a new vars() object every render would restyle the whole tree. */
const SKIN_VARS: Record<Skin, Appearances> = {
  basic: appearances('basic'),
  material: appearances('material'),
  chenfeng: appearances('chenfeng'),
};

/**
 * Inter, Chenfeng's typeface on Android, where the system font is not San
 * Francisco and SF may not be shipped. One file per weight; the Text component
 * picks the file for the weight it is drawn in. Only the four weights the
 * text styles use, required one by one: the package's index would pull every
 * weight and italic into the app.
 */
const INTER_FILES = {
  Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
};

let interLoading: Promise<void> | null = null;

/** Loads Inter the first time Chenfeng is used on Android; true once it is there. */
function useChenfengFonts(skin: Skin): boolean {
  const needed = Platform.OS === 'android' && skin === 'chenfeng';
  const [loaded, setLoaded] = React.useState(() => Font.isLoaded('Inter_400Regular'));

  React.useEffect(() => {
    if (!needed || loaded) return;
    let active = true;
    interLoading ??= Font.loadAsync(INTER_FILES);
    interLoading
      .then(() => active && setLoaded(true))
      // Without it, text stays in the system font: worse, never broken.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [needed, loaded]);

  return !needed || loaded;
}

/**
 * Material's fonts: Material Symbols (Rounded), its icons, everywhere; and on
 * iOS Roboto, its typeface - Android's own system font, so nothing to load
 * there. The three weights the type scale uses, file by file.
 */
const MATERIAL_FILES = {
  MaterialSymbolsRounded_400Regular: require('@expo-google-fonts/material-symbols-rounded/400Regular/MaterialSymbolsRounded_400Regular.ttf'),
  ...(Platform.OS === 'ios'
    ? {
        Roboto_400Regular: require('@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf'),
        Roboto_500Medium: require('@expo-google-fonts/roboto/500Medium/Roboto_500Medium.ttf'),
        Roboto_700Bold: require('@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf'),
      }
    : null),
};

let materialLoading: Promise<void> | null = null;

/** Loads Material's fonts the first time Material is used; true once they are there. */
function useMaterialFonts(skin: Skin): boolean {
  const needed = skin === 'material';
  const [loaded, setLoaded] = React.useState(() =>
    Font.isLoaded('MaterialSymbolsRounded_400Regular')
  );

  React.useEffect(() => {
    if (!needed || loaded) return;
    let active = true;
    materialLoading ??= Font.loadAsync(MATERIAL_FILES);
    materialLoading
      .then(() => active && setLoaded(true))
      // Without them, text stays in the system font and icons in Lucide.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [needed, loaded]);

  return !needed || loaded;
}

export function SkinProvider({ skin, children }: React.PropsWithChildren<{ skin: Skin }>) {
  // NativeWind's own scheme: the one that picks between :root and .dark:root.
  const { colorScheme } = useColorScheme();
  const { highContrast } = useDisplaySettings();
  // Each skin's own fonts; true for a skin that needs none.
  const chenfengFonts = useChenfengFonts(skin);
  const materialFonts = useMaterialFonts(skin);
  const fontsReady = chenfengFonts && materialFonts;
  const value = React.useMemo(
    () => ({ skin, setSkin: chooseSkin, fontsReady }),
    [skin, fontsReady]
  );
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';

  return (
    <SkinContext.Provider value={value}>
      <View
        className="flex-1"
        style={SKIN_VARS[skin][scheme][highContrast ? 'contrast' : 'normal']}>
        {children}
      </View>
    </SkinContext.Provider>
  );
}

/**
 * Keeps what it wraps in Basic whatever the skin. In the phone app that only
 * takes being outside SkinProvider, so this adds nothing; the website needs more
 * (skin-provider.web.tsx).
 */
export function Unskinned({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

/** The colours dark mode lifts inside a sheet (theme.ts, `elevated`). */
const ELEVATED_COLORS: SkinColor[] = [
  'background',
  'grouped',
  'card',
  'popover',
  'muted',
  'accent',
];

function elevatedVars(skin: Skin, scheme: 'light' | 'dark', contrast: boolean) {
  const palette = skinPalette(skin, { scheme, contrast, elevated: true });
  return vars(
    paletteVariables(Object.fromEntries(ELEVATED_COLORS.map((name) => [name, palette[name]])))
  );
}

const ELEVATED_VARS = {
  light: {
    normal: elevatedVars('chenfeng', 'light', false),
    contrast: elevatedVars('chenfeng', 'light', true),
  },
  dark: {
    normal: elevatedVars('chenfeng', 'dark', false),
    contrast: elevatedVars('chenfeng', 'dark', true),
  },
};

/**
 * For the root view of anything presented above the app - a sheet, a menu: in
 * Chenfeng's dark mode it lifts the surfaces inside it onto iOS's elevated
 * colours, so nothing inside has to know it is in a sheet. Spread onto the
 * view. Always sets the variables (the same ones in light mode), so the view
 * is never remounted by starting to.
 */
export function useElevatedSurface(): { style?: object; className?: string } {
  const { skin } = useSkin();
  const { colorScheme } = useColorScheme();
  const { highContrast } = useDisplaySettings();
  if (skin !== 'chenfeng') return {};
  return {
    style:
      ELEVATED_VARS[colorScheme === 'dark' ? 'dark' : 'light'][
        highContrast ? 'contrast' : 'normal'
      ],
  };
}
