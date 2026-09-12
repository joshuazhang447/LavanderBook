import { Stack, useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminPanel } from '@/components/admin/panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { adminSignIn, useIsAdmin } from '@/lib/admin';
import { useAuth } from '@/lib/auth';

/**
 * The admin area.
 *
 * `.web.tsx` is the statement about mobile: this file is the route on the web,
 * and on native the route resolves to admin.tsx next door, which redirects to
 * the map. Nothing here is reachable from that file, so none of the panel is in
 * the native bundle.
 *
 * What this screen still is not is a security boundary. It decides what to
 * render, and what a client renders is a decision the client owns - anyone can
 * force this page to draw the panel. The difference from the sign-in it replaced
 * is that the panel is now empty when they do: every call behind it re-checks
 * is_admin() in Postgres and refuses. The gate below is for the honest case, so
 * that someone who is not an admin is told so plainly instead of being shown a
 * screen full of failed requests.
 */
export default function AdminScreen() {
  const { session, loading, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Unlike the tabs, this is a page people arrive at by typing a URL. */}
      <Stack.Screen options={{ title: 'Admin' }} />

      {loading || (session && isAdmin === undefined) ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !session ? (
        <SignInCard />
      ) : !isAdmin ? (
        <View className="flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-sm">
            <CardHeader className="items-center gap-2">
              <Icon as={ShieldAlert} className="size-8 text-muted-foreground" />
              <CardTitle>Not an administrator</CardTitle>
              <CardDescription className="text-center">
                {session.user.email ?? 'This account'} is signed in, but is not on the admin list.
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-3">
              <Button variant="outline" onPress={signOut}>
                <Text>Sign out</Text>
              </Button>
              <Button variant="ghost" onPress={() => router.replace('/')}>
                <Text>Back to the map</Text>
              </Button>
            </CardContent>
          </Card>
        </View>
      ) : (
        <AdminPanel email={session.user.email ?? null} onSignOut={signOut} />
      )}
    </SafeAreaView>
  );
}

/**
 * Ordinary Supabase Auth, which is the point of this commit.
 *
 * Nothing here validates anything: the credentials go to GoTrue, which hashes
 * and compares them, rate limits the attempts, and hands back a session the app
 * already knows how to persist and refresh. There is no second credential store,
 * no token of our own invention, and no reason for a reload to sign anyone out.
 *
 * Both ways in are offered because admins arrive by both routes and neither
 * covers the other. An admin created in the dashboard has a password and no
 * Google identity; an existing user promoted by adding a row to public.admins
 * usually signed up with Google and therefore has no password at all, so the
 * form above could never let them in. Which one you are is not this screen's
 * business - being in public.admins is.
 */
function SignInCard() {
  const { signInWithGoogle } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function withGoogle() {
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
    }
    setBusy(false);
  }

  async function submit() {
    if (busy || email.trim().length === 0 || password.length === 0) return;

    setBusy(true);
    setError(null);

    const outcome = await adminSignIn(email.trim(), password);

    if (outcome.ok) {
      // The session arrives through AuthProvider's subscription, which swaps
      // this card for the panel. Drop the password either way.
      setPassword('');
    } else {
      setError(outcome.message);
    }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView className="flex-1 items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-1">
          <CardTitle>Admin sign-in</CardTitle>
          <CardDescription>This area is restricted.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">Email</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="email"
              textContentType="username"
              returnKeyType="next"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">Password</Text>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>

          {error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator size="small" /> : <Text>Sign in</Text>}
          </Button>

          <View className="flex-row items-center gap-3 py-1">
            <Separator className="flex-1" />
            <Text className="text-xs text-muted-foreground">or</Text>
            <Separator className="flex-1" />
          </View>

          <Button variant="outline" onPress={withGoogle} disabled={busy}>
            <Text>Continue with Google</Text>
          </Button>
        </CardContent>
      </Card>
    </KeyboardAvoidingView>
  );
}
