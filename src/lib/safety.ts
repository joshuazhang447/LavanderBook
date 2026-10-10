import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { usePathname } from 'expo-router';
import * as React from 'react';
import { BackHandler, Linking, Platform } from 'react-native';

import { forgetMapLocation } from '@/lib/map-location';
import {
  SAFETY_LANGUAGES,
  type SafetyLanguage,
  type SafetyText,
} from '@/lib/safety-notice-text';
import { supabase } from '@/lib/supabase';

/**
 * The safety notice, and "Leave now".
 *
 * Everyone sees the notice once, before anything else, wherever they are: the
 * app never tries to work out the country, because a lookup that could tell
 * would tell someone else too. Accepting it is remembered on this device only.
 *
 * "Leave now" signs out, wipes everything the app keeps on the device and
 * swaps to an everyday website in the reader's language. On the website it is
 * a button on every screen (the person can hide it) and Shift pressed 3 times;
 * in the phone app it is only on the notice - an app can be closed, or
 * uninstalled, which the notice tells people at risk to do.
 */

type Saved = {
  accepted: boolean;
  /** Null until picked on the notice: until then, the device's language. */
  language: SafetyLanguage | null;
  /** The website's button on every screen. */
  leaveButton: boolean;
};

type State = {
  /** False until the saved state has been read. */
  ready: boolean;
  saved: Saved;
  /** Opened again from My Account. In memory only. */
  reopened: boolean;
};

const STORAGE_KEY = 'lavenderbook.safety.v1';
const FRESH: Saved = { accepted: false, language: null, leaveButton: true };

let state: State = { ready: false, saved: FRESH, reopened: false };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

async function save(next: Partial<Saved>) {
  const saved = { ...state.saved, ...next };
  emit({ saved });
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage can be unavailable (a private window): the notice then shows
    // again next visit, which is the safe way round.
  }
}

function isLanguage(value: unknown): value is SafetyLanguage {
  return typeof value === 'string' && value in SAFETY_LANGUAGES;
}

function load(): Promise<void> {
  loading ??= (async () => {
    let saved = FRESH;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<Saved>) : null;
      if (parsed) {
        saved = {
          accepted: parsed.accepted === true,
          language: isLanguage(parsed.language) ? parsed.language : null,
          // Anything but an explicit false is on: hiding it is the choice.
          leaveButton: parsed.leaveButton !== false,
        };
      }
    } catch {
      // Unreadable is the same as never seen: show the notice.
    }
    emit({ saved, ready: true });
  })();
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The first of the phone's or browser's languages that the notice has been
 * reviewed in; English otherwise. Any Chinese gets Simplified - the only
 * Chinese there is, and readable to most who read Traditional.
 */
function deviceLanguage(): SafetyLanguage {
  try {
    for (const locale of getLocales()) {
      const code = locale.languageCode?.toLowerCase();
      if (isLanguage(code)) return code;
    }
  } catch {
    // No locale information: English.
  }
  return 'en';
}

export type Safety = {
  ready: boolean;
  /** Accepted on this device, at some point. */
  accepted: boolean;
  /** The notice is up: not yet accepted, or opened again. */
  noticeOpen: boolean;
  language: SafetyLanguage;
  text: SafetyText;
  rtl: boolean;
  /** The person's setting for the website's button, whether or not it is showing. */
  leaveButton: boolean;
};

/** Neither the notice nor "Leave now" belongs on the admin panel, which is staff only. */
export function useOnAdmin(): boolean {
  return usePathname().startsWith('/admin');
}

export function useSafety(): Safety {
  const snapshot = React.useSyncExternalStore(subscribe, () => state, () => state);
  const onAdmin = useOnAdmin();
  // Read once per mount: getLocales is cheap, but not free, and the device's
  // language does not change while a screen is up.
  const fallback = React.useMemo(() => (snapshot.ready ? deviceLanguage() : 'en'), [snapshot.ready]);
  const language = snapshot.saved.language ?? fallback;
  const info = SAFETY_LANGUAGES[language];

  return {
    ready: snapshot.ready,
    accepted: snapshot.saved.accepted,
    noticeOpen:
      !onAdmin && snapshot.ready && (!snapshot.saved.accepted || snapshot.reopened),
    language,
    text: info.text,
    rtl: info.rtl,
    leaveButton: snapshot.saved.leaveButton,
  };
}

/**
 * The app is covered: by the notice, or - before the saved state has been
 * read - by a blank screen, so that someone who has not seen the notice never
 * glimpses the map first.
 */
export function useSafetyCovering(): boolean {
  const { ready, noticeOpen } = useSafety();
  const onAdmin = useOnAdmin();
  return !onAdmin && (!ready || noticeOpen);
}

