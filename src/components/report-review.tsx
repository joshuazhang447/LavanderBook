import { ChevronLeft, CircleCheck } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS, REPORT_TEXT, type ReportReason } from '@/lib/moderation-text';
import { useReportReview } from '@/lib/report-review';

/** Mirrors review_reports_note_length. */
const MAX_NOTE = 500;

type ReportReviewPageProps = {
  reviewId: string;
  /** Whose review, as readers see it, so the page says which one. */
  authorName: string;
  onBack: () => void;
  /** After a report goes through, so the list can show "Reported". */
  onSent: () => void;
};

/**
 * Reporting a review, in Basic and Material: a page inside the venue sheet,
 * pushed like the tag page, rather than a dialog on top of it. A dialog over
 * the sheet would be closed with it by Escape on the web, and covered by the
 * keyboard on Android.
 *
 * Wording is moderation-text's, shared with Chenfeng's report sheet.
 */
export function ReportReviewPage({ reviewId, authorName, onBack, onSent }: ReportReviewPageProps) {
  const { session, signInWithGoogle } = useAuth();
  const report = useReportReview(reviewId);

  return (
    <View className="flex-1">
      <View className="flex-row items-center px-4 pb-1">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to reviews"
          className="flex-row items-center gap-0.5 rounded-full py-1.5 pl-1 pr-3 active:bg-accent">
          <Icon as={ChevronLeft} className="size-5 text-muted-foreground" />
          <Text className="text-sm text-muted-foreground">Reviews</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-6"
        keyboardShouldPersistTaps="handled">
        {report.outcome ? (
          <View className="items-center gap-3 py-8">
            <Icon as={CircleCheck} className="size-10 text-primary" />
            <Text className="text-center text-lg font-semibold text-foreground">
              {REPORT_TEXT.sentTitle}
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              {report.outcome === 'already' ? REPORT_TEXT.alreadySent : REPORT_TEXT.sentBody}
            </Text>
            <Button variant="outline" onPress={onBack}>
              <Text>Back to reviews</Text>
            </Button>
          </View>
        ) : (
          <>
            <View className="gap-1">
              <Text className="text-lg font-semibold text-foreground">{REPORT_TEXT.title}</Text>
              <Text className="text-sm text-muted-foreground">
                {authorName}&apos;s review. {REPORT_TEXT.lead}
              </Text>
            </View>

            {!session ? (
              <View className="gap-4">
                <Text className="text-sm text-muted-foreground">{REPORT_TEXT.signIn}</Text>
                <Button onPress={() => signInWithGoogle().catch(() => {})}>
                  <Text>Continue with Google</Text>
                </Button>
              </View>
            ) : (
              <>
                <View className="gap-3">
                  <Text className="text-sm font-medium text-foreground">{REPORT_TEXT.reasonHeading}</Text>
                  <RadioGroup
                    value={report.reason ?? undefined}
                    onValueChange={(next) => report.setReason(next as ReportReason)}
                    className="gap-3">
                    {REPORT_REASONS.map((reason) => (
                      // Label and control are siblings inside one Pressable, as
                      // in question-field.tsx: a button inside a button breaks
                      // the web.
                      <Pressable
                        key={reason.value}
                        disabled={report.busy}
                        onPress={() => report.setReason(reason.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: report.reason === reason.value }}
                        className="flex-row items-start gap-3">
                        <View pointerEvents="none" className="pt-0.5">
                          <RadioGroupItem value={reason.value} disabled={report.busy} />
                        </View>
                        <View className="flex-1 gap-0.5">
                          <Text className="text-sm text-foreground">{reason.label}</Text>
                          <Text className="text-xs text-muted-foreground">{reason.hint}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </RadioGroup>
                </View>

                <View className="gap-1.5">
                  <Text className="text-sm font-medium text-foreground">{REPORT_TEXT.noteHeading}</Text>
                  <Textarea
                    value={report.note}
                    onChangeText={report.setNote}
                    maxLength={MAX_NOTE}
                    numberOfLines={3}
                    placeholder={REPORT_TEXT.notePlaceholder}
                    accessibilityLabel={REPORT_TEXT.noteHeading}
                  />
                </View>

                {report.error ? (
                  <Text className="text-sm text-destructive" accessibilityRole="alert">
                    {report.error}
                  </Text>
                ) : null}

                <Button
                  disabled={!report.canSend}
                  onPress={async () => {
                    if (await report.send()) onSent();
                  }}>
                  {report.busy ? <ActivityIndicator size="small" /> : <Text>{REPORT_TEXT.send}</Text>}
                </Button>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
