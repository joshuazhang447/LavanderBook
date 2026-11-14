import { ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AnswerSummaryCard } from '@/components/answer-summary';
import { LinkedText } from '@/components/linked-text';
import { OauCard, OauHeading } from '@/components/oau/card';
import { Note as NotePaper, NoteCheck } from '@/components/oau/note';
import { TagPill } from '@/components/tag-pill';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { OAU_DETAILS_TEXT } from '@/lib/oau-text';
import type { AnswerSummaryRow } from '@/lib/questionnaire';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';
import type { Note } from '@/lib/venue-details';

export type TagPageProps = {
  notes: Note[];
  summary: AnswerSummaryRow[];
  reviewCount: number;
  onBack: () => void;
};

/**
 * Everything behind the tag pill: what we assert about this place, and what
 * visitors reported about it - in that order, and never blurred together.
 *
 * The two sections make different claims. "We confirmed this shelter is
 * staffed overnight" and "some visitors thought it was" are not the same
 * sentence, and the design doc treats keeping them visibly apart as a
 * correctness requirement, not a layout preference. Hence two headings that
 * each say who is speaking, and a rule between them.
 */
export function TagPage(props: TagPageProps) {
  const { skin } = useSkin();
  return skin === 'oau' ? <OauTagPage {...props} /> : <BasicTagPage {...props} />;
}

/** The answers grouped under the tag asking them, the tagless ones last. */
function groupSummary(summary: AnswerSummaryRow[]) {
  const groups: { key: string; tag: AnswerSummaryRow['tag']; rows: AnswerSummaryRow[] }[] = [];
  for (const row of summary) {
    const key = row.tag?.id ?? 'none';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, tag: row.tag, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/**
 * OAU's More details (LavenderBookStyle/oau-style-guide.md, section 14.5): the
 * same two sections as every skin, never mixed - what LavenderBook checked on
 * its signed note, then what visitors reported on cards, under their ribbons.
 */
function OauTagPage({ notes, summary, reviewCount, onBack }: TagPageProps) {
  const groups = groupSummary(summary);
  const answered = summary[0]?.answeredReviews ?? 0;

  return (
    <View className="flex-1">
      <View className="flex-row items-center px-5 pb-2">
        <Button variant="secondary" size="sm" onPress={onBack}>
          <Icon as={ChevronLeft} className="size-4 text-foreground" />
          <Text>{OAU_DETAILS_TEXT.back}</Text>
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-5 pb-6 pt-1">
        {notes.length > 0 ? (
          <View className="gap-3">
            <OauHeading title={OAU_DETAILS_TEXT.checked} />
            <NotePaper>
              <View className="gap-2.5">
                {notes.map((note) => (
                  <NoteCheck key={note.id}>
                    <LinkedText text={note.body} />
                  </NoteCheck>
                ))}
              </View>
            </NotePaper>
          </View>
        ) : null}

        {summary.length > 0 ? (
          <View className="gap-4">
            <OauHeading
              title={OAU_DETAILS_TEXT.reported}
              line={OAU_DETAILS_TEXT.reportedLine(answered, reviewCount)}
            />
            {groups.map((group) => (
              <View key={group.key} className="gap-2.5">
                {group.tag ? (
                  <View className="flex-row">
                    <TagPill tag={group.tag} />
                  </View>
                ) : (
                  <Text oauStyle="caption" className="text-muted-foreground">
                    {OAU_DETAILS_TEXT.noLongerAsked}
                  </Text>
                )}
                <OauCard className="px-4">
                  {group.rows.map((row, index) => (
                    <View
                      key={row.questionId}
                      className={cn('py-3.5', index > 0 && 'border-t border-border')}>
                      <AnswerSummaryCard row={row} />
                    </View>
                  ))}
                </OauCard>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function BasicTagPage({ notes, summary, reviewCount, onBack }: TagPageProps) {
  // Grouped under the tag currently asking, in the order the server sent them;
  // the tagless group - questions nothing here asks any more - comes last.
  const groups: { key: string; tag: AnswerSummaryRow['tag']; rows: AnswerSummaryRow[] }[] = [];
  for (const row of summary) {
    const key = row.tag?.id ?? 'none';
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, tag: row.tag, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  const answered = summary[0]?.answeredReviews ?? 0;

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

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-5 pb-6">
        {notes.length > 0 ? (
          <View className="gap-3">
            <View className="gap-0.5">
              <Text className="font-medium text-foreground">What we checked</Text>
              <Text className="text-xs text-muted-foreground">
                Written by LavenderBook, not by visitors.
              </Text>
            </View>
            {notes.map((note) => (
              <View key={note.id} className="flex-row gap-2">
                <Text className="text-sm leading-5 text-muted-foreground">{'\u2022'}</Text>
                <Text className="flex-1 text-sm leading-5 text-foreground">
                  <LinkedText text={note.body} />
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {notes.length > 0 && summary.length > 0 ? <Separator /> : null}

        {summary.length > 0 ? (
          <View className="gap-4">
            <View className="gap-0.5">
              <Text className="font-medium text-foreground">What visitors reported</Text>
              {/* Coverage, so "7 of 9 said yes" further down is read against how
                  many reviews had any answers at all - reviews written before
                  a question existed are not in any tally, and are not gaps. */}
              <Text className="text-xs text-muted-foreground">
                Answers from {answered} of {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}.
                Visitors&apos; own accounts, not checked by LavenderBook.
              </Text>
            </View>
            {groups.map((group) => (
              <View key={group.key} className="gap-2">
                {/* Which kind of place asked these, over the card it heads. */}
                {group.tag ? (
                  <View className="flex-row">
                    <TagPill tag={group.tag} />
                  </View>
                ) : (
                  <Text className="text-xs text-muted-foreground">No longer asked here</Text>
                )}
                {/* One card per kind, a hairline between its questions: each
                    question reads as a unit, and the kind's run of them as a
                    set, where a column of them ran together. */}
                <View className="rounded-xl border border-border bg-card px-4">
                  {group.rows.map((row, index) => (
                    <View
                      key={row.questionId}
                      className={cn('py-3.5', index > 0 && 'border-t border-border')}>
                      <AnswerSummaryCard row={row} />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
