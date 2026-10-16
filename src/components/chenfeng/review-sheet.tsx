import { CircleUser, Clock, EyeOff } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { QuestionField } from '@/components/question-field';
import type { ReviewSheetProps } from '@/components/review-sheet';
import { StarRating, STAR_HINT } from '@/components/star-rating';
import { TagPill } from '@/components/tag-pill';
import { Button } from '@/components/ui/button';
import { confirmActionSheet, confirmAlert } from '@/components/ui/confirm';
import { Icon } from '@/components/ui/icon';
import { EmptyState, List, Row, Section } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import {
  Sheet,
  SheetActionButton,
  SheetCloseButton,
  SheetScrollView,
  SheetToolbar,
  useSheet,
} from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { errorTick, successTick } from '@/lib/haptics';
import { HELD_AFTER_POST } from '@/lib/moderation-text';
import type { Questionnaire } from '@/lib/questionnaire';
import { BATHROOM_OPTIONS, MAX_BODY, postingAs, useReviewForm, WHAT_NOT_TO_WRITE } from '@/lib/review-form';

/**
 * Chenfeng's review form (guideline section 14.4): a compose sheet, so full
 * height only, on the grouped page; ✕ leading, the place's name as the title,
 * Post (Save when editing) as the prominent action trailing - disabled until
 * the form is valid, a spinner while it posts. Closing with changes asks first.
 * Each question is a section of its own, its prompt the header; the free-text
 * warning stays where writing starts, with Learn More… for the reasons.
 *
 * Everything it checks and saves is useReviewForm's, the same as the other
 * skins' form.
 */
