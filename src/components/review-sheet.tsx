import { Trash2, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { Portal } from '@rn-primitives/portal';

import { DirectionsButton } from '@/components/directions-button';
import { QuestionField, type AnswerValue } from '@/components/question-field';
import { StarRating, STAR_HINT } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import type { Database } from '@/lib/database.types';
import {
  answerProblem,
  fetchMyAnswers,
  fetchQuestionnaire,
  isAnswered,
  submitReview,
  toRpcAnswer,
  type AnswerMap,
  type Questionnaire,
} from '@/lib/questionnaire';
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

/**
 * Fades the delete button in on native, and does nothing on the web.
 *
 * Reanimated implements entering and exiting on the web by taking ownership of
 * the DOM node and removing it itself. This one sits inside the sheet card,
 * which has an exiting animation of its own, so on close the parent is torn
 * down first and React is left removing a node that is already gone - "Failed
 * to execute 'removeChild' on 'Node'". Only a venue you have already reviewed
 * renders this button, which is why the crash needed an existing review.
 *
 * Native is unaffected, so it keeps the animation.
 */
function DeleteButtonEntrance({ children }: React.PropsWithChildren) {
  if (Platform.OS === 'web') return <View>{children}</View>;
  return <Animated.View entering={FadeIn.duration(200)}>{children}</Animated.View>;
}

/** PostgREST errors carry the SQLSTATE; the sheet reacts to one of them. */
function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;
}

type TagQuestionsProps = {
  questionnaire: Questionnaire;
  answers: AnswerMap;
  problems: ReadonlyMap<string, string>;
  disabled: boolean;
  onChange: (questionId: string, value: AnswerValue) => void;
};

/**
 * The venue's tag questions, between the bathroom question and the free text.
 *
 * One intro naming the tags, then the questions grouped by tag. The group gets
 * its own pill only when there is more than one - with a single tag the intro
 * has already said whose questions these are. Labels use the sheet's own
 * typography, not the admin preview's smaller one: here they sit beside the
 * bathroom question and must read as its equal.
 */
