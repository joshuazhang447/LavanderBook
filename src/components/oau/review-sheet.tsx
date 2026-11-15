import { CircleAlert, Clock, EyeOff, Trash2, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import { InfoBullets, InfoDialog, InfoPoint } from '@/components/info-dialog';
import { CautionPaper } from '@/components/oau/caution';
import { IconSticker, OauCard } from '@/components/oau/card';
import { OauSegments } from '@/components/oau/segments';
import { showToast } from '@/components/oau/toast';
import { QuestionField } from '@/components/question-field';
import type { ReviewSheetProps } from '@/components/review-sheet';
import { StarRating, STAR_HINT } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { confirmActionSheet } from '@/components/ui/confirm';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { HELD_AFTER_POST } from '@/lib/moderation-text';
import { OAU_ACCOUNT_TEXT, OAU_REVIEW_TEXT as T } from '@/lib/oau-text';
import { SIGN_IN_PITCH } from '@/lib/privacy-text';
import type { AnswerMap, Questionnaire } from '@/lib/questionnaire';
import { BATHROOM_OPTIONS, MAX_BODY, useReviewForm, WHAT_NOT_TO_WRITE } from '@/lib/review-form';
import { cn } from '@/lib/utils';

/** A question on a card of its own: the prompt, a line under it, the control, a problem. */
function QuestionCard({
  prompt,
  required,
  hint,
  problem,
  children,
}: React.PropsWithChildren<{
  prompt: string;
  required?: boolean;
  hint?: string | null;
  problem?: string | null;
}>) {
  return (
    <OauCard className="gap-3 p-4">
      <Text oauStyle="subheading" className="text-foreground">
        {prompt}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      {children}
      {hint ? (
        <Text oauStyle="caption" className="text-muted-foreground">
          {hint}
        </Text>
      ) : null}
      {problem ? (
        <View className="flex-row items-start gap-1.5">
          <Icon as={CircleAlert} className="mt-0.5 size-4 text-destructive" />
          <Text oauStyle="callout" className="flex-1 text-destructive">
            {problem}
          </Text>
        </View>
      ) : null}
    </OauCard>
  );
}

/** The venue's tag questions, one card each, after a line naming the kinds that ask them. */
function TagQuestions({
  questionnaire,
  answers,
  problems,
  disabled,
  onChange,
}: {
  questionnaire: Questionnaire;
  answers: AnswerMap;
  problems: ReadonlyMap<string, string>;
  disabled: boolean;
  onChange: (questionId: string, value: AnswerMap[string]) => void;
}) {
  const asking = questionnaire.filter((tag) => tag.questions.length > 0);
  if (asking.length === 0) return null;

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center gap-y-1.5">
        <Text oauStyle="callout" className="text-muted-foreground">
          {'Because this place is listed as '}
        </Text>
        {questionnaire.map((tag, index) => (
          <React.Fragment key={tag.id}>
            {index > 0 ? (
              <Text oauStyle="callout" className="text-muted-foreground">
                {index === questionnaire.length - 1 ? ' and ' : ', '}
              </Text>
            ) : null}
            <TagPill tag={tag} />
          </React.Fragment>
        ))}
        <Text oauStyle="callout" className="text-muted-foreground">
          {', we ask a few extra questions. Answer what you know and skip the rest.'}
        </Text>
      </View>

      {asking.map((tag) => (
        <View key={tag.id} className="gap-3">
          {asking.length > 1 ? (
            <View className="flex-row">
              <TagPill tag={tag} />
            </View>
          ) : null}
          {tag.questions.map((question) => (
            <QuestionCard
              key={question.id}
              prompt={question.prompt}
              required={question.required}
              hint={question.helpText}
              problem={problems.get(question.id)}>
              <QuestionField
                kind={question.kind}
                config={question.config}
                options={question.options}
                value={answers[question.id] ?? null}
                onChange={(value) => onChange(question.id, value)}
                disabled={disabled}
              />
            </QuestionCard>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * OAU's review form (LavenderBookStyle/oau-style-guide.md, section 14.6): a
 * tall sheet of paper, the place's name over "Your review", each question on a
 * card of its own - the stars with their meaning written under them, the
 * bathroom question as segments, the free text under a caution paper saying
 * what to leave out - then who readers will see, and Post pinned at the foot
 * with what is still in the way. Deleting asks first. Everything checked and
 * saved is useReviewForm's, as in every skin.
 */
export function OauReviewSheet({ poi, venueId: knownVenueId, onClose, onSaved }: ReviewSheetProps) {
  const { session, signInWithGoogle } = useAuth();
  // What the last press asked for, so the toast says what happened.
  const pressed = React.useRef<'post' | 'save' | 'delete'>('post');
  const form = useReviewForm({
    poi,
    venueId: knownVenueId,
    onSaved: () => {
      showToast(
        pressed.current === 'delete'
          ? { title: T.deleted }
          : pressed.current === 'save'
            ? { title: T.saved }
            : { title: T.posted, line: T.thanks }
      );
      onSaved();
    },
  });
  const [explainingBody, setExplainingBody] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  // Where the free text's card starts in the form, to scroll it into view.
  const bodyTop = React.useRef(0);
  const held = form.outcome === 'held';
  const ready = !!session && !form.loading && !held;

  // What the form held once loaded, to tell whether closing loses anything.
  const current = JSON.stringify([form.stars, form.bathroom, form.body, form.answers]);
  const [initial, setInitial] = React.useState<string | null>(null);
  if (ready && initial === null) setInitial(current);
  const hasChanges = initial !== null && initial !== current;

  // Closing with changes asks first; after a held post there is nothing to lose.
  const confirmClose =
    hasChanges && !held
      ? () =>
          confirmActionSheet({
            title: T.discardTitle,
            actions: [{ label: T.discard, style: 'destructive' }],
            cancelLabel: T.keepEditing,
          }).then((choice) => choice === 0)
      : undefined;
  const requestClose = () => {
    if (!confirmClose) onClose();
    else void confirmClose().then((ok) => ok && onClose());
  };

  async function confirmDelete() {
    const choice = await confirmActionSheet({
      message: T.deleteMessage,
      actions: [{ label: T.delete, style: 'destructive' }],
    });
    if (choice !== 0) return;
    pressed.current = 'delete';
    await form.remove();
  }

  function post() {
    pressed.current = form.isExisting ? 'save' : 'post';
    void form.submit();
  }

  return (
    <BottomSheet
      name="review-sheet"
      onClose={onClose}
      confirmClose={confirmClose}
      accessibilityLabel={form.isExisting ? `Your review of ${poi.name}` : `New review of ${poi.name}`}
      partial={0.88}
      keyboardAvoiding
      header={
        <View className="flex-row items-center gap-3 px-5 pb-3 pt-1">
          <IconSticker icon={X} label="Close" onPress={requestClose} />
          <View className="flex-1 items-center gap-0.5 pr-8">
            <Text oauStyle="caption" numberOfLines={1} className="text-muted-foreground">
              {poi.name}
            </Text>
            <Text oauStyle="title" role="heading" className="text-foreground">
              {form.isExisting ? T.editTitle : T.newTitle}
            </Text>
          </View>
        </View>
      }>
      {form.loading ? (
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator />
        </View>
      ) : held ? (
        // Posted, and waiting for a person: said before the sheet closes, or
        // the review would seem to vanish from the map it was just posted to.
        <View className="flex-1 justify-center gap-4 p-5">
          <CautionPaper icon={Clock} title={HELD_AFTER_POST.title}>
            <Text oauStyle="body" className="text-foreground">
              {HELD_AFTER_POST.body}
            </Text>
          </CautionPaper>
          <Button size="lg" onPress={form.finish}>
            <Text>{HELD_AFTER_POST.done}</Text>
          </Button>
        </View>
      ) : !session ? (
        <View className="flex-1 justify-center gap-4 p-5">
          <Text oauStyle="heading" role="heading" className="text-foreground">
            {T.signIn}
          </Text>
          <Text oauStyle="body" className="text-muted-foreground">
            {SIGN_IN_PITCH}
          </Text>
          <View className="items-start">
            <Button onPress={() => signInWithGoogle().catch(() => {})}>
              <Text>{OAU_ACCOUNT_TEXT.continueWithGoogle}</Text>
            </Button>
          </View>
        </View>
      ) : (
        <ScrollView ref={scrollRef} className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="gap-4 px-5 pb-6 pt-1">
            <QuestionCard prompt={T.rating}>
              <View className="items-center gap-2">
                <StarRating value={form.stars} onChange={form.setStars} />
                {form.stars ? (
                  <Text oauStyle="note" className="text-foreground">
                    {STAR_HINT[form.stars]}
                  </Text>
                ) : (
                  <Text oauStyle="caption" className="text-muted-foreground">
                    {T.ratingHint}
                  </Text>
                )}
              </View>
            </QuestionCard>

            <QuestionCard prompt={T.bathroom} hint={T.bathroomHint}>
              <OauSegments
                options={BATHROOM_OPTIONS}
                value={form.bathroom}
                onChange={form.setBathroom}
                disabled={form.busy}
                accessibilityLabel={T.bathroom}
              />
            </QuestionCard>

            {/* Straight after the questions every review has, before the ones
                only some kinds ask: what happened is what readers look for. */}
            <View onLayout={(event) => (bodyTop.current = event.nativeEvent.layout.y)}>
              <OauCard className="gap-3 p-4">
                <View className="flex-row items-baseline gap-1.5">
                  <Text oauStyle="subheading" className="text-foreground">
                    {T.body}
                  </Text>
                  <Text oauStyle="caption" className="text-muted-foreground">
                    {T.optional}
                  </Text>
                </View>
                {/* The free text is the one part of a review no switch can
                    protect, so the warning sits where the writing starts. */}
                <CautionPaper>
                  <Text oauStyle="callout" className="text-foreground">
                    {WHAT_NOT_TO_WRITE.lead} {T.bodyWarning}
                  </Text>
                  <Pressable
                    onPress={() => setExplainingBody(true)}
                    accessibilityRole="button"
                    hitSlop={6}
                    className={cn(
                      'self-start py-0.5 active:opacity-60',
                      Platform.select({ web: 'cursor-pointer' })
                    )}>
                    <Text oauStyle="label" className="text-caution-foreground underline">
                      {T.whatToLeaveOut}
                    </Text>
                  </Pressable>
                </CautionPaper>
                {/* Lined paper: faint rules every 26 points, the text's own line
                    height, so the words sit on them. */}
                <View className="overflow-hidden rounded-[12px] border-[1.5px] border-input bg-card">
                  <View pointerEvents="none" className="absolute bottom-0 left-3.5 right-3.5 top-1.5">
                    {Array.from({ length: 12 }, (_, line) => (
                      <View key={line} className="h-[26px] border-b border-border" />
                    ))}
                  </View>
                  <Textarea
                    value={form.body}
                    onChangeText={form.setBody}
                    // Up to the top of the sheet, clear of a phone's keyboard.
                    onFocus={() =>
                      scrollRef.current?.scrollTo({ y: Math.max(0, bodyTop.current - 12), animated: true })
                    }
                    maxLength={MAX_BODY}
                    placeholder={T.bodyPlaceholder}
                    numberOfLines={6}
                    className="min-h-[164px] rounded-none border-0 bg-transparent px-3.5 pb-2 pt-2 text-oau-body leading-[26px] shadow-none"
                  />
                </View>
                <Text
                  oauStyle="caption"
                  className={cn('self-end', form.tooLong ? 'text-destructive' : 'text-muted-foreground')}
                  style={{ fontVariant: ['tabular-nums'] }}>
                  {form.body.length} / {MAX_BODY}
                </Text>
              </OauCard>
            </View>

            {form.questionnaire.length > 0 ? (
              <TagQuestions
                questionnaire={form.questionnaire}
                answers={form.answers}
                problems={form.problems}
                disabled={form.busy}
                onChange={(questionId, value) =>
                  form.setAnswers((current) => ({ ...current, [questionId]: value }))
                }
              />
            ) : null}

            {form.identity.length > 0 ? (
              <OauCard className="gap-2 p-4">
                {form.identity.map((line) => (
                  <View key={line.text} className="flex-row items-start gap-2.5">
                    <Icon as={line.icon} className="mt-0.5 size-4 text-primary" />
                    <Text oauStyle="callout" className="flex-1 text-foreground">
                      {line.text}
                    </Text>
                  </View>
                ))}
              </OauCard>
            ) : null}

            {form.error ? (
              <CautionPaper title={T.failed(form.isExisting)}>
                <Text oauStyle="callout" className="text-foreground">
                  {form.error}
                </Text>
              </CautionPaper>
            ) : null}

            {form.isExisting ? (
              <View className="items-start pt-2">
                <Button variant="destructive" disabled={form.busy} onPress={() => void confirmDelete()}>
                  <Icon as={Trash2} className="size-[18px] text-caution-foreground" />
                  <Text>{T.delete}</Text>
                </Button>
              </View>
            ) : null}
          </View>

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
            <InfoPoint title="Write about the place">{WHAT_NOT_TO_WRITE.writeAbout}</InfoPoint>
          </InfoDialog>
        </ScrollView>
      )}

      {/* Pinned, so Post is always in reach however long the form. */}
      {ready ? (
        <View className="gap-2 border-t border-border bg-band px-5 pb-6 pt-3.5">
          {form.blockingHint ? (
            <Text oauStyle="caption" className="text-center text-muted-foreground">
              {form.blockingHint}
            </Text>
          ) : null}
          <Button size="lg" disabled={!form.canSubmit} onPress={post}>
            {form.busy ? <ActivityIndicator size="small" /> : null}
            <Text>{form.busy ? T.saving : form.isExisting ? T.save : T.post}</Text>
          </Button>
        </View>
      ) : null}
    </BottomSheet>
  );
}
