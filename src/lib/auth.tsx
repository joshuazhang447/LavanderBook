import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as React from 'react';
import { Platform } from 'react-native';

import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

type AuthState = {
  /** null once loaded and signed out; undefined while still restoring. */
  session: Session | null;
  profile: Profile | null;
  /** True until the stored session has been restored from disk. */
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthState | null>(null);

/** Pull the PKCE `code` out of the URL the browser redirects back to. */
function readAuthCode(url: string): string | null {
  const match = /[?&]code=([^&#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Fires for sign-in, sign-out, and token refresh.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // The profile row is created by a database trigger at signup, so it is fetched
  // rather than written here.
  React.useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    let active = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (active) setProfile(data ?? null);
      });

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  // Derived rather than cleared in an effect, so the previous account's name can
  // never flash after signing out or switching users.
  const currentProfile = session && profile?.id === session.user.id ? profile : null;

  const signInWithGoogle = React.useCallback(async () => {
    const redirectTo = Linking.createURL('/');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // We open the browser ourselves so the native flow can await the result.
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });
    if (error) throw error;

    // On web, supabase-js redirects the page itself and picks the session back
    // up on reload via detectSessionInUrl.
    if (Platform.OS === 'web' || !data.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return; // user dismissed the browser

    const code = readAuthCode(result.url);
    if (!code) throw new Error('Google sign-in did not return an authorization code.');

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }, []);

  const signOut = React.useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = React.useMemo(
    () => ({ session, profile: currentProfile, loading, signInWithGoogle, signOut }),
    [session, currentProfile, loading, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
