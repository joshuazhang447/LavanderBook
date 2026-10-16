import { CircleCheck, Flag } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { confirmAlert } from '@/components/ui/confirm';
import { EmptyState, List, Row, Section } from '@/components/ui/list';
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
import { errorTick, selectionTick, successTick } from '@/lib/haptics';
import { REPORT_REASONS, REPORT_TEXT } from '@/lib/moderation-text';
import { useReportReview } from '@/lib/report-review';

/** Mirrors review_reports_note_length. */
const MAX_NOTE = 500;

type ChenfengReportSheetProps = {
  reviewId: string;
  /** Whose review, as readers see it. */
  authorName: string;
  onClose: () => void;
  /** After a report goes through, so the place card can show "Reported". */
  onSent: () => void;
};

/**
 * Reporting a review in Chenfeng: a compose sheet stacked on the place card
 * (the Learn More pattern), ✕ leading, Send trailing and disabled until a
 * reason is picked. Each reason is a row with a checkmark; the note is a
 * section of its own. What it sends and says is shared with the other skins
 * (useReportReview, moderation-text).
 */
export function ChenfengReportSheet({ reviewId, authorName, onClose, onSent }: ChenfengReportSheetProps) {
  const { session, signInWithGoogle } = useAuth();
  const report = useReportReview(reviewId);

  // A refusal interrupts: an alert, with the server's own words.
  const shownError = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!report.error || report.error === shownError.current) return;
    shownError.current = report.error;
    errorTick();
    void confirmAlert({
      title: REPORT_TEXT.failedTitle,
      message: report.error,
      buttons: [{ label: 'OK', style: 'cancel' }],
    });
  }, [report.error]);

  const signedIn = !!session;

  return (
    <Sheet
      name="chenfeng-report-sheet"
      detents={['large']}
      grouped
      accessibilityLabel={REPORT_TEXT.titleTitle}
      onClose={onClose}
      toolbar={
        <SheetToolbar
          leading={report.outcome ? null : <SheetCloseButton />}
          title={REPORT_TEXT.titleTitle}
          trailing={
            report.outcome ? (
              <DoneButton />
            ) : signedIn ? (
              <SheetActionButton
                label={REPORT_TEXT.sendTitle}
                accessibilityLabel="Send Report"
                disabled={!report.canSend}
                busy={report.busy}
                onPress={async () => {
                  if (await report.send()) {
                    successTick();
                    onSent();
                  }
                }}
              />
            ) : null
          }
        />
      }>
      {!signedIn ? (
        <SheetScrollView contentContainerClassName="grow justify-center pb-16">
          <EmptyState
            icon={Flag}
            title={REPORT_TEXT.signInTitle}
            description={REPORT_TEXT.signIn}
            action={
              <Button size="lg" onPress={() => signInWithGoogle().catch(() => {})}>
                <Text>Continue with Google</Text>
              </Button>
            }
          />
        </SheetScrollView>
      ) : report.outcome ? (
        <SheetScrollView contentContainerClassName="grow justify-center pb-16">
          <EmptyState
            icon={CircleCheck}
            title={REPORT_TEXT.sentTitleTitle}
            description={report.outcome === 'already' ? REPORT_TEXT.alreadySent : REPORT_TEXT.sentBody}
          />
        </SheetScrollView>
      ) : (
        <SheetScrollView contentContainerClassName="pb-12 pt-3">
          <List>
            <View className="px-4 pb-1">
              <Text textStyle="footnote" className="text-label-secondary">
                {authorName}&apos;s review. {REPORT_TEXT.lead}
              </Text>
            </View>

            <Section header={REPORT_TEXT.reasonHeadingTitle}>
              {REPORT_REASONS.map((reason) => (
                <Row
                  key={reason.value}
                  title={reason.labelTitle}
                  subtitle={reason.hint}
                  denseSubtitle
                  accessory={report.reason === reason.value ? 'checkmark' : 'none'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: report.reason === reason.value }}
                  disabled={report.busy}
                  onPress={() => {
                    if (report.reason !== reason.value) selectionTick();
                    report.setReason(reason.value);
                  }}
                />
              ))}
            </Section>

            <Section header={REPORT_TEXT.noteHeadingTitle} footer={REPORT_TEXT.notePlaceholder}>
              <Textarea
                look="row"
                value={report.note}
                onChangeText={report.setNote}
                maxLength={MAX_NOTE}
                placeholder="Optional"
                accessibilityLabel={REPORT_TEXT.noteHeadingTitle}
                numberOfLines={3}
              />
            </Section>
          </List>
        </SheetScrollView>
      )}
    </Sheet>
  );
}

function DoneButton() {
  const sheet = useSheet();
  return <SheetActionButton accessibilityLabel="Done" onPress={sheet.dismiss} />;
}
