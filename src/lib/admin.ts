import { supabase } from '@/lib/supabase';

export type AdminSignInOutcome =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; message: string };

/**
 * Check an admin name and password.
 *
 * The guess goes to the server and a yes or no comes back; the real credentials
 * are never in the bundle. See supabase/functions/admin-login for why that is
 * the only arrangement that works - Expo would either omit a non-public env var
 * entirely or publish it.
 *
 * The returned token is signed by the server, so it cannot be forged. It proves
 * a password was known; it does not by itself authorise anything, and any admin
 * endpoint added later has to verify it rather than trusting the caller.
 */
export async function adminSignIn(
  name: string,
  password: string
): Promise<AdminSignInOutcome> {
  const { data, error } = await supabase.functions.invoke('admin-login', {
    body: { name, password },
  });

  if (error) {
    if (error.name === 'FunctionsHttpError') {
      // The function ran and refused. Its message is written for a person and
      // is deliberately vague about which half was wrong.
      const body = await error.context?.json?.().catch(() => null);
      return { ok: false, message: body?.error ?? 'Incorrect name or password.' };
    }

    // Same ambiguity as place search: on web a missing function returns a 404
    // with no CORS headers, which the browser reports exactly as it reports
    // being offline. The developer's half of the answer goes to the console.
    console.warn(
      'admin-login could not be reached. If you are online, it may not be deployed: ' +
        'npx supabase functions deploy admin-login'
    );
    return { ok: false, message: 'Could not reach the server. Check your connection.' };
  }

  if (data?.error) return { ok: false, message: data.error };
  if (!data?.token) return { ok: false, message: 'Incorrect name or password.' };

  return { ok: true, token: data.token, expiresAt: data.expiresAt };
}
