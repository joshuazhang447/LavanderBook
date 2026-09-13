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
2. **The tabs layout does not pad for the status bar; screens do.** The map deliberately
   runs edge to edge under the notch, so the layout adds no top spacer. A screen that
   needs to clear the status bar applies `useSafeAreaInsets().top` itself, skipping it
   when `useIsWideViewport().isWide` (the header row already clears it). The bottom bar
   still owns the bottom inset, so screens must not add that. Screens pushed by the root
   `Stack` are full-screen and should use `SafeAreaView`.
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

## Admin area

`/admin` is **web only**. `src/app/admin.web.tsx` is the real screen; `src/app/admin.tsx`
is a `<Redirect href="/" />` that exists solely because expo-router refuses a route that
has only a platform extension ("does not have a fallback sibling file without a platform
extension"). The panel lives in `src/components/admin/` and nothing in the native bundle
imports it.

There is no admin password, secret or token anywhere in the repo. An admin is an ordinary
Supabase Auth user whose id is in `public.admins`; `public.is_admin()` is what authorises,
and it is called inside every admin RPC rather than trusted from the client. The **first**
admin is a manual `insert` with the service role — see the header of
`supabase/migrations/20260911061500_admin_roles_and_moderation.sql`. After that, an admin
grants and revokes access from Users → row actions, via `admin_set_admin`, which refuses
to revoke the caller's own row so the panel cannot be left with no admins in it.

The panel says **Custom fields**; the schema says `questions`, `question_options` and
`question_tags`. Same thing — the tables were not renamed for a label. A question belongs
to no tag, one, or many (`question_tags`), and its position is per-tag: `sort_order` lives
on the join, not on the question, because a shared question sits in a different place in
each tag that asks it.

Two rules follow from that:

1. **Anything the panel does needs its own `security definer` function that opens with
   `if not public.is_admin() then raise exception ... using errcode = '42501'`.** Rendering
   the panel is a client-side decision and can be forced; the function is the boundary.
2. **Do not grant an admin capability with an RLS policy where a function will do.** A
   policy grants the whole row — `admin_set_banned` exists so the panel can toggle
   `banned_at` and nothing else.

`src/components/question-field.tsx` — the control a tag question is answered with — is
shared by the panel's previews and the app's review form, which is why it lives outside
`admin/` and must stay there. `review_answers` has no insert grant on purpose: the only
writer is `submit_review`, and a policy would let a client skip its validation. Nothing in
the panel edits an answer either — `admin_update_review` writes stars, the bathroom answer
and the body, and nothing else.

Two link-throughs land on Reviews: a place's review count in Places, and an account's
posted count in Users. Both go through `showReviews()` in `panel.tsx`, which carries a
`ReviewFocus` (`{ kind: 'author' | 'venue', id, label }`) **and a nonce**. The nonce is
what makes clicking the same count twice re-apply, and arriving by a link resets the other
filters — otherwise a rating filter set ten minutes ago silently empties the list you just
asked for. Arriving from the nav clears the focus and keeps the filters, which is why
`select()` deliberately does not bump the nonce. A count of zero is not a link.

An admin editing someone else's review stamps `reviews.admin_edited_at` / `admin_edited_by`.
`reviews_set_updated_at` fires on an admin edit exactly as it does on the author's own, so
without that column the two are indistinguishable and the change reads as the author's.

Shared rather than copied per section: `src/components/admin/filters.tsx` (`useDebounced`,
`FilterSelect`) and, in `src/lib/answers.ts`, `formatStoredAnswer` with the config/money
helpers — the venue sheet's aggregate cards and the panel's per-review expansion render the
same fourteen kinds, and a currency that rounds differently in one of them is a bug nobody
would notice until it mattered.

## Known gaps

- `_layout.tsx` uses `useColorScheme()` from `react-native`. With `web.output: "static"`,
  a prerendered light page hydrating into dark can mismatch. If that shows up, add a
  hydration-safe wrapper rather than reaching for the deleted template hook.
