import * as React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet, SheetCloseButton, SheetScrollView, SheetToolbar } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import { SIGN_IN_PITCH } from '@/lib/privacy-text';

/**
 * Signing in, in Chenfeng (guideline section 14.9): a medium sheet with ✕, why
 * an account is safe to have, and the one way in. Google is the only
 * provider, by decision; its own branding rules govern its button.
 */
export function SignInSheet({ onClose }: { onClose: () => void }) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Sheet
      name="chenfeng-sign-in"
      detents={['medium']}
      accessibilityLabel="Sign In"
      onClose={onClose}
      toolbar={<SheetToolbar leading={<SheetCloseButton />} title="Sign In" />}>
      <SheetScrollView contentContainerClassName="gap-5 px-5 pb-8 pt-2">
        <Text textStyle="body" className="text-foreground">
          {SIGN_IN_PITCH}
        </Text>
        <View className="gap-2">
          <Button
            size="lg"
            disabled={busy}
            onPress={async () => {
              setError(null);
              setBusy(true);
              try {
                await signInWithGoogle();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Something went wrong.');
              } finally {
                setBusy(false);
              }
            }}>
            <Text>{busy ? 'Opening Google…' : 'Continue with Google'}</Text>
          </Button>
          {error ? (
            <Text textStyle="footnote" role="alert" className="text-destructive">
              {error}
            </Text>
          ) : null}
        </View>
      </SheetScrollView>
    </Sheet>
  );
}
