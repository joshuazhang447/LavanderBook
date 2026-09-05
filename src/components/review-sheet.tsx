import { Star, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { SelectedPoi } from '@/lib/venues';

type Answer = Database['public']['Enums']['answer'];

/** Mirrors the reviews_body_length check constraint. */
const MAX_BODY = 2000;

const BATHROOM_OPTIONS: { value: Answer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
];

const STAR_HINT: Record<number, string> = {
  1: 'Hostile',
  2: 'Unwelcoming',
  3: 'Neutral',
  4: 'Welcoming',
  5: 'Actively welcoming',
};

type ReviewSheetProps = {
  poi: SelectedPoi;
  onClose: () => void;
  onSaved: () => void;
};

export function ReviewSheet({ poi, onClose, onSaved }: ReviewSheetProps) {
  const { session, signInWithGoogle } = useAuth();

  const [stars, setStars] = React.useState<number | null>(null);
  const [bathroom, setBathroom] = React.useState<Answer | null>(null);
  const [body, setBody] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const userId = session?.user.id ?? null;

  // Pull back an existing review so the sheet edits it rather than colliding
  // with the one-review-per-venue constraint.
  React.useEffect(() => {
    let active = true;

    (async () => {
      if (!userId || !poi.placeId) {
        if (active) setLoading(false);
        return;
      }

      const { data: venue } = await supabase
        .from('venues')
        .select('id')
        .eq('google_place_id', poi.placeId)
        .maybeSingle();

      if (!active) return;

      if (venue) {
        const { data: review } = await supabase
          .from('reviews')
          .select('stars, trans_bathroom, body')
          .eq('venue_id', venue.id)
          .eq('author_id', userId)
          .maybeSingle();

        if (!active) return;
        if (review) {
          setStars(review.stars);
          setBathroom(review.trans_bathroom);
          setBody(review.body ?? '');
        }
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId, poi.placeId]);

  const tooLong = body.length > MAX_BODY;
  const canSubmit = stars !== null && bathroom !== null && !tooLong && !busy;

  async function submit() {
    // Guard again here, not just on the button: state could change between render
    // and press, and the checks below are what the database will enforce anyway.
    if (stars === null || bathroom === null || tooLong || !userId) return;

    setError(null);
    setBusy(true);
    try {
      // Reuse the venue if somebody already added it; only insert when new.
      let venueId: string | undefined;

      if (poi.placeId) {
        const { data: existing } = await supabase
          .from('venues')
          .select('id')
          .eq('google_place_id', poi.placeId)
          .maybeSingle();
        venueId = existing?.id;
      }

      if (!venueId) {
        const { data: created, error: venueError } = await supabase
          .from('venues')
          .insert({
            google_place_id: poi.placeId ?? null,
            name: poi.name,
            lat: poi.latitude,
            lng: poi.longitude,
            last_synced_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (venueError) throw venueError;
        venueId = created.id;
      }

      const { error: reviewError } = await supabase.from('reviews').upsert(
        {
          venue_id: venueId,
          author_id: userId,
          stars,
          trans_bathroom: bathroom,
          body: body.trim() === '' ? null : body.trim(),
        },
        { onConflict: 'venue_id,author_id' }
      );
      if (reviewError) throw reviewError;

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="absolute inset-x-0 bottom-0">
      <View className="max-h-[560px] rounded-t-3xl border-t border-border bg-background">
        <View className="flex-row items-start gap-3 px-5 pb-2 pt-5">
          <View className="flex-1 gap-0.5">
            <Text className="text-xl font-semibold text-foreground">{poi.name}</Text>
            <Text className="text-xs text-muted-foreground">
              {poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="rounded-full p-2 active:bg-accent">
            <Icon as={X} className="size-5 text-muted-foreground" />
          </Pressable>
        </View>

        {loading ? (
          <View className="items-center gap-2 p-8">
            <ActivityIndicator />
          </View>
        ) : !session ? (
          <View className="gap-4 p-5">
            <Text className="text-sm text-muted-foreground">
              Sign in to review this place. You post under an anonymous handle, never your real
              name.
            </Text>
            <Button onPress={() => signInWithGoogle().catch(() => {})}>
              <Text>Continue with Google</Text>
            </Button>
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="gap-6 p-5">
              <View className="gap-2">
                <Text className="font-medium text-foreground">
                  How LGBTQ+ friendly is this place?
                </Text>
                <View className="flex-row gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setStars(value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: stars === value }}
                      accessibilityLabel={`${value} of 5, ${STAR_HINT[value]}`}
                      className="rounded-md p-1 active:bg-accent">
                      <Icon
                        as={Star}
                        // Filled gold when earned, a solid grey outline when not.
                        // opacity-30 left the empty stars invisible on white.
                        className={
                          stars !== null && value <= stars
                            ? 'size-9 text-star'
                            : 'size-9 text-muted-foreground'
                        }
                        fill={stars !== null && value <= stars ? 'currentColor' : 'none'}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text className="text-xs text-muted-foreground">
                  {stars ? STAR_HINT[stars] : '1 is hostile, 5 is actively welcoming'}
                </Text>
              </View>

              <View className="gap-2">
                <Text className="font-medium text-foreground">
                  Is there a bathroom trans people can use safely?
                </Text>
                <View className="flex-row gap-2">
                  {BATHROOM_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={bathroom === option.value ? 'default' : 'outline'}
                      onPress={() => setBathroom(option.value)}
                      className="flex-1">
                      <Text>{option.label}</Text>
                    </Button>
                  ))}
                </View>
                <Text className="text-xs text-muted-foreground">
                  Pick &quot;Not sure&quot; if you did not check - a guess helps nobody.
                </Text>
              </View>

              <View className="gap-2">
                <Text className="font-medium text-foreground">What happened? (optional)</Text>
                <Textarea
                  value={body}
                  onChangeText={setBody}
                  maxLength={MAX_BODY}
                  placeholder="Anything worth knowing before someone else walks in."
                  numberOfLines={4}
                />
                <Text
                  className={
                    tooLong ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
                  }>
                  {body.length} / {MAX_BODY}
                </Text>
              </View>

              {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

              <Button disabled={!canSubmit} onPress={submit}>
                <Text>{busy ? 'Saving...' : 'Post review'}</Text>
              </Button>

              {stars === null || bathroom === null ? (
                <Text className="-mt-3 text-center text-xs text-muted-foreground">
                  Pick a rating and answer the bathroom question to post.
                </Text>
              ) : null}
            </View>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
