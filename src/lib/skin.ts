import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { AppState, Platform } from 'react-native';

import { useOnAdmin } from '@/lib/safety';

/**
 * The look of the app: its buttons, switches and tab bar, and the colours and
 * corner radius under them. Three, every one of them on every platform:
 *
 *   basic     the original look
 *   material  Material 3
 *   chenfeng  the current iOS look as SwiftUI draws it: grouped grey pages,
 *             system blue, and glass on everything that floats - specified in
 *             docs/chenfeng-design-guideline.md
 *
 * Never call any of them by a platform's name on screen: an iOS app may not
 * name other mobile platforms (App Store guideline 2.3.10), which is why the
 * second is "Material".
 *
 * Kept on this device and nowhere else, like where the map opens - nothing
 * about it belongs on an account. Until someone picks, each platform gets the
 * one that looks at home on it. "Leave now" wipes the device's storage, which
 * takes the choice with it.
 *
 * Two things never change with it: the safety notice with "Leave now", and the
 * admin panel. The root layout keeps both outside the skin.
 */

export type Skin = 'basic' | 'material' | 'chenfeng';

/** In the order the setting lists them. */
export const SKINS: readonly { id: Skin; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'material', label: 'Material' },
  { id: 'chenfeng', label: 'Chenfeng' },
];

/** Until someone picks: the one that looks at home on this platform. */
export const DEFAULT_SKIN: Skin = Platform.select<Skin>({
  android: 'material',
  ios: 'chenfeng',
  default: 'basic',
});

type State = {
  /** False until the saved choice has been read. */
  ready: boolean;
  /** Null until someone picks one: the platform's default applies. */
  chosen: Skin | null;
};

const STORAGE_KEY = 'lavenderbook.skin.v1';

let state: State = { ready: false, chosen: null };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
/**
 * Bumped by every choice, so a read that started before it cannot land after
 * it and put the old skin back.
 */
let choices = 0;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function isSkin(value: unknown): value is Skin {
  return value === 'basic' || value === 'material' || value === 'chenfeng';
}

async function read(): Promise<Skin | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { skin?: unknown }) : null;
    return isSkin(parsed?.skin) ? parsed.skin : null;
  } catch {
    // Unreadable is the same as never chosen: the platform's default.
    return null;
  }
}

async function reload() {
  const before = choices;
  const chosen = await read();
  if (before === choices) emit({ chosen, ready: true });
}

function load(): Promise<void> {
  loading ??= reload();
  return loading;
}

// "Leave now" wipes the device's storage while the app keeps running behind the
// browser it opens. Reading the choice again whenever the app comes back lets
// that wipe reach memory too, so whoever opens it next finds the default look -
// without safety.ts having to know this setting exists. The website needs none
// of this: leaving it unloads the page.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (next) => {
    if (next === 'active' && state.ready) void reload();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => {
    listeners.delete(listener);
  };
}

/** Pick a skin. Applies at once, everywhere, and is remembered on this device. */
export async function chooseSkin(skin: Skin): Promise<void> {
  choices += 1;
  emit({ chosen: skin, ready: true });
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ skin }));
  } catch {
    // Storage can be unavailable (a private browser window). The choice still
    // holds until the app is closed; the next visit starts from the default.
  }
}

export type SkinChoice = {
  /** The skin in use: the one picked, or the platform's default. */
  skin: Skin;
  /** Whether someone picked it, rather than it being the default. */
  chosen: boolean;
  ready: boolean;
};

/** The device's setting, wherever it is read. Most code wants useSkin instead. */
export function useSkinChoice(): SkinChoice {
  const snapshot = React.useSyncExternalStore(subscribe, () => state, () => state);
  return {
    skin: snapshot.chosen ?? DEFAULT_SKIN,
    chosen: snapshot.chosen !== null,
    ready: snapshot.ready,
  };
}

/**
 * The skin the app is drawn in right now: the device's setting, except on the
 * admin panel, which is staff only and always Basic. For the root layout.
 */
export function useAppSkin(): Skin {
  const { skin } = useSkinChoice();
  return useOnAdmin() ? 'basic' : skin;
}

type SkinContextValue = {
  skin: Skin;
  setSkin: (skin: Skin) => Promise<void>;
  /**
   * The skin's own fonts have loaded: Chenfeng's typeface where the system's is
   * not San Francisco (Inter, on Android); Material's icons, and Roboto on iOS.
   * Until then text is drawn in the system font. Always true where nothing
   * needs loading.
   */
  fontsReady: boolean;
};

/**
 * Basic by default: anything drawn outside SkinProvider - the safety notice and
 * "Leave now" - keeps the original look whatever is chosen.
 */
export const SkinContext = React.createContext<SkinContextValue>({
  skin: 'basic',
  setSkin: chooseSkin,
  fontsReady: true,
});

/**
 * Which skin to draw in. Components that look different per skin branch on
 * this rather than on the device's setting, so that the parts kept outside the
 * skin stay Basic.
 */
export function useSkin(): SkinContextValue {
  return React.useContext(SkinContext);
}
