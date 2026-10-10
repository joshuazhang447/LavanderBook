import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as React from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { countryName, resolveGeneralArea, type GeneralArea } from '@/lib/general-area';
import type { Coords } from '@/lib/use-location';

/**
 * Where the map starts, and whether it follows the user.
 *
 * Three choices, kept on this device and nowhere else - never on the account,
 * because an account tied to a home city is exactly the record the rest of the
 * app is built not to keep:
 *
 *   device  follow the phone's location (needs the OS permission)
 *   area    the general area the phone's time zone points at
 *   city    a city the person picked
 *
 * Declining is never final. The OS prompt is only shown when someone asks for
 * "Near me", so choosing an area does not use it up; when the OS will not show
 * it again, they are sent to the phone's settings, and coming back with
 * location allowed switches the map over on its own.
 */

/** A city from the picker. Stored on the device, so it carries its own words. */
export type SavedCity = Coords & {
  name: string;
  /** Province, state or region; empty when GeoNames has none. */
  region: string;
  /** ISO country code. */
  country: string;
};

export type MapLocationMode = 'device' | 'area' | 'city';

type Saved = {
  mode: MapLocationMode;
  /** Kept when switching to device or area, so turning location off goes back to it. */
  city: SavedCity | null;
};

type Permission = { granted: boolean; canAskAgain: boolean };

type State = {
  /** False until both the saved choice and the permission have been read. */
  ready: boolean;
  /** Null until the person has chosen once: the map shows the first-run choice. */
  saved: Saved | null;
  permission: Permission;
};

const STORAGE_KEY = 'lavenderbook.map-location.v1';

let state: State = {
  ready: false,
  saved: null,
  permission: { granted: false, canAskAgain: true },
};
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;
/**
 * Set when the person was sent to the phone's settings to allow location. The
 * next time the app comes back with location allowed, that request is honoured
 * - and only then: a permission granted for some other reason never switches
 * the map to following on its own.
 */
let awaitingSettings = false;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

async function readPermission(): Promise<Permission> {
  try {
    const result = await Location.getForegroundPermissionsAsync();
    return { granted: result.status === 'granted', canAskAgain: result.canAskAgain };
  } catch {
    return { granted: false, canAskAgain: true };
  }
}

function isSaved(value: unknown): value is Saved {
  const v = value as Saved | null;
  return !!v && (v.mode === 'device' || v.mode === 'area' || v.mode === 'city');
}

async function save(saved: Saved) {
  emit({ saved });
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage can be unavailable (a private browser window). The choice still
    // holds for this session; the next one simply asks again.
  }
}

function load(): Promise<void> {
  loading ??= (async () => {
    let saved: Saved | null = null;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isSaved(parsed)) saved = parsed;
    } catch {
      // Unreadable is the same as never chosen: ask.
    }
    emit({ saved, permission: await readPermission(), ready: true });
  })();
  return loading;
}

async function recheck() {
  const permission = await readPermission();
  emit({ permission });
  if (awaitingSettings && permission.granted) {
    awaitingSettings = false;
    await save({ mode: 'device', city: state.saved?.city ?? null });
  }
}

// The permission can change while the app is away - in the phone's settings,
// or from the browser's address bar - so look again whenever it returns.
AppState.addEventListener('change', (next) => {
  if (next === 'active' && state.ready) void recheck();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => {
    listeners.delete(listener);
  };
}

/** Choose the general area. Never asks for permission. */
export function chooseGeneralArea(): Promise<void> {
  return save({ mode: 'area', city: state.saved?.city ?? null });
}

/** Choose a city from the picker. Never asks for permission. */
export function chooseCity(city: SavedCity): Promise<void> {
  return save({ mode: 'city', city });
}

/**
 * Stop following. Goes back to the city they last picked, or the general area.
 * Takes effect at once and asks nothing: it is the private direction.
 */
export function stopUsingDeviceLocation(): Promise<void> {
  const city = state.saved?.city ?? null;
  return save({ mode: city ? 'city' : 'area', city });
}

/**
 * Ask to follow the phone's location.
 *
 *   granted  following from now on
 *   denied   the person said no to the prompt just now; nothing changes
 *   blocked  the OS will not show the prompt again - call openLocationSettings
 */
export async function chooseDeviceLocation(): Promise<'granted' | 'denied' | 'blocked'> {
  let permission = await readPermission();
  if (!permission.granted && permission.canAskAgain) {
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      permission = { granted: result.status === 'granted', canAskAgain: result.canAskAgain };
    } catch {
      // Treated as a refusal; the caller says so.
    }
  }
  emit({ permission });

  if (permission.granted) {
    await save({ mode: 'device', city: state.saved?.city ?? null });
    return 'granted';
  }
  return permission.canAskAgain ? 'denied' : 'blocked';
}

/**
 * Opens LavenderBook's page in the phone's settings, and switches to following
 * if the person comes back with location allowed. False on the web, where no
 * page can open the browser's settings: the caller explains the padlock instead.
 */
export async function openLocationSettings(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  awaitingSettings = true;
  try {
    await Linking.openSettings();
    return true;
  } catch {
    awaitingSettings = false;
    return false;
  }
}

/**
 * Forget the choice in memory too, after "Leave now" has wiped the app's
 * storage. The app keeps running behind the browser it opened, and must come
 * back as if new: the map asks again from the start.
 */
export function forgetMapLocation() {
  awaitingSettings = false;
  emit({ saved: null });
}

/** Where the map should start when it is not following, with words for it. */
export type StartPlace = Coords & {
  /**
   * "Vancouver area", or a city with what tells it apart from its namesakes -
   * "London, Ontario", not just "London".
   */
  label: string;
  /** "Canada", "Ontario, Canada". */
  detail: string;
};

export type MapLocation = {
  ready: boolean;
  /** Null until the person has chosen once. */
  mode: MapLocationMode | null;
  /** Following the phone right now: chose it, and the OS allows it. */
  usingDevice: boolean;
  /** The general area the phone's settings point at, or null if they point nowhere. */
  area: GeneralArea | null;
  /** The city last picked, kept even while following or on the general area. */
  city: SavedCity | null;
  /**
   * Where the map starts when not following: the picked city or the general
   * area. Null when neither exists - no saved city and no usable time zone -
   * and the map then asks for a city.
   */
  place: StartPlace | null;
};

function cityPlace(city: SavedCity): StartPlace {
  const country = countryName(city.country);
  return {
    latitude: city.latitude,
    longitude: city.longitude,
    label: `${city.name}, ${city.region || country}`,
    detail: city.region ? `${city.region}, ${country}` : country,
  };
}

export function useMapLocation(): MapLocation {
  const snapshot = React.useSyncExternalStore(subscribe, () => state, () => state);
  // Worked out once per mount rather than per render; it reads the phone's
  // settings, which do not change while a screen is up.
  const area = React.useMemo(() => resolveGeneralArea(), []);

  const saved = snapshot.saved;
  const mode = saved?.mode ?? null;
  const usingDevice = mode === 'device' && snapshot.permission.granted;

  const lastCity = saved?.city ? cityPlace(saved.city) : null;
  const areaPlace: StartPlace | null = area
    ? { latitude: area.latitude, longitude: area.longitude, label: area.label, detail: area.country }
    : null;
  // A device choice whose permission has since been revoked falls back the
  // same way turning it off would: to the last city, then the general area.
  const place = mode === 'area' ? (areaPlace ?? lastCity) : (lastCity ?? areaPlace);

  return { ready: snapshot.ready, mode, usingDevice, area, city: saved?.city ?? null, place };
}
