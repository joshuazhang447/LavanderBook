import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';

export default function AccountScreen() {
  const { session, profile, loading, signInWithGoogle, signOut } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="w-full max-w-md gap-6 self-center px-6 pt-8">
        <Text className="text-3xl font-bold text-foreground">My Account</Text>

        {session ? (
          <Card>
            <CardHeader>
              <CardTitle>{profile?.display_name ?? 'Loading name...'}</CardTitle>
              <CardDescription>
                This is the only name shown on your reviews. Your email is never public.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" disabled={busy} onPress={() => run(signOut)}>
                <Text>Sign out</Text>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                An account lets you post reviews. You are given an anonymous name, so nothing
                you write is tied to your real identity in public.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled={busy} onPress={() => run(signInWithGoogle)}>
                <Text>{busy ? 'Opening Google...' : 'Continue with Google'}</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      </View>
    </View>
  );
}
