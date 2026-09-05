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

/**
 * Read a parameter from either the query string or the fragment. Supabase puts
 * a PKCE `code` in the query, but the implicit flow returns tokens in the hash.
 */
function readParam(url: string, name: string): string | null {
  const match = new RegExp(`[?#&]${name}=([^&#]+)`).exec(url);
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : null;
}

/** Parameter names only - never their values, which may contain tokens. */
function describeParams(url: string): string {
  const afterPath = url.replace(/^[^?#]*/, '');
  const names = Array.from(afterPath.matchAll(/[?#&]([^=&]+)=/g)).map((m) => m[1]);
  return names.length > 0 ? names.join(', ') : '(none)';
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

    // Supabase sends back a PKCE code when the flow is honoured...
    const code = readParam(result.url, 'code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      return;
    }

    // ...but falls back to the implicit flow in some paths, where the tokens
    // arrive in the URL fragment instead.
    const accessToken = readParam(result.url, 'access_token');
    const refreshToken = readParam(result.url, 'refresh_token');
    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
      return;
    }

    const description = readParam(result.url, 'error_description');
    throw new Error(
      description ?? `Sign-in returned no code or tokens. Received: ${describeParams(result.url)}`
    );
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
