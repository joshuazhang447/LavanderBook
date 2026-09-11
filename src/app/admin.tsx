import { Stack, useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { adminSignIn } from '@/lib/admin';

/**
 * The admin area, behind a sign-in checked on the server.
 *
 * What this screen does NOT do is worth stating, because it looks like it does:
 * it is not a security boundary. Whether it renders the panel is the client's
 * own decision, and anyone can change that in devtools or by editing the
 * bundle. It is a door, not a wall - it keeps the panel out of the way of
 * people who are not supposed to be here, and it proves to the server that a
 * password was known, which is what the token is for.
 *
 * That is fine while the panel is a placeholder with nothing behind it. It
 * stops being fine the moment there is real data or a real action here: each of
 * those has to be its own server endpoint that verifies the token itself, and
 * must not trust that the caller got past this screen.
 */
export default function AdminScreen() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  /**
   * In memory only, so a reload signs you out.
   *
   * Deliberate: persisting it would mean putting a credential-equivalent in
   * storage, and there is nothing here yet that is worth that. When the panel
   * does something, revisit - but revisit with the session length and a way to
   * revoke, not by quietly adding localStorage.
   */
  const [token, setToken] = React.useState<string | null>(null);

  async function submit() {
    if (busy || name.trim().length === 0 || password.length === 0) return;

    setBusy(true);
    setError(null);

    const outcome = await adminSignIn(name.trim(), password);

    if (outcome.ok) {
      setToken(outcome.token);
      // Not kept in state a moment longer than the request needs it.
      setPassword('');
    } else {
      setError(outcome.message);
    }
    setBusy(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* A title, because unlike the tabs this is a page people reach by URL. */}
      <Stack.Screen options={{ title: 'Admin' }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 items-center justify-center px-6">
        {token ? (
          <Card className="w-full max-w-sm">
            <CardHeader className="items-center gap-2">
              <Icon as={ShieldCheck} className="size-8 text-muted-foreground" />
              <CardTitle>Admin Panel</CardTitle>
              <CardDescription className="text-center">To be developed.</CardDescription>
            </CardHeader>
            <CardContent className="gap-3">
              <Button variant="outline" onPress={() => setToken(null)}>
                <Text>Sign out</Text>
              </Button>
              <Button variant="ghost" onPress={() => router.replace('/')}>
                <Text>Back to the map</Text>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-sm">
            <CardHeader className="gap-1">
              <CardTitle>Admin sign-in</CardTitle>
              <CardDescription>This area is restricted.</CardDescription>
            </CardHeader>
            <CardContent className="gap-3">
              <View className="gap-1.5">
                <Text className="text-sm font-medium text-foreground">Name</Text>
                <Input
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="none"
                  autoCorrect={false}
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
            </CardContent>
          </Card>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
