/**
 * Admin sign-in, checked on the server.
 *
 * The credentials cannot live in the app, and not only because they should not:
 * Expo inlines EXPO_PUBLIC_* variables into the bundle at build time and passes
 * nothing else through, so a plain ADMIN_PASSWORD in .env is simply absent from
 * the client, and prefixing it to make it present would publish it. There is no
 * setting where a client-side password check both works and is safe.
 *
 * So the password stays here, in a secret, and the app only ever sends a guess
 * and gets a yes or a no.
 *
 * Deploy:
 *   npx supabase secrets set ADMIN_NAME=... ADMIN_PASSWORD=... ADMIN_SESSION_SECRET=...
 *   npx supabase functions deploy admin-login
 *
 * ADMIN_SESSION_SECRET signs the returned token and should be a long random
 * string unrelated to the password - e.g. `openssl rand -base64 48`.
 */

/** How long a successful sign-in is good for. */
const SESSION_MS = 60 * 60 * 1000;

/**
 * Brute-force brake.
 *
 * In memory, so it is a speed bump rather than a wall: edge instances are
 * short-lived and there may be several, so a determined attacker gets more than
 * MAX_ATTEMPTS overall. It is still worth having - it turns an online guessing
 * attack from thousands of tries a minute into a handful - but the actual
 * defence is that the password is long and random. A real limiter would keep
 * its counters in Postgres.
 */
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; first: number }>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const encoder = new TextEncoder();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Hex SHA-256. Used to give the comparison below a fixed length. */
async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compares without leaking where the mismatch was.
 *
 * A plain === returns as soon as two characters differ, and the time that takes
 * is measurable over enough requests - enough to recover a secret one character
 * at a time. Callers pass digests, so the lengths always match and the loop
 * always runs to the end.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/**
 * A token the client cannot forge: expiry plus its HMAC.
 *
 * Stateless on purpose - there is no session table to keep, and nothing to
 * clean up. Any admin endpoint added later must verify this before doing
 * anything, because the sign-in screen in front of it protects nothing on its
 * own: whether a page renders is the client's decision, and the client is the
 * attacker.
 */
async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64url(new Uint8Array(signature));
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const seen = attempts.get(ip);

  if (!seen || now - seen.first > ATTEMPT_WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }

  seen.count++;
  return seen.count > MAX_ATTEMPTS;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const name = Deno.env.get('ADMIN_NAME');
  const password = Deno.env.get('ADMIN_PASSWORD');
  const sessionSecret = Deno.env.get('ADMIN_SESSION_SECRET');

  if (!name || !password || !sessionSecret) {
    // Refuse rather than fall through to a comparison against undefined, which
    // would let an empty guess in.
    console.error('ADMIN_NAME, ADMIN_PASSWORD or ADMIN_SESSION_SECRET is not set.');
    return json({ error: 'Admin sign-in is not configured.' }, 500);
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip)) {
    return json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429);
  }

  let guessName = '';
  let guessPassword = '';
  try {
    const body = await request.json();
    guessName = typeof body.name === 'string' ? body.name : '';
    guessPassword = typeof body.password === 'string' ? body.password : '';
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const [nameOk, passwordOk] = await Promise.all([
    digest(guessName).then(async (g) => timingSafeEqual(g, await digest(name))),
    digest(guessPassword).then(async (g) => timingSafeEqual(g, await digest(password))),
  ]);

  // Both checks always run, and the reply never says which half was wrong -
  // "no such user" would confirm the ones that do exist.
  if (!nameOk || !passwordOk) {
    return json({ error: 'Incorrect name or password.' }, 401);
  }

  const expiresAt = Date.now() + SESSION_MS;
  const token = `${expiresAt}.${await sign(String(expiresAt), sessionSecret)}`;

  return json({ ok: true, token, expiresAt });
});
