import * as React from 'react';
import { Pressable, View } from 'react-native';

import { StarRating } from '@/components/star-rating';
import { Text } from '@/components/ui/text';
import {
  configNumber,
  configString,
  consensus,
  displayValue,
  money,
  NUMBER_FORMAT as number,
} from '@/lib/answers';
import { MASK_TEXT, spokenMasked } from '@/lib/moderation-text';
import type {
  AnswerSummary,
  AnswerSummaryRow,
  OptionCount,
  RecentText,
  ValueCount,
} from '@/lib/questionnaire';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/**
 * Chenfeng draws these in the Swift Charts idiom (guideline section 13.21):
 * capsule bars in the tint on the tertiary fill, values in Headline, tallies
 * in Footnote with figures that do not jitter. Same numbers, same rule.
 */
function useChenfeng(): boolean {
  return useSkin().skin === 'chenfeng';
}

/** Counts that change in place keep their width. */
const TABULAR = { fontVariant: ['tabular-nums' as const] };

/**
 * One question's answers, aggregated, for the venue sheet.
 *
 * Fourteen kinds, one rule: every number here is out of the people who answered
 * THIS question - never out of the review count. A review written before the
 * question existed is not a "no" and not a gap; it is simply not in the
 * denominator. The design doc calls that a correctness requirement, and this
 * file is where it is either kept or broken.
 */

