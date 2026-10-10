import { ShieldAlert } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountSettingsCard } from '@/components/account-settings-card';
import { useLeaveNowReserve } from '@/components/leave-now';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MyReviewsList } from '@/components/my-reviews-list';
import { LeaveNowSetting, LocationSetting } from '@/components/privacy-settings';
import { useIsWideViewport } from '@/components/tab-bar';
import { useAuth } from '@/lib/auth';
import { reopenSafetyNotice } from '@/lib/safety';

export default function AccountScreen() {
  const { session, loading, signInWithGoogle, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  // On wide the header row already clears the status bar; on narrow nothing
  // does - and a phone browser's "Leave now" button holds the corner above the
  // title, which "Partir maintenant" would otherwise all but touch.
  const { top: leaveNow } = useLeaveNowReserve();
  const topInset = (isWide ? 0 : insets.top) + leaveNow;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Bumped when a privacy switch turned on has changed how the reviews below are shown. */
  const [reviewChanges, setReviewChanges] = React.useState(0);

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
            <AccountSettingsCard
              busy={busy}
              onSignOut={() => run(signOut)}
              onReviewsChanged={() => setReviewChanges((count) => count + 1)}
            />
          ) : (
            // A guest's only settings, so nothing to fold. Where the map is,
            // and a way out, have nothing to do with having an account.
            <View className="gap-3">
              <LocationSetting />
              <LeaveNowSetting />
            </View>
          )}

          {session ? (
            // Keyed by account, so a different one starts from an empty list
            // rather than briefly showing the last one's reviews.
            <MyReviewsList key={session.user.id} changes={reviewChanges} />
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

          <Button variant="ghost" className="self-center" onPress={reopenSafetyNotice}>
            <Icon as={ShieldAlert} className="size-4 text-muted-foreground" />
            <Text className="text-muted-foreground">Read the safety notice again</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}
