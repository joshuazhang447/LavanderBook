import { Asset } from 'expo-asset';
import * as React from 'react';
import { View } from 'react-native';

import { MATERIAL_SYMBOLS_FAMILY } from '@/lib/material';
import { chooseSkin, SkinContext, useSkin, type Skin } from '@/lib/skin';
import {
  OAU_TAB_TINTS,
  oauTintClass,
  paletteVariables,
  SKIN_TOKENS,
  skinPalette,
  type OauTab,
  type SkinVariant,
} from '@/lib/theme';

/**
 * Website: the skin's variables go on the page itself, not on a view around the
 * app as in the phone app (skin-provider.tsx). Dialogs, menus and selects on the
 * web are portals into <body>, outside any view of ours, and a variable only
 * reaches the elements inside the one it is set on.
 *
 * So one stylesheet holds every skin, light and dark, keyed on
 * <html data-skin="...">, and choosing a skin only moves that attribute. Basic
 * removes it, which leaves global.css alone exactly as it was. Dark follows the
 * same .dark class that global.css's own dark values do; more contrast is the
 * browser's prefers-contrast.
 */

const STYLE_ID = 'lavenderbook-skins';

/** Marks what Unskinned wraps, for the stylesheet below. */
const UNSKINNED = 'lavenderbook-unskinned';

/** Marks a sheet's root: dark mode's elevated surfaces (useElevatedSurface). */
const ELEVATED = 'lavenderbook-elevated';

function declarations(skin: Skin, variant: SkinVariant, only?: string[]): string {
  const palette = skinPalette(skin, variant);
  const picked = only
    ? Object.fromEntries(only.map((name) => [name, palette[name as keyof typeof palette]]))
    : palette;
  const lines = Object.entries(paletteVariables(picked)).map(
    ([name, value]) => `${name}: ${value};`
  );
  if (!only) lines.push(`--radius: ${SKIN_TOKENS[skin].radius}px;`);
  return lines.join(' ');
}

const ELEVATED_COLORS = ['background', 'grouped', 'card', 'popover', 'muted', 'accent'];

/**
 * Chenfeng's typeface. On an Apple device -apple-system is San Francisco and
 * nothing is downloaded; everywhere else that name means nothing and the
 * browser falls through to Inter, served from the app itself rather than a
 * font service that would learn who visits. A browser fetches a face only when
 * text uses it, so Apple devices never fetch these.
 */
