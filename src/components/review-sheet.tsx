import { Clock, EyeOff, Info, Trash2, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ChenfengReviewSheet } from '@/components/chenfeng/review-sheet';
import { DirectionsButton } from '@/components/directions-button';
import { InfoBullets, InfoDialog, InfoPoint } from '@/components/info-dialog';
import { QuestionField, type AnswerValue } from '@/components/question-field';
import { StarRating, STAR_HINT } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { HELD_AFTER_POST } from '@/lib/moderation-text';
import type { AnswerMap, Questionnaire } from '@/lib/questionnaire';
import { BATHROOM_OPTIONS, MAX_BODY, useReviewForm, WHAT_NOT_TO_WRITE } from '@/lib/review-form';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';
import type { SelectedPoi } from '@/lib/venues';

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

export type ReviewSheetProps = {
  poi: SelectedPoi;
  /** Known when opened from the reviews list; looked up by place id from the map. */
  venueId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ReviewSheet(props: ReviewSheetProps) {
  const { skin } = useSkin();
  // Chenfeng's form is a full-height sheet of grouped sections with Post in
  // its toolbar (its own file); Basic and Material keep this one. Both run on
  // useReviewForm, so what is checked and saved is the same.
  return skin === 'chenfeng' ? <ChenfengReviewSheet {...props} /> : <BasicReviewSheet {...props} />;
}

function BasicReviewSheet({ poi, venueId: knownVenueId, onClose, onSaved }: ReviewSheetProps) {
  const { session, signInWithGoogle } = useAuth();
  const {
    stars,
    setStars,
    bathroom,
    setBathroom,
    body,
    setBody,
    loading,
    busy,
    error,
    isExisting,
    questionnaire,
    answers,
    setAnswers,
    problems,
    tooLong,
    canSubmit,
    identity,
    blockingHint,
    remove,
    submit,
    outcome,
    finish,
  } = useReviewForm({ poi, venueId: knownVenueId, onSaved });
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  /** The "what not to write" explanation behind the free-text field's (i). */
  const [explainingBody, setExplainingBody] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

  return (
    // Opens most of the way up - 60% leaves room for the keyboard to lift it
    // without pushing its top off screen - and its handle and top row drag it
    // to full height.
    <BottomSheet
      name="review-sheet"
      onClose={onClose}
      accessibilityLabel={poi.name}
      partial={0.6}
      keyboardAvoiding
      header={
        <View className="flex-row items-start gap-3 px-5 pb-2 pt-2">
          <View className="flex-1 gap-0.5">
            <Text className="text-xl font-semibold text-foreground">{poi.name}</Text>
            {/* An online organisation has no coordinates to show or route to. */}
            {poi.latitude !== null && poi.longitude !== null ? (
              <Text className="text-xs text-muted-foreground">
                {poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}
              </Text>
            ) : null}
          </View>
          {poi.latitude !== null && poi.longitude !== null ? (
            <DirectionsButton
              name={poi.name}
              latitude={poi.latitude}
              longitude={poi.longitude}
              placeId={poi.placeId}
            />
          ) : null}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="rounded-full p-2 active:bg-accent">
            <Icon as={X} className="size-5 text-muted-foreground" />
          </Pressable>
        </View>
      }>
      {loading ? (
        <View className="flex-1 items-center justify-center gap-2 p-8">
          <ActivityIndicator />
        </View>
      ) : outcome === 'held' ? (
        // Posted, and waiting for a person: said before the sheet closes, or
        // the review would seem to vanish from the map it was just posted to.
        <View className="flex-1 items-center justify-center gap-3 p-6">
          <Icon as={Clock} className="size-10 text-muted-foreground" />
          <Text className="text-center text-lg font-semibold text-foreground">
            {HELD_AFTER_POST.title}
          </Text>
          <Text className="text-center text-sm text-muted-foreground">{HELD_AFTER_POST.body}</Text>
          <Button onPress={finish} className="mt-2 self-stretch">
            <Text>{HELD_AFTER_POST.done}</Text>
          </Button>
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
              {/* The label and its (i) together open the explanation, so
                  the target is the whole label rather than a 16-pixel
                  icon. */}
              <Pressable
                onPress={() => setExplainingBody(true)}
                accessibilityRole="button"
                accessibilityLabel="What not to write, and why"
                hitSlop={6}
                className={cn(
                  'flex-row items-center gap-1.5 self-start',
                  Platform.select({ web: 'cursor-pointer hover:opacity-80' })
                )}>
                <Text className="font-medium text-foreground">What happened? (optional)</Text>
                <Icon as={Info} className="size-4 text-muted-foreground" />
              </Pressable>
              {/* The free text is the one part of a review that no switch
                  can protect: a per-place name and a rough date hide who
                  and when, and a sentence can give both back. So the
                  warning sits where the writing starts. */}
              <Textarea
                value={body}
                onChangeText={setBody}
                onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                maxLength={MAX_BODY}
                placeholder="Anything worth knowing before someone else walks in. Leave out names, dates, times and anything else that could identify you."
                numberOfLines={4}
              />
              <InfoDialog
                open={explainingBody}
                onOpenChange={setExplainingBody}
                icon={EyeOff}
                title={WHAT_NOT_TO_WRITE.title}
                lead={WHAT_NOT_TO_WRITE.lead}>
                <InfoPoint title="Why it matters">{WHAT_NOT_TO_WRITE.whyItMatters}</InfoPoint>
                <InfoPoint title="Leave out">
                  <InfoBullets items={WHAT_NOT_TO_WRITE.leaveOut} />
                </InfoPoint>
                <InfoPoint title="Write about the place">
                  {WHAT_NOT_TO_WRITE.writeAbout}
                </InfoPoint>
              </InfoDialog>
              <Text
                className={
                  tooLong ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'
                }>
                {body.length} / {MAX_BODY}
              </Text>
            </View>

            {identity.length > 0 ? (
              <View className="gap-1.5">
                {identity.map((line) => (
                  <View key={line.text} className="flex-row items-center gap-2">
                    <Icon as={line.icon} className="size-4 text-muted-foreground" />
                    <Text className="flex-1 text-xs text-muted-foreground">{line.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}

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
    </BottomSheet>
  );
}
