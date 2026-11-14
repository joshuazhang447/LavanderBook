import * as React from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Each tag's chosen icon (tags.icon), by slug, for everything that draws a
 * kind: map pins, the Directory's rows and badges, the panel's tag list.
 *
 * Fetched once per session, from the public tags table - the icon is a
 * column of its own rather than part of every venue row, so the functions
 * that send venues did not need to change, and a tag's new icon reaches every
 * place at once. Readers pass what this returns to kindIcon(slug, chosen).
 *
 * Until it arrives, and on a server from before the column, every kind draws
 * its slug's default (src/lib/kind-icons.ts), which is what it drew before.
 */
type State = {
  /** slug -> icon key, or null where the tag has none set. */
  icons: Readonly<Record<string, string | null>>;
  /** False on a server without tags.icon: the panel then hides its picker. */
  supported: boolean | null;
};

const EMPTY: State = { icons: {}, supported: null };
let state: State = EMPTY;
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

function load(): Promise<void> {
  request ??= (async () => {
    const { data, error } = await supabase.from('tags').select('slug, icon');
    if (error) {
      // 42703: no such column - a server from before 20261114120000.
      publish({ icons: {}, supported: error.code === '42703' ? false : state.supported });
      if (error.code !== '42703') request = null;
      return;
    }
    publish({
      icons: Object.fromEntries((data ?? []).map((row) => [row.slug, row.icon ?? null])),
      supported: true,
    });
  })();
  return request;
}

/** Fetch again: after the panel changes a tag's icon, so the change shows at once. */
export function refreshTagIcons(): Promise<void> {
  request = null;
  return load();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => {
    listeners.delete(listener);
  };
}

/** slug -> chosen icon key. Re-renders when the icons arrive or change. */
export function useTagIcons(): Readonly<Record<string, string | null>> {
  return React.useSyncExternalStore(
    subscribe,
    () => state.icons,
    () => EMPTY.icons
  );
}

/** Whether this server has tags.icon at all; null until known. */
export function useTagIconsSupported(): boolean | null {
  return React.useSyncExternalStore(
    subscribe,
    () => state.supported,
    () => EMPTY.supported
  );
}