const INTER_FACES: [number, number][] = [
  [400, require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf')],
  [500, require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf')],
  [600, require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf')],
  [700, require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf')],
];

const CHENFENG_FONT = `-apple-system, BlinkMacSystemFont, 'LavenderBook Inter', system-ui, sans-serif`;

/**
 * Material's typeface, Roboto, and its icons, Material Symbols - served from the
 * app like Inter, and fetched only once Material draws with them.
 */
const ROBOTO_FACES: [number, number][] = [
  [400, require('@expo-google-fonts/roboto/400Regular/Roboto_400Regular.ttf')],
  [500, require('@expo-google-fonts/roboto/500Medium/Roboto_500Medium.ttf')],
  [700, require('@expo-google-fonts/roboto/700Bold/Roboto_700Bold.ttf')],
];

const MATERIAL_SYMBOLS = require('@expo-google-fonts/material-symbols-rounded/400Regular/MaterialSymbolsRounded_400Regular.ttf');

const MATERIAL_FONT = `'LavenderBook Roboto', Roboto, system-ui, sans-serif`;

/**
 * OAU's typefaces, served from the app like the others: Source Sans 3 for all
 * text, Halant for what the Text component's oauStyle marks as a title. Its
 * italic stands in for the guide's handwriting (Klee One is 8 MB).
 */
const SOURCE_SANS_FACES: [number, string, number][] = [
  [400, 'normal', require('@expo-google-fonts/source-sans-3/400Regular/SourceSans3_400Regular.ttf')],
  [400, 'italic', require('@expo-google-fonts/source-sans-3/400Regular_Italic/SourceSans3_400Regular_Italic.ttf')],
  [600, 'normal', require('@expo-google-fonts/source-sans-3/600SemiBold/SourceSans3_600SemiBold.ttf')],
  [700, 'normal', require('@expo-google-fonts/source-sans-3/700Bold/SourceSans3_700Bold.ttf')],
];

const HALANT_FACES: [number, number][] = [
  [500, require('@expo-google-fonts/halant/500Medium/Halant_500Medium.ttf')],
  [600, require('@expo-google-fonts/halant/600SemiBold/Halant_600SemiBold.ttf')],
];

const OAU_FONT = `'LavenderBook Source Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

function fontRules(): string[] {
  const faces = INTER_FACES.map(
    ([weight, module]) =>
      `@font-face { font-family: 'LavenderBook Inter'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('${Asset.fromModule(module).uri}') format('truetype'); }`
  );
  faces.push(
    ...ROBOTO_FACES.map(
      ([weight, module]) =>
        `@font-face { font-family: 'LavenderBook Roboto'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('${Asset.fromModule(module).uri}') format('truetype'); }`
    ),
    // block, not swap: an icon drawn in a fallback font is its name in letters.
    `@font-face { font-family: '${MATERIAL_SYMBOLS_FAMILY}'; font-style: normal; font-weight: 400; font-display: block; src: url('${Asset.fromModule(MATERIAL_SYMBOLS).uri}') format('truetype'); }`,
    // Material's text, as Chenfeng's below - but not the symbols, which are
    // text too and carry their own font.
    `:root[data-skin='material'] [class*='css-text']:not(.${UNSKINNED} *, .gm-style *, [data-material-symbol]) { font-family: ${MATERIAL_FONT}; }`
  );
  // The app's text and text fields - react-native-web's Text and TextInput,
  // whose classes start css-text - which it otherwise sets in its own system
  // stack. Not a rule on every element: inherited into Google's map, another
  // typeface stops it drawing its tiles at all. Nor what Unskinned keeps Basic.
  faces.push(
    `:root[data-skin='chenfeng'] [class*='css-text']:not(.${UNSKINNED} *, .gm-style *) { font-family: ${CHENFENG_FONT}; }`
  );
  faces.push(
    ...SOURCE_SANS_FACES.map(
      ([weight, style, module]) =>
        `@font-face { font-family: 'LavenderBook Source Sans'; font-style: ${style}; font-weight: ${weight}; font-display: swap; src: url('${Asset.fromModule(module).uri}') format('truetype'); }`
    ),
    ...HALANT_FACES.map(
      ([weight, module]) =>
        `@font-face { font-family: 'LavenderBook Halant'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url('${Asset.fromModule(module).uri}') format('truetype'); }`
    ),
    `:root[data-skin='oau'] [class*='css-text']:not(.${UNSKINNED} *, .gm-style *) { font-family: ${OAU_FONT}; }`
  );
  return faces;
}

function stylesheet(): string {
  const rules: string[] = [];
  for (const skin of ['material', 'chenfeng', 'oau'] as const) {
    rules.push(`:root[data-skin='${skin}'] { ${declarations(skin, { scheme: 'light' })} }`);
    rules.push(`.dark:root[data-skin='${skin}'] { ${declarations(skin, { scheme: 'dark' })} }`);
    if (SKIN_TOKENS[skin].contrast) {
      rules.push(
        `@media (prefers-contrast: more) { :root[data-skin='${skin}'] { ${declarations(skin, { scheme: 'light', contrast: true })} } .dark:root[data-skin='${skin}'] { ${declarations(skin, { scheme: 'dark', contrast: true })} } }`
      );
    }
    if (SKIN_TOKENS[skin].elevated) {
      rules.push(
        `.dark:root[data-skin='${skin}'] .${ELEVATED} { ${declarations(skin, { scheme: 'dark', elevated: true }, ELEVATED_COLORS)} }`
      );
      rules.push(
        `@media (prefers-contrast: more) { .dark:root[data-skin='${skin}'] .${ELEVATED} { ${declarations(skin, { scheme: 'dark', elevated: true, contrast: true }, ELEVATED_COLORS)} } }`
      );
    }
  }
  // OAU's tabs: each one's colour over the skin's own (theme.ts, OAU_TAB_TINTS).
  for (const tab of Object.keys(OAU_TAB_TINTS) as OauTab[]) {
    const tint = Object.entries(paletteVariables(OAU_TAB_TINTS[tab]))
      .map(([name, value]) => `${name}: ${value};`)
      .join(' ');
    if (tint) rules.push(`:root[data-skin='oau'] .${oauTintClass(tab)} { ${tint} }`);
  }
  rules.push(...fontRules());
  // Basic again inside Unskinned, but only while a skin is on: under Basic
  // nothing here matches and global.css applies untouched.
  rules.push(`:root[data-skin] .${UNSKINNED} { ${declarations('basic', { scheme: 'light' })} }`);
  rules.push(
    `.dark:root[data-skin] .${UNSKINNED} { ${declarations('basic', { scheme: 'dark' })} }`
  );
  return rules.join('\n');
}

function applySkin(skin: Skin) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.append(style);
  }
  // Compared rather than written once, so editing a token reaches the page on
  // a fast refresh.
  const css = stylesheet();
  if (style.textContent !== css) style.textContent = css;

  const root = document.documentElement;
  if (skin === 'basic') delete root.dataset.skin;
  else root.dataset.skin = skin;
}

export function SkinProvider({ skin, children }: React.PropsWithChildren<{ skin: Skin }>) {
  // Nothing to wait for: the browser loads Inter as text needs it.
  const value = React.useMemo(() => ({ skin, setSkin: chooseSkin, fontsReady: true }), [skin]);

  // Before layout and paint, so a screen is never drawn in one skin's shapes and
  // another's colours. Runs in the browser only: the static render has no page.
  React.useInsertionEffect(() => {
    applySkin(skin);
  }, [skin]);

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

/**
 * Keeps what it wraps in Basic whatever the skin: the variables are set on the
 * whole page here, so the safety notice and "Leave now" get Basic's back.
 *
 * display: contents - a box that is not there. Nothing inside moves or changes
 * size; all it does is hand its variables down.
 */
export function Unskinned({ children }: React.PropsWithChildren) {
  return (
    <View className={UNSKINNED} style={{ display: 'contents' }}>
      {children}
    </View>
  );
}

/**
 * For the root view of anything presented above the app - a sheet, a menu: in
 * Chenfeng's dark mode it lifts the surfaces inside onto iOS's elevated
 * colours. Here that is a class the stylesheet above keys on.
 */
export function useElevatedSurface(): { style?: object; className?: string } {
  const { skin } = useSkin();
  return skin === 'chenfeng' ? { className: ELEVATED } : {};
}
