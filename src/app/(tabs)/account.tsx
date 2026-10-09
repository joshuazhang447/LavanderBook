import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { MyReviewsList } from '@/components/my-reviews-list';
import { PerPlaceNamesSetting } from '@/components/per-place-names';
import { useIsWideViewport } from '@/components/tab-bar';
import { useAuth } from '@/lib/auth';

export default function AccountScreen() {
  const { session, profile, loading, signInWithGoogle, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  // On wide the header row already clears the status bar; on narrow nothing does.
  const topInset = isWide ? 0 : insets.top;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Bumped when turning per-place names on has renamed reviews in the list below. */
  const [renames, setRenames] = React.useState(0);

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
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      {/* The reviews list grows with every review posted, so this has to scroll.
          Bottom padding only - the tab bar owns the bottom inset itself. */}
      <ScrollView className="flex-1" contentContainerClassName="pb-10">
        <View className="w-full max-w-md gap-6 self-center px-6 pt-8">
          <Text className="text-3xl font-bold text-foreground">My Account</Text>

          {session ? (
            <Card>
              <CardHeader>
                <CardTitle>{profile?.display_name ?? 'Loading name...'}</CardTitle>
                <CardDescription>
                  {/* Unknown until the profile arrives, so say only what is
                      true either way rather than guess at the switch. */}
                  {profile === null
                    ? 'Your account name. Your email is never public.'
                    : profile.per_place_names
                      ? 'Your account name. Your reviews never show it: each one has its own. Your email is never public.'
                      : 'Your account name, shown on reviews you post from now on. Your email is never public.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="gap-4">
                <PerPlaceNamesSetting onRenamed={() => setRenames((count) => count + 1)} />
                <Button variant="outline" disabled={busy} onPress={() => run(signOut)}>
                  <Text>Sign out</Text>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {session ? (
            // Keyed by account, so a different one starts from an empty list
            // rather than briefly showing the last one's reviews.
            <MyReviewsList key={session.user.id} renames={renames} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Sign in</CardTitle>
                <CardDescription>
                  An account lets you post reviews. You are given an anonymous name, and each
                  review gets a name of its own, so nothing you write is tied to your real
                  identity, or to your other reviews, in public.
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
      </ScrollView>
    </View>
  );
}
