import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { LogoImage } from '@/components/logo-image';
import { useOauTab } from '@/components/oau/tab-tint';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ANSWER_LABEL } from '@/lib/answers';
import { ABOUT_TEXT, VOICES_TEXT } from '@/lib/directory-text';
import { BOOK_MARK } from '@/lib/logos';
import { cn } from '@/lib/utils';

/**
 * LavenderBook's own words - a place's description, what it checked there - on
 * white note paper, with a rule down its leading edge in the tab's colour (in
 * the Directory, the flag's blue over its pink), signed with the book at the
 * top and "Written by LavenderBook, not by visitors." at the bottom, always.
 * Visitors' words never go in one (LavenderBookStyle/oau-style-guide.md,
 * section 13.12).
 */
export function Note({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  const tab = useOauTab();

  return (
    <View
      className={cn(
        'overflow-hidden rounded-[18px] border border-border bg-note py-4 pl-[22px] pr-5',
        className
      )}>
      <View className="absolute bottom-0 left-0 top-0 w-1 bg-note-rule">
        {tab === 'directory' ? <View className="h-1/2 bg-flag-trans-blue" /> : null}
      </View>
      <View className="mb-1.5 flex-row items-center gap-1.5">
        <View className="scale-75">
          <LogoImage logo={BOOK_MARK} />
        </View>
        <Text oauStyle="caption" className="font-semibold text-primary">
          {VOICES_TEXT.fromLavenderBook}
        </Text>
      </View>
      {children}
      <Text oauStyle="caption" className="mt-2.5 text-muted-foreground">
        {ABOUT_TEXT.attribution}
      </Text>
    </View>
  );
}

/**
 * One thing LavenderBook checked, as a row with a sage check. A teaser: cut to
 * `numberOfLines`, since a note without a headline is used whole.
 */
export function NoteCheck({
  children,
  numberOfLines,
}: React.PropsWithChildren<{ numberOfLines?: number }>) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon as={CircleCheck} className="mt-[3px] size-[18px] text-positive-foreground" />
      <Text oauStyle="callout" numberOfLines={numberOfLines} className="flex-1 text-foreground">
        {children}
      </Text>
    </View>
  );
}

type FactTone = 'yes' | 'no' | 'unsure';

/**
 * Which way an answer leans, from the label the summary already uses - matched
 * whole, since "Not sure" begins with "No".
 */
export function factTone(label: string): FactTone {
  if (label === ANSWER_LABEL.yes) return 'yes';
  if (label === ANSWER_LABEL.no) return 'no';
  return 'unsure';
}

const FACT_LOOK: Record<FactTone, { box: string; icon: string; as: typeof Info }> = {
  yes: { box: 'bg-positive', icon: 'text-positive-foreground', as: CircleCheck },
  no: { box: 'bg-caution', icon: 'text-caution-foreground', as: CircleAlert },
  unsure: { box: 'bg-muted', icon: 'text-muted-foreground', as: Info },
};

/**
 * A fact with its answer, as a soft chip: sage for yes, brick red for no, sunk
 * paper for not sure - and always the words, never the colour alone.
 */
export function FactChip({
  question,
  answer,
  tally,
}: {
  question: string;
  answer: string;
  tally?: string;
}) {
  const look = FACT_LOOK[factTone(answer)];
  return (
    <View
      className={cn('flex-row items-center gap-2 self-start rounded-xl py-1.5 pl-2 pr-3', look.box)}>
      <Icon as={look.as} className={cn('size-[18px]', look.icon)} />
      <Text oauStyle="callout" className="shrink text-foreground">
        {question} <Text oauStyle="callout" className="font-semibold text-foreground">{answer}</Text>
        {tally ? <Text oauStyle="callout" className="text-muted-foreground">{` · ${tally}`}</Text> : null}
      </Text>
    </View>
  );
}
