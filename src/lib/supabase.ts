import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill it in from Supabase > Project Settings > API, ' +
      'then restart the dev server (env vars are inlined at build time).'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On web the browser's own storage is used; on native we must supply one.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // PKCE is the right flow for a public client like a mobile app: the redirect
    // carries a short-lived code rather than the tokens themselves.
    flowType: 'pkce',
    // Only the web build ever has a URL to read the session back out of.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Supabase refreshes tokens on a timer, which the OS suspends in the background.
// Restart it when the app is foregrounded so a returning user is not logged out.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