function TagQuestions({ questionnaire, answers, problems, disabled, onChange }: TagQuestionsProps) {
  // A tag can have nothing to ask once shared questions are deduplicated under
  // an earlier one; it still belongs in the sentence, just not as a section.
  const asking = questionnaire.filter((tag) => tag.questions.length > 0);
  if (asking.length === 0) return null;

  return (
    <View className="gap-5">
      {/* A callout, not a question. Set in the muted box the panel uses for
          previews, with a small-caps label rather than a prompt-weight one, so
          it reads as the sheet explaining itself and not as the first thing
          to answer. */}
      <View className="gap-1.5 rounded-md border border-border bg-muted/30 p-3">
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          About this kind of place
        </Text>
        {/* No horizontal gap: the words carry their own spaces, so the comma
            after a pill sits against it instead of floating a gap away. */}
        <View className="flex-row flex-wrap items-center gap-y-1">
          <Text className="text-sm text-muted-foreground">{'Because this place is listed as '}</Text>
          {questionnaire.map((tag, index) => (
            <React.Fragment key={tag.id}>
              {index > 0 ? (
                <Text className="text-sm text-muted-foreground">
                  {index === questionnaire.length - 1 ? ' and ' : ', '}
                </Text>
              ) : null}
              <TagPill tag={tag} />
            </React.Fragment>
          ))}
          <Text className="text-sm text-muted-foreground">
            {', we ask a few extra questions. Answer what you know and skip the rest.'}
          </Text>
        </View>
      </View>

      {asking.map((tag) => (
        <View key={tag.id} className="gap-5">
          {asking.length > 1 ? (
            <View className="flex-row">
              <TagPill tag={tag} />
            </View>
          ) : null}
          {tag.questions.map((question) => (
            <View key={question.id} className="gap-2">
              <Text className="font-medium text-foreground">
                {question.prompt}
                {question.required ? <Text className="text-destructive"> *</Text> : null}
              </Text>
              {question.helpText ? (
                <Text className="text-xs text-muted-foreground">{question.helpText}</Text>
              ) : null}
              <QuestionField
                kind={question.kind}
                config={question.config}
                options={question.options}
                value={answers[question.id] ?? null}
                onChange={(value) => onChange(question.id, value)}
                disabled={disabled}
              />
              {problems.get(question.id) ? (
                <Text className="text-xs text-destructive">{problems.get(question.id)}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

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
  const [questionnaire, setQuestionnaire] = React.useState<Questionnaire>([]);
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  const scrollRef = React.useRef<ScrollView>(null);
  const { height: windowHeight } = useWindowDimensions();
  // The card needs a definite height for the ScrollView inside it to flex into;
  // maxHeight alone is only a cap. 60% leaves room for the keyboard to lift the
  // whole card without pushing its top off screen.
  const sheetHeight = Math.round(windowHeight * 0.6);

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

        // The review and the venue's questions arrive together, behind the one
        // spinner: prefilled answers have to be there at first paint, and a
        // section appearing under a thumb already heading for Post is worse
        // than a slightly longer wait.
        const [{ data: review }, tags] = await Promise.all([
          supabase
            .from('reviews')
            .select('id, stars, trans_bathroom, body')
            .eq('venue_id', resolvedVenueId)
            .eq('author_id', userId)
            .maybeSingle(),
          // An untagged venue has no questions. A failed fetch looks the same,
          // and the review still posts - stars and the bathroom answer are
          // worth more than a blocked form.
          fetchQuestionnaire(resolvedVenueId).catch((): Questionnaire => []),
        ]);
        if (!active) return;
        setQuestionnaire(tags);

        if (review) {
          setStars(review.stars);
          setBathroom(review.trans_bathroom);
          setBody(review.body ?? '');
          setIsExisting(true);

          const byId = new Map(tags.flatMap((tag) => tag.questions).map((q) => [q.id, q] as const));
          const mine = await fetchMyAnswers(review.id, byId).catch((): AnswerMap => ({}));
          if (!active) return;
          setAnswers(mine);
        }
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId, poi.placeId, knownVenueId]);

  const tooLong = body.length > MAX_BODY;

  const questions = questionnaire.flatMap((tag) => tag.questions);
  const missingRequired = questions.filter(
    (question) => question.required && !isAnswered(question.kind, answers[question.id] ?? null)
  );
  const problems = new Map<string, string>();
  for (const question of questions) {
    const problem = answerProblem(question, answers[question.id] ?? null);
    if (problem) problems.set(question.id, problem);
  }

  const canSubmit =
    stars !== null &&
    bathroom !== null &&
    !tooLong &&
    missingRequired.length === 0 &&
    problems.size === 0 &&
    !busy;

  // One sentence about whatever is in the way, or nothing.
  const basicsMissing = stars === null || bathroom === null;
  const blockingHint =
    basicsMissing && missingRequired.length > 0
      ? 'Pick a rating, answer the bathroom question and the questions marked * to post.'
      : basicsMissing
        ? 'Pick a rating and answer the bathroom question to post.'
        : missingRequired.length > 0
          ? 'Answer the questions marked * to post.'
          : problems.size > 0
            ? 'Fix the highlighted answer to post.'
            : null;

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
    if (missingRequired.length > 0 || problems.size > 0) return;

    setError(null);
    setBusy(true);
    // Reuse the venue if somebody already added it; only insert when new.
    let targetVenueId: string | undefined = venueId ?? undefined;
    try {

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

      // Review and answers land together or not at all; the server validates
      // every answer against the question's own kind and settings.
      await submitReview({
        venueId: targetVenueId,
        stars,
        bathroom,
        body: body.trim() === '' ? null : body.trim(),
        answers: questions.flatMap((question) => {
          const value = toRpcAnswer(question, answers[question.id] ?? null);
          return value === null ? [] : [{ question_id: question.id, value }];
        }),
      });

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your review.');
      // A required question added since the form opened. The error names it;
      // fetching again puts it on the form, marked, under that error.
      if (hasCode(e, '23514') && targetVenueId) {
        fetchQuestionnaire(targetVenueId)
          .then(setQuestionnaire)
          .catch(() => {});
      }
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
            // Unconditional. When this depended on `loading`, the card rendered
            // short while the existing-review lookup was in flight, the entering
            // animation captured that height, and the sheet opened as a sliver -
            // intermittently, because sometimes the lookup won the race.
            style={{ height: sheetHeight }}
            className="overflow-hidden rounded-t-3xl border-t border-border bg-background">
            <View className="flex-row items-start gap-3 px-5 pb-2 pt-5">
              <View className="flex-1 gap-0.5">
                <Text className="text-xl font-semibold text-foreground">{poi.name}</Text>
                <Text className="text-xs text-muted-foreground">
                  {poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}
                </Text>
              </View>
              <DirectionsButton
                name={poi.name}
                latitude={poi.latitude}
                longitude={poi.longitude}
                placeId={poi.placeId}
              />
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="rounded-full p-2 active:bg-accent">
                <Icon as={X} className="size-5 text-muted-foreground" />
              </Pressable>
            </View>

            {loading ? (
              <View className="flex-1 items-center justify-center gap-2 p-8">
                <ActivityIndicator />
              </View>
            ) : !session ? (
              <View className="flex-1 justify-center gap-4 p-5">
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
                className="flex-1"
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

                  {questionnaire.length > 0 ? (
                    <TagQuestions
                      questionnaire={questionnaire}
                      answers={answers}
                      problems={problems}
                      disabled={busy}
                      onChange={(questionId, value) =>
                        setAnswers((current) => ({ ...current, [questionId]: value }))
                      }
                    />
                  ) : null}

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
                    <DeleteButtonEntrance>
                      <Button
                        variant={confirmingDelete ? 'destructive' : 'outline'}
                        disabled={busy}
                        // Two taps, because a delete here is unrecoverable and the
                        // button sits right under the one people mean to press.
                        onPress={() => (confirmingDelete ? remove() : setConfirmingDelete(true))}>
                        <Icon as={Trash2} className="size-4" />
                        <Text>{confirmingDelete ? 'Tap again to delete' : 'Delete review'}</Text>
                      </Button>
                    </DeleteButtonEntrance>
                  ) : null}

                  {blockingHint ? (
                    <Text className="-mt-3 text-center text-xs text-muted-foreground">
                      {blockingHint}
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
