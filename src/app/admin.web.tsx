import { Stack, useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminPanel } from '@/components/admin/panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useIsAdmin } from '@/lib/admin';
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
 * The same Google sign-in as the app, and nothing else.
 *
 * An admin is an ordinary account that has been added to public.admins, and
 * every account signs in with Google, so there is no admin password to type
 * here. There used to be an email and password form for admins created by hand
 * in the dashboard; none was ever used, and the first admin is bootstrapped in
 * SQL instead (see the README). Which account you are is GoTrue's business;
 * whether it may use the panel is is_admin()'s.
 */
function SignInCard() {
  const { signInWithGoogle } = useAuth();
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

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="gap-1">
          <CardTitle>Admin sign-in</CardTitle>
          <CardDescription>This area is restricted.</CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          {error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button onPress={withGoogle} disabled={busy}>
            {busy ? <ActivityIndicator size="small" /> : <Text>Continue with Google</Text>}
          </Button>
        </CardContent>
      </Card>
    </View>
  );
}
