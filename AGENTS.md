# LavenderBook — agent guide

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Stack

| Concern    | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Expo SDK 57 (React Native 0.86, React 19.2), expo-router       |
| Styling    | NativeWind v4 (`className` prop) + Tailwind CSS **v3**         |
| Components | react-native-reusables (shadcn-style, copy-paste into repo)    |
| Backend    | Supabase (Postgres + Auth + Realtime) — not wired up yet       |
| Maps       | react-native-maps + Google Places API — not wired up yet       |

Source lives under `src/`. Routes are `src/app/**` (expo-router file-based routing).
Path alias `@/*` → `./src/*`, `@/assets/*` → `./assets/*`.

## UI: use react-native-reusables first

**Default to a react-native-reusables component. Do not hand-roll a button, input,
dialog, select, etc., and do not pull in another UI kit.**

Order of preference:

1. An existing component in `src/components/ui/` — check here first.
2. Not there yet? Add it with the CLI (this writes the source into the repo, shadcn-style):
   ```bash
   npx @react-native-reusables/cli@latest add <component>
   ```
   Full catalogue: https://reactnativereusables.com/docs/components
   (accordion, alert, alert-dialog, aspect-ratio, avatar, badge, button, card,
   checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, input,
   label, menubar, popover, progress, radio-group, select, separator, skeleton,
   switch, tabs, text, textarea, toggle, toggle-group, tooltip)
3. Only compose primitives by hand when nothing in the catalogue fits. Build it out of
   existing `ui/` components and NativeWind classes rather than `StyleSheet`.

Because components are copied into `src/components/ui/`, editing them directly is
expected and fine — that is the point of the library. Re-running `add` for an existing
component needs `--overwrite` and will discard local edits.

Sanity check after touching setup: `npx @react-native-reusables/cli@latest doctor`

## Styling rules

- Style with NativeWind `className`, not `StyleSheet.create`, in new code.
- Use the semantic theme tokens, never raw hex/colors: `bg-background`, `text-foreground`,
  `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`,
  `bg-card`, `border-border`, `bg-destructive`. They are HSL CSS variables defined in
  `src/global.css` and mapped in `tailwind.config.js`; dark mode is handled via those
  variables, so a correctly-tokened screen is automatically dark-mode correct.
- Tokens are also available as plain JS values in `src/lib/theme.ts` (`THEME`, `NAV_THEME`)
  for APIs that need a color string rather than a class.
- Merge conditional classes with `cn()` from `@/lib/utils`.
- **All text must be inside a `<Text>` component** — import it from `@/components/ui/text`
  (not from `react-native`), so it inherits theme + variant styling. This includes button
  labels: `<Button><Text>Save</Text></Button>`.

## Version constraints — do not "upgrade" these

- **Tailwind must stay on v3.** NativeWind v4 uses the v3 config format
  (`tailwind.config.js`, `@tailwind base/components/utilities`). Tailwind v4 syntax
  (`@import "tailwindcss"`, CSS-first config) will break the build.
- **NativeWind stays on v4.x.** v5 is preview-only and pairs with Tailwind v4; the
  react-native-reusables registry currently targets v4.
- `metro.config.js` must keep `{ input: './src/global.css', inlineRem: 16 }` —
  react-native-reusables sizing assumes `inlineRem: 16`.
- `babel.config.js` must keep `jsxImportSource: 'nativewind'` or `className` silently
  stops working.
- `<PortalHost />` is rendered last in `src/app/_layout.tsx`. Overlay components
  (dialog, dropdown-menu, popover, tooltip, select) will not appear if it is removed.

## Navigation

Routes live in `src/app/`. Tab screens go in the `src/app/(tabs)/` group; `(tabs)` is a
group, so URLs are unaffected (`(tabs)/index.tsx` is `/`).

- `src/app/_layout.tsx` — root `Stack`. Screens pushed here (venue detail, modals) cover
  the tab bar. Keep `<PortalHost />` last.
- `src/app/(tabs)/_layout.tsx` — the tab navigator, using `expo-router/ui` headless tabs.
- `src/components/tab-bar.tsx` — the visible bars. Add or rename a tab by editing `TABS`
  there **and** the matching `<TabTrigger>` in the hidden `<TabList>`.

Three rules that are easy to break:

1. **The hidden `<TabList>` must stay a direct child of `<Tabs>` and stay unconditional.**
   expo-router discovers routes by walking `Fragment -> TabList -> TabTrigger` only; a
   `TabList` inside a wrapper registers zero routes. Rendering it conditionally rebuilds
   the navigator and remounts screens on resize.
2. **Screens inside `(tabs)` never use `SafeAreaView`.** The layout owns every inset (the
   header/spacer on top, the bottom bar below). A screen adding its own double-pads.
   Screens pushed by the root `Stack` are full-screen and *should* use it.
3. **In a `TabTrigger asChild` child, keep destructuring away the injected `style` prop.**
   `TabTrigger` injects `flexDirection`/`justifyContent` inline, and an inline style beats
   `className` in NativeWind.

Wide viewports (>= 768dp) get a top header row; narrower ones get a bottom icons-only bar.
The branch is `useWindowDimensions()` in `(tabs)/_layout.tsx`, not a `md:` class — we need
two structurally different trees, and the installed `react-native-css-interop` compares
`max-width` with a strict `<`, so `max-md:` is off by one. Note `app.json` sets
`orientation: "portrait"`, so phones never reach 768dp; the header is web/tablet only.

## Icons

`lucide-react-native` (matches shadcn) rendered through `src/components/ui/icon.tsx`:

```tsx
import { Star } from 'lucide-react-native';
<Icon as={Star} className="size-6" />
```

`Icon` reads `TextClassContext`, so an icon inside a component that sets that context
inherits its text color with no color prop — that is how the tab bar colors icon and
label together. Lucide's `Map` export shadows the JS `Map` global; alias it
(`Map as MapIcon`).

## Known gaps

- `_layout.tsx` uses `useColorScheme()` from `react-native`. With `web.output: "static"`,
  a prerendered light page hydrating into dark can mismatch. If that shows up, add a
  hydration-safe wrapper rather than reaching for the deleted template hook.