function people(n: number): string {
  return n === 1 ? '1 person' : `${n} people`;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Headline({ children }: React.PropsWithChildren) {
  const cf = useChenfeng();
  if (cf) {
    return (
      <Text textStyle="headline" className="text-foreground">
        {children}
      </Text>
    );
  }
  return <Text className="font-medium text-foreground">{children}</Text>;
}

function Tally({ children }: React.PropsWithChildren) {
  const cf = useChenfeng();
  if (cf) {
    return (
      <Text textStyle="footnote" className="text-label-secondary" style={TABULAR}>
        {children}
      </Text>
    );
  }
  return <Text className="text-xs text-muted-foreground">{children}</Text>;
}

/**
 * A bar split in proportion to a few counts. Proportions via flexGrow rather
 * than percentage widths, so a zero simply takes no room and the rest fill.
 */
function SplitBar({ segments }: { segments: { count: number; className: string }[] }) {
  const cf = useChenfeng();
  return (
    <View
      className={cn(
        'flex-row overflow-hidden rounded-full',
        cf ? 'h-[5px] bg-fill-tertiary' : 'h-1.5 bg-muted'
      )}>
      {segments.map((segment, index) =>
        segment.count > 0 ? (
          <View key={index} className={segment.className} style={{ flexGrow: segment.count }} />
        ) : null
      )}
    </View>
  );
}

/** One row of a list: label, a bar filled to its share, the count. */
function CountRow({ label, count, total, muted }: { label: string; count: number; total: number; muted?: boolean }) {
  const cf = useChenfeng();
  const share = total === 0 ? 0 : count / total;
  if (cf) {
    return (
      <View className="flex-row items-center gap-2.5">
        <Text
          textStyle="subheadline"
          numberOfLines={1}
          className={cn('w-2/5', muted ? 'text-label-secondary' : 'text-foreground')}>
          {label}
        </Text>
        <View className="h-[5px] flex-1 overflow-hidden rounded-full bg-fill-tertiary">
          <View className="h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
        </View>
        <Text textStyle="footnote" className="w-6 text-right text-label-secondary" style={TABULAR}>
          {count}
        </Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-2">
      <Text
        numberOfLines={1}
        className={cn('w-2/5 text-sm', muted ? 'text-muted-foreground' : 'text-foreground')}>
        {label}
      </Text>
      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <View className="h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
      </View>
      <Text className="w-6 text-right text-xs text-muted-foreground">{count}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Per kind
// ---------------------------------------------------------------------------

function YesNo({ yes, no, unsure }: { yes: number; no: number; unsure?: number }) {
  const cf = useChenfeng();
  const top = consensus({ yes, no, unsure: unsure ?? 0 });
  if (!top) return null;

  const others = unsure !== undefined && unsure > 0 && top.answer !== 'unsure' ? ` · ${unsure} not sure` : '';

  return (
    <View className="gap-1.5">
      <Headline>{top.label}</Headline>
      <SplitBar
        segments={[
          { count: yes, className: 'bg-primary' },
          { count: no, className: cf ? 'bg-fill' : 'bg-muted-foreground/40' },
          { count: unsure ?? 0, className: 'bg-transparent' },
        ]}
      />
      <Tally>
        {top.count} of {top.total} said {top.label.toLowerCase()}
        {others}
      </Tally>
    </View>
  );
}

function Options({ options, respondents, any }: { options: OptionCount[]; respondents: number; any: boolean }) {
  return (
    <View className="gap-1.5">
      <View className="gap-1">
        {options.map((option) => (
          <CountRow
            key={option.optionId}
            label={option.label}
            count={option.count}
            total={respondents}
            muted={option.count === 0}
          />
        ))}
      </View>
      <Tally>
        {any ? `${people(respondents)}, any number of picks` : `from ${people(respondents)}`}
      </Tally>
    </View>
  );
}

function Scale({ row, summary }: { row: AnswerSummaryRow; summary: Extract<AnswerSummary, { kind: 'scale' }> }) {
  const cf = useChenfeng();
  const max = configNumber(row.config, 'max') ?? summary.distribution.at(-1)?.value ?? 5;
  const minLabel = configString(row.config, 'min_label');
  const maxLabel = configString(row.config, 'max_label');
  const tallest = Math.max(1, ...summary.distribution.map((step) => step.count));

  return (
    <View className="gap-1.5">
      {cf ? (
        <View className="flex-row items-baseline gap-1">
          <Text textStyle="headline" className="text-foreground" style={TABULAR}>
            {number.format(summary.avg)}
          </Text>
          <Text textStyle="footnote" className="text-label-secondary">
            out of {max}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-baseline gap-1">
          <Text className="text-lg font-semibold text-foreground">{number.format(summary.avg)}</Text>
          <Text className="text-xs text-muted-foreground">/ {max}</Text>
        </View>
      )}
      {/* One column per point on the scale, so an empty point is visibly empty
          rather than missing. */}
      <View className="flex-row items-end gap-1">
        {summary.distribution.map((step) => (
          <View key={step.value} className="flex-1 items-center gap-0.5">
            <View
              className={cn(
                'w-full',
                cf ? 'rounded-t-[3px]' : 'rounded-sm',
                step.count > 0 ? 'bg-primary' : cf ? 'bg-fill-tertiary' : 'bg-muted'
              )}
              style={{ height: Math.max(3, Math.round((step.count / tallest) * 24)) }}
            />
            <Text
              className={
                cf ? 'text-xs leading-4 text-label-secondary' : 'text-xs text-muted-foreground'
              }>
              {step.value}
            </Text>
          </View>
        ))}
      </View>
      {minLabel || maxLabel ? (
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">{minLabel ?? ''}</Text>
          <Text className="text-xs text-muted-foreground">{maxLabel ?? ''}</Text>
        </View>
      ) : null}
      <Tally>{people(row.respondents)}</Tally>
    </View>
  );
}

function Rating({ row, avg }: { row: AnswerSummaryRow; avg: number }) {
  const cf = useChenfeng();
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        <StarRating value={avg} size="sm" max={configNumber(row.config, 'max') ?? 5} />
        <Text
          className={
            cf ? 'text-[17px] font-semibold text-foreground' : 'text-sm font-medium text-foreground'
          }>
          {number.format(avg)}
        </Text>
      </View>
      <Tally>{people(row.respondents)}</Tally>
    </View>
  );
}

function Amount({
  row,
  summary,
}: {
  row: AnswerSummaryRow;
  summary: Extract<AnswerSummary, { kind: 'number' | 'currency' | 'duration' }>;
}) {
  // Median for the headline: one person typing 1200 beds should not turn
  // "about 12" into "about 250".
  const format = (n: number) => {
    switch (row.kind) {
      case 'currency':
        return money(n, configString(row.config, 'code'));
      case 'duration': {
        const unit = configString(row.config, 'unit');
        return unit ? `${number.format(n)} ${unit}` : number.format(n);
      }
      default: {
        const unit = configString(row.config, 'unit');
        return unit ? `${number.format(n)} ${unit}` : number.format(n);
      }
    }
  };
  const spread = summary.min !== summary.max;
  const cf = useChenfeng();

  return (
    <View className="gap-1.5">
      <Text className={cf ? 'text-[17px] leading-[22px] text-foreground' : 'text-foreground'}>
        <Text className={cf ? 'font-semibold' : 'font-medium'}>About {format(summary.median)}</Text>
        {spread ? (
          <Text className={cf ? 'text-[13px] text-label-secondary' : 'text-xs text-muted-foreground'}>
            {'  '}({format(summary.min)} – {format(summary.max)})
          </Text>
        ) : null}
      </Text>
      <Tally>from {people(row.respondents)}</Tally>
    </View>
  );
}

function Moment({
  row,
  summary,
}: {
  row: AnswerSummaryRow;
  summary: Extract<AnswerSummary, { kind: 'time_of_day' | 'time_range' | 'date' }>;
}) {
  if (!summary.mode) return null;
  const others: ValueCount[] = summary.distinct
    .filter((entry) => entry.value !== summary.mode?.value)
    .slice(0, 2);

  return (
    <View className="gap-1.5">
      <Headline>{displayValue(row.kind, summary.mode.value)}</Headline>
      <Tally>
        {summary.mode.count} of {row.respondents} said this
        {others.length > 0
          ? ` · also ${others
              .map((entry) => `${displayValue(row.kind, entry.value)} (${entry.count})`)
              .join(', ')}`
          : ''}
      </Tally>
    </View>
  );
}

/**
 * One free-text answer. A slur the answer quotes, which a moderator let stand,
 * arrives masked; the reader can show it, in every skin, from here.
 */
function Quote({ entry, clamp }: { entry: RecentText; clamp: boolean }) {
  const cf = useChenfeng();
  const [revealed, setRevealed] = React.useState(false);
  const masked = !!entry.unmasked;
  const text = masked && revealed ? (entry.unmasked ?? entry.text) : entry.text;

  return (
    <View className="gap-0.5">
      <Text
        numberOfLines={clamp ? 4 : undefined}
        textStyle={cf ? 'body' : undefined}
        accessibilityLabel={masked && !revealed ? spokenMasked(text) : undefined}
        className={cf ? 'text-foreground' : 'text-sm leading-5 text-foreground'}>
        “{text}”
      </Text>
      <View className="flex-row flex-wrap items-center gap-x-3">
        <Text
          textStyle={cf ? 'footnote' : undefined}
          className={cf ? 'text-label-secondary' : 'text-xs text-muted-foreground'}>
          — {entry.displayName}
        </Text>
        {masked ? (
          <Pressable
            onPress={() => setRevealed(!revealed)}
            accessibilityRole="button"
            hitSlop={8}
            className="active:opacity-50">
            <Text
              textStyle={cf ? 'footnote' : undefined}
              className={cf ? 'text-primary' : 'text-xs font-medium text-muted-foreground underline'}>
              {cf
                ? revealed
                  ? MASK_TEXT.hideTitle
                  : MASK_TEXT.showTitle
                : revealed
                  ? MASK_TEXT.hide
                  : MASK_TEXT.show}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Quotes({ row, summary }: { row: AnswerSummaryRow; summary: Extract<AnswerSummary, { kind: 'short_text' | 'long_text' }> }) {
  return (
    <View className="gap-2">
      {summary.recent.map((entry, index) => (
        <Quote key={`${entry.answeredAt}-${index}`} entry={entry} clamp={row.kind === 'long_text'} />
      ))}
      <Tally>
        {row.respondents > summary.recent.length
          ? `${row.respondents} answers, latest shown`
          : people(row.respondents)}
      </Tally>
    </View>
  );
}

function Body({ row }: { row: AnswerSummaryRow }) {
  const { summary } = row;
  switch (summary.kind) {
    case 'yes_no':
      return <YesNo yes={summary.yes} no={summary.no} />;
    case 'yes_no_unsure':
      return <YesNo yes={summary.yes} no={summary.no} unsure={summary.unsure} />;
    case 'single_select':
      return <Options options={summary.options} respondents={row.respondents} any={false} />;
    case 'multi_select':
      return <Options options={summary.options} respondents={row.respondents} any />;
    case 'scale':
      return <Scale row={row} summary={summary} />;
    case 'rating':
      return <Rating row={row} avg={summary.avg} />;
    case 'number':
    case 'currency':
    case 'duration':
      return <Amount row={row} summary={summary} />;
    case 'time_of_day':
    case 'time_range':
    case 'date':
      return <Moment row={row} summary={summary} />;
    case 'short_text':
    case 'long_text':
      return <Quotes row={row} summary={summary} />;
  }
}

// ---------------------------------------------------------------------------

export function AnswerSummaryCard({ row }: { row: AnswerSummaryRow }) {
  const cf = useChenfeng();
  if (cf) {
    // The question is the row's title, quiet; the answer is what stands out.
    return (
      <View className="gap-2">
        <View className="gap-0.5">
          <Text textStyle="subheadline" className="text-label-secondary">
            {row.prompt}
            {row.archived ? <Text textStyle="footnote"> · earlier wording</Text> : null}
          </Text>
          {row.helpText ? (
            <Text textStyle="footnote" className="text-label-secondary">
              {row.helpText}
            </Text>
          ) : null}
        </View>
        <Body row={row} />
      </View>
    );
  }
  return (
    <View className="gap-2">
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-foreground">
          {row.prompt}
          {row.archived ? (
            // Superseded: shown in the words people were actually asked, and
            // said so, rather than quietly filed under the new wording.
            <Text className="text-xs font-normal text-muted-foreground"> · earlier wording</Text>
          ) : null}
        </Text>
        {row.helpText ? <Text className="text-xs text-muted-foreground">{row.helpText}</Text> : null}
      </View>
      <Body row={row} />
    </View>
  );
}
