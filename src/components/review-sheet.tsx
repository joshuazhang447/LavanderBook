import { Trash2, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { Portal } from '@rn-primitives/portal';

import { StarRating, STAR_HINT } from '@/components/star-rating';
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

type ReviewSheetProps = {
  poi: SelectedPoi;
  /** Known when opened from the reviews list; looked up by place id from the map. */
  venueId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ReviewSheet({ poi, venueId: knownVenueId, onClose, onSaved }: ReviewSheetProps) {
  const { session, signInWithGoogle } = useAuth();

  const [stars, setStars] = React.useState<number | null>(null);
  const [bathroom, setBathroom] = React.useState<Answer | null>(null);
  const [body, setBody] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [venueId, setVenueId] = React.useState<string | null>(knownVenueId ?? null);
  const [isExisting, setIsExisting] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const { height: windowHeight } = useWindowDimensions();
  // An explicit pixel height, not a className. A max height on the card did not
  // reliably reach the ScrollView, so the sheet came up full sometimes and
  // collapsed to a scrollable sliver other times.
  const formMaxHeight = Math.round(windowHeight * 0.55);

  const userId = session?.user.id ?? null;

  // Pull back an existing review so the sheet edits it rather than colliding
  // with the one-review-per-venue constraint.
  React.useEffect(() => {
    let active = true;

    (async () => {
      if (!userId) {
        if (active) setLoading(false);
        return;
      }

      let resolvedVenueId = knownVenueId ?? null;

      if (!resolvedVenueId && poi.placeId) {
        const { data: venue } = await supabase
          .from('venues')
          .select('id')
          .eq('google_place_id', poi.placeId)
          .maybeSingle();
        if (!active) return;
        resolvedVenueId = venue?.id ?? null;
      }

      if (resolvedVenueId) {
        setVenueId(resolvedVenueId);

        const { data: review } = await supabase
          .from('reviews')
          .select('stars, trans_bathroom, body')
          .eq('venue_id', resolvedVenueId)
          .eq('author_id', userId)
          .maybeSingle();

        if (!active) return;
        if (review) {
          setStars(review.stars);
          setBathroom(review.trans_bathroom);
          setBody(review.body ?? '');
          setIsExisting(true);
        }
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId, poi.placeId, knownVenueId]);

  const tooLong = body.length > MAX_BODY;
  const canSubmit = stars !== null && bathroom !== null && !tooLong && !busy;

  async function remove() {
    if (!venueId || !userId) return;

    setError(null);
    setBusy(true);
    try {
      const { error: deleteError } = await supabase
        .from('reviews')
        .delete()
        .eq('venue_id', venueId)
        .eq('author_id', userId);
      if (deleteError) throw deleteError;
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete your review.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    // Guard again here, not just on the button: state could change between render
    // and press, and the checks below are what the database will enforce anyway.
    if (stars === null || bathroom === null || tooLong || !userId) return;

    setError(null);
    setBusy(true);
    try {
      // Reuse the venue if somebody already added it; only insert when new.
      let targetVenueId: string | undefined = venueId ?? undefined;

      if (!targetVenueId && poi.placeId) {
        const { data: existing } = await supabase
          .from('venues')
          .select('id')
          .eq('google_place_id', poi.placeId)
          .maybeSingle();
        targetVenueId = existing?.id;
      }

      if (!targetVenueId) {
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
        targetVenueId = created.id;
      }

      const { error: reviewError } = await supabase.from('reviews').upsert(
        {
          venue_id: targetVenueId,
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
    // Rendered through the portal host at the app root. Positioned absolutely
    // inside the list, it would anchor to the padded content column instead of
    // the screen and land in the middle of the page.
    <Portal name="review-sheet">
      <View className="absolute inset-0 justify-end">
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(160)}
          className="absolute inset-0">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="flex-1 bg-black/50"
          />
        </Animated.View>
        <KeyboardAvoidingView behavior="padding">
          <Animated.View
            // A plain timed slide. A spring overshoots the resting position and
            // reads as the sheet bouncing.
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(200)}
            // overflow-hidden matters: without it the form paints outside the
            // card's max height and spills over the map behind.
            className="overflow-hidden rounded-t-3xl border-t border-border bg-background">
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
              <ScrollView
                ref={scrollRef}
                style={{ maxHeight: formMaxHeight }}
                keyboardShouldPersistTaps="handled">
                <View className="gap-6 p-5">
                  <View className="gap-2">
                    <Text className="font-medium text-foreground">
                      How LGBTQ+ friendly is this place?
                    </Text>
                    <StarRating value={stars} onChange={setStars} />
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
                      onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
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
                    <Text>{busy ? 'Saving...' : isExisting ? 'Save changes' : 'Post review'}</Text>
                  </Button>

                  {isExisting ? (
                    <Animated.View entering={FadeIn.duration(200)}>
                      <Button
                        variant={confirmingDelete ? 'destructive' : 'outline'}
                        disabled={busy}
                        // Two taps, because a delete here is unrecoverable and the
                        // button sits right under the one people mean to press.
                        onPress={() => (confirmingDelete ? remove() : setConfirmingDelete(true))}>
                        <Icon as={Trash2} className="size-4" />
                        <Text>{confirmingDelete ? 'Tap again to delete' : 'Delete review'}</Text>
                      </Button>
                    </Animated.View>
                  ) : null}

                  {stars === null || bathroom === null ? (
                    <Text className="-mt-3 text-center text-xs text-muted-foreground">
                      Pick a rating and answer the bathroom question to post.
                    </Text>
                  ) : null}
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Portal>
  );
}