export function ChenfengReviewSheet({ poi, venueId, onClose, onSaved }: ReviewSheetProps) {
  const { session, profile, signInWithGoogle } = useAuth();
  const form = useReviewForm({
    poi,
    venueId,
    onSaved: () => {
      successTick();
      onSaved();
    },
  });
  const [explaining, setExplaining] = React.useState(false);

  // What the form held once loaded, to tell whether closing loses anything.
  const current = JSON.stringify([form.stars, form.bathroom, form.body, form.answers]);
  const [initial, setInitial] = React.useState<string | null>(null);
  if (!form.loading && initial === null) setInitial(current);
  const hasChanges = initial !== null && initial !== current;

  // A server error interrupts: an alert, with what to do about it.
  const shownError = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!form.error || form.error === shownError.current) return;
    shownError.current = form.error;
    errorTick();
    void confirmAlert({
      title: form.isExisting ? "Couldn't Save the Review" : "Couldn't Post the Review",
      message: form.error,
      buttons: [{ label: 'OK', style: 'cancel' }],
    });
  }, [form.error, form.isExisting]);

  // Posted, and waiting for a person: the post went through, so it ticks now
  // rather than at Done.
  const held = form.outcome === 'held';
  React.useEffect(() => {
    if (held) successTick();
  }, [held]);

  const signedIn = !!session;
  const ready = signedIn && !form.loading && !held;
  const actionLabel = form.isExisting ? 'Save' : 'Post';

  return (
    <>
      <Sheet
        name="review-sheet"
        detents={['large']}
        grouped
        accessibilityLabel={form.isExisting ? `Your review of ${poi.name}` : `New review of ${poi.name}`}
        onClose={onClose}
        onDismissAttempt={
          // After a held post there is nothing left to lose: it was saved.
          hasChanges && !held
            ? (dismiss) => {
                void confirmActionSheet({
                  actions: [{ label: 'Discard Changes', style: 'destructive' }],
                  cancelLabel: 'Keep Editing',
                }).then((choice) => {
                  if (choice === 0) dismiss();
                });
              }
            : undefined
        }
        toolbar={
          <SheetToolbar
            leading={held ? null : <SheetCloseButton />}
            title={poi.name}
            subtitle={ready ? (form.isExisting ? 'Your Review' : 'New Review') : undefined}
            trailing={
              held ? (
                // onSaved itself rather than form.finish: the tick already
                // came when the post went through.
                <SheetActionButton accessibilityLabel={HELD_AFTER_POST.done} onPress={onSaved} />
              ) : ready ? (
                <SheetActionButton
                  label={actionLabel}
                  accessibilityLabel={form.isExisting ? 'Save Review' : 'Post Review'}
                  disabled={!form.canSubmit}
                  busy={form.busy}
                  onPress={() => void form.submit()}
                />
              ) : null
            }
          />
        }>
        {form.loading ? (
          <View className="flex-1 items-center justify-center p-8">
            <ActivityIndicator />
          </View>
        ) : held ? (
          <SheetScrollView contentContainerClassName="grow justify-center pb-16">
            <EmptyState
              icon={Clock}
              title={HELD_AFTER_POST.titleTitle}
              description={HELD_AFTER_POST.body}
            />
          </SheetScrollView>
        ) : !signedIn ? (
          <SheetScrollView contentContainerClassName="grow justify-center pb-16">
            <EmptyState
              icon={CircleUser}
              title="Sign In to Review"
              description="Sign in to review this place. You post under an anonymous handle, never your real name."
              action={
                <Button size="lg" onPress={() => signInWithGoogle().catch(() => {})}>
                  <Text>Continue with Google</Text>
                </Button>
              }
            />
          </SheetScrollView>
        ) : (
          <SheetScrollView contentContainerClassName="pb-12 pt-3">
            <List>
              <Section
                header="How LGBTQ+ friendly is this place?"
                footer={form.stars ? STAR_HINT[form.stars] : '1 is hostile, 5 is actively welcoming.'}>
                <View className="items-center py-3">
                  <StarRating value={form.stars} onChange={form.setStars} />
                </View>
              </Section>

              <Section
                header="Is there a bathroom trans people can use safely?"
                footer={'Pick "Not Sure" if you did not check - a guess helps nobody.'}>
                <View className="px-4 py-3">
                  <Segmented
                    segments={BATHROOM_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.value === 'unsure' ? 'Not Sure' : option.label,
                    }))}
                    value={form.bathroom}
                    onChange={form.setBathroom}
                    accessibilityLabel="Is there a bathroom trans people can use safely?"
                  />
                </View>
              </Section>

              <TagQuestions
                questionnaire={form.questionnaire}
                answers={form.answers}
                problems={form.problems}
                disabled={form.busy}
                onChange={(questionId, value) =>
                  form.setAnswers((answers) => ({ ...answers, [questionId]: value }))
                }
              />

              <Section
                header="What Happened?"
                footer={
                  // The free text is the one part no switch can protect, so
                  // the warning sits where the writing starts.
                  <View className="gap-1.5">
                    <Text textStyle="footnote" className="text-label-secondary">
                      Leave out names, dates, times and anything else that could identify you.
                    </Text>
                    <View className="flex-row items-center justify-between gap-3">
                      <Pressable
                        onPress={() => setExplaining(true)}
                        accessibilityRole="link"
                        accessibilityLabel="Learn more about what not to write"
                        hitSlop={8}
                        className="active:opacity-30">
                        <Text textStyle="footnote" className="text-primary">
                          Learn More…
                        </Text>
                      </Pressable>
                      <Text
                        textStyle="caption1"
                        className={form.tooLong ? 'text-destructive' : 'text-label-secondary'}
                        style={{ fontVariant: ['tabular-nums'] }}>
                        {form.body.length} / {MAX_BODY}
                      </Text>
                    </View>
                  </View>
                }>
                <Textarea
                  look="row"
                  value={form.body}
                  onChangeText={form.setBody}
                  maxLength={MAX_BODY}
                  placeholder="Optional"
                  accessibilityLabel="What happened? Optional."
                  numberOfLines={4}
                />
              </Section>

              {profile ? (
                <View className="gap-2 px-4">
                  {postingAs(profile, form.isExisting ? form.shown : null, 'Account').map((line) => (
                    <View key={line.text} className="flex-row items-start gap-2.5">
                      <View className="pt-0.5">
                        <Icon as={line.icon} size={15} className="text-label-secondary" />
                      </View>
                      <Text textStyle="footnote" className="flex-1 text-label-secondary">
                        {line.text}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {form.isExisting ? (
                <Section>
                  <Row
                    title="Delete Review"
                    tone="destructive"
                    centered
                    disabled={form.busy}
                    onPress={async () => {
                      const choice = await confirmActionSheet({
                        message: "This review will be removed from LavenderBook. This can't be undone.",
                        actions: [{ label: 'Delete Review', style: 'destructive' }],
                      });
                      if (choice === 0) await form.remove();
                    }}
                  />
                </Section>
              ) : null}

              {/* What is in the way of posting, in one sentence. */}
              {form.blockingHint ? (
                <Text textStyle="footnote" className="px-4 text-center text-label-secondary">
                  {chenfengHint(form)}
                </Text>
              ) : null}
            </List>
          </SheetScrollView>
        )}
      </Sheet>

      {explaining ? <WhatNotToWrite onClose={() => setExplaining(false)} /> : null}
    </>
  );
}

/** The hint, saying "required" where the other skins point at an asterisk. */
function chenfengHint(form: ReturnType<typeof useReviewForm>): string | null {
  const required = form.missingRequired.length > 0;
  if (form.basicsMissing && required) {
    return 'Pick a rating, answer the bathroom question and the required questions to post.';
  }
  if (form.basicsMissing) return 'Pick a rating and answer the bathroom question to post.';
  if (required) return 'Answer the required questions to post.';
  if (form.problems.size > 0) return 'Fix the answer marked in red to post.';
  return null;
}

type TagQuestionsProps = {
  questionnaire: Questionnaire;
  answers: ReturnType<typeof useReviewForm>['answers'];
  problems: ReadonlyMap<string, string>;
  disabled: boolean;
  onChange: (questionId: string, value: Parameters<React.ComponentProps<typeof QuestionField>['onChange']>[0]) => void;
};

/**
 * The venue's tag questions: a section with no rows introducing them, naming
 * the tags, then one section per question - its prompt the header, "Required"
 * at the header's end, the help and any problem as the footer.
 */
function TagQuestions({ questionnaire, answers, problems, disabled, onChange }: TagQuestionsProps) {
  const asking = questionnaire.filter((tag) => tag.questions.length > 0);
  if (asking.length === 0) return null;

  return (
    <>
      <Section
        header="About This Kind of Place"
        footer={
          // The tags on a row of their own: set inside the sentence, a phone
          // wraps the words after them as one block, a comma first.
          <View className="gap-1.5">
            <Text textStyle="footnote" className="text-label-secondary">
              We ask a few extra questions, because this place is listed as:
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {questionnaire.map((tag) => (
                <TagPill key={tag.id} tag={tag} />
              ))}
            </View>
            <Text textStyle="footnote" className="text-label-secondary">
              Answer what you know and skip the rest.
            </Text>
          </View>
        }
      />
      {asking.map((tag) => (
        <React.Fragment key={tag.id}>
          {asking.length > 1 ? (
            <View className="flex-row px-4">
              <TagPill tag={tag} />
            </View>
          ) : null}
          {tag.questions.map((question) => {
            const problem = problems.get(question.id);
            return (
              <Section
                key={question.id}
                header={question.prompt}
                headerTrailing={question.required ? 'Required' : undefined}
                footer={problem ?? question.helpText ?? undefined}
                footerTone={problem ? 'destructive' : 'default'}>
                <QuestionField
                  kind={question.kind}
                  config={question.config}
                  options={question.options}
                  value={answers[question.id] ?? null}
                  onChange={(value) => onChange(question.id, value)}
                  disabled={disabled}
                />
              </Section>
            );
          })}
        </React.Fragment>
      ))}
    </>
  );
}

/** Learn More…: the explanation as a sheet, with Done. */
function WhatNotToWrite({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      name="chenfeng-what-not-to-write"
      detents={['medium', 'large']}
      accessibilityLabel="Keep Yourself Out of It"
      onClose={onClose}
      toolbar={<SheetToolbar belowGrabber trailing={<DoneButton />} />}>
      <SheetScrollView contentContainerClassName="gap-5 px-6 pb-12">
        <View className="items-center gap-3">
          <Icon as={EyeOff} size={56} strokeWidth={1.5} className="text-primary" />
          <Text textStyle="title1" emphasized role="heading" className="text-center text-foreground">
            Keep Yourself Out of It
          </Text>
          <Text textStyle="body" className="text-center text-foreground">
            {WHAT_NOT_TO_WRITE.lead}
          </Text>
        </View>
        <Point title="Why It Matters">{WHAT_NOT_TO_WRITE.whyItMatters}</Point>
        <Point title="Leave Out">
          {WHAT_NOT_TO_WRITE.leaveOut.map((item) => `•  ${item}`).join('\n')}
        </Point>
        <Point title="Write About the Place">{WHAT_NOT_TO_WRITE.writeAbout}</Point>
      </SheetScrollView>
    </Sheet>
  );
}

function DoneButton() {
  const sheet = useSheet();
  return <SheetActionButton accessibilityLabel="Done" onPress={sheet.dismiss} />;
}

function Point({ title, children }: { title: string; children: string }) {
  return (
    <View className="gap-1">
      <Text textStyle="headline" role="heading" className="text-foreground">
        {title}
      </Text>
      <Text textStyle="body" className="text-label-secondary">
        {children}
      </Text>
    </View>
  );
}