/** Whether the website's "Leave now" button is on screen right now. */
export function useLeaveNowShown(): boolean {
  const { ready, noticeOpen, leaveButton } = useSafety();
  const onAdmin = useOnAdmin();
  return Platform.OS === 'web' && ready && !noticeOpen && leaveButton && !onAdmin;
}

const COMPUTER_QUERY = '(hover: hover) and (pointer: fine)';

function subscribeComputer(listener: () => void) {
  if (Platform.OS !== 'web' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(COMPUTER_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function isComputer(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(COMPUTER_QUERY).matches
  );
}

/**
 * A mouse or trackpad: what the Shift key is mentioned on. Phones and tablets
 * have no keyboard to press it on, in the app or in the browser.
 */
export function useIsComputer(): boolean {
  return React.useSyncExternalStore(subscribeComputer, isComputer, () => false);
}

export function acceptSafetyNotice(): Promise<void> {
  emit({ reopened: false });
  return save({ accepted: true });
}

export function chooseSafetyLanguage(language: SafetyLanguage): Promise<void> {
  return save({ language });
}

export function setLeaveNowButton(enabled: boolean): Promise<void> {
  return save({ leaveButton: enabled });
}

/** From My Account: read the notice again. */
export function reopenSafetyNotice() {
  emit({ reopened: true });
}

// Kept current from the client's own events, so "Leave now" can end the
// session without first awaiting a read of it.
let accessToken: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  accessToken = session?.access_token ?? null;
});

/**
 * Ends this session on the server as well - best effort, and never waited for.
 * Wiping the device is what matters if the phone is taken; this stops the
 * session from being used from anywhere else. keepalive lets the request
 * outlive the page on the web.
 */
function endSessionOnServer() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !url || !key) return;
  fetch(`${url}/auth/v1/logout?scope=local`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

function leaveWebsite(to: string) {
  // Blank the page first: the old page stays up until the new one starts to
  // draw, which on a slow connection is a second or more of LavenderBook
  // still on screen - and its name still in the tab.
  document.title = '';
  document.querySelectorAll('link[rel~="icon"]').forEach((icon) => icon.remove());
  document.body.style.visibility = 'hidden';

  // Stop the client writing a refreshed session back after the wipe.
  supabase.auth.stopAutoRefresh();
  try {
    window.localStorage.clear();
  } catch {}
  try {
    window.sessionStorage.clear();
  } catch {}
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }

  // The site it goes to must not learn where the visitor came from.
  const noReferrer = document.createElement('meta');
  noReferrer.name = 'referrer';
  noReferrer.content = 'no-referrer';
  document.head.append(noReferrer);

  // replace, not assign: Back must not come straight back here. Earlier pages
  // of the same visit stay in the tab's history - no page can remove them,
  // which the notice says.
  window.location.replace(to);
}

async function leaveApp(to: string) {
  try {
    await AsyncStorage.clear();
  } catch {}
  // The app keeps running behind the browser, so forget in memory as well:
  // the next person to open it finds it as if new, notice first.
  void supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  forgetMapLocation();
  emit({ saved: FRESH, reopened: false });
  try {
    await Linking.openURL(to);
  } catch {}
  // Android lets an app close itself; iOS does not.
  if (Platform.OS === 'android') BackHandler.exitApp();
}

let leaving = false;

/**
 * Leave at once: no question asked, because a panic button that asks "are you
 * sure?" fails exactly when it is needed. A tap by mistake costs a sign-in.
 */
export function leaveNow() {
  if (leaving) return;
  leaving = true;
  const language = state.saved.language ?? deviceLanguage();
  const to = SAFETY_LANGUAGES[language].leaveTo;

  endSessionOnServer();
  if (Platform.OS === 'web') {
    leaveWebsite(to);
    return;
  }
  void leaveApp(to).finally(() => {
    leaving = false;
  });
}

/** Within this long of the previous press, a Shift press counts towards three. */
const PRESS_GAP_MS = 700;

/**
 * Shift pressed 3 times in quick succession leaves, on the website. Any other
 * key in between starts the count again, so typing capitals never adds up,
 * and holding Shift down counts once.
 */
export function usePanicKey(enabled: boolean) {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    let presses = 0;
    let last = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Shift') {
        presses = 0;
        return;
      }
      if (event.repeat) return;
      presses = event.timeStamp - last <= PRESS_GAP_MS ? presses + 1 : 1;
      last = event.timeStamp;
      if (presses >= 3) {
        presses = 0;
        leaveNow();
      }
    };
    // Shift-clicking to select text is not a run of presses either.
    const reset = () => {
      presses = 0;
    };

    // Capture, so a field that stops the event cannot swallow it.
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', reset, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', reset, true);
    };
  }, [enabled]);
}
