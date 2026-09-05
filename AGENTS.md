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

## Legacy template files

`src/components/themed-text.tsx`, `themed-view.tsx`, `hint-row.tsx`, `web-badge.tsx` and
`src/constants/theme.ts` came from the Expo starter template. Prefer react-native-reusables
+ NativeWind for anything new; delete these once nothing imports them.
