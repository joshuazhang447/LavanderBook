import * as React from 'react';
import { Pressable, View } from 'react-native';

import { StarRating } from '@/components/star-rating';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import type { Database } from '@/lib/database.types';
import { cn } from '@/lib/utils';

export type QuestionKind = Database['public']['Enums']['question_kind'];

export type QuestionOption = { id: string; label: string };

/**
 * One answer, in the loosest shape that covers all fourteen kinds.
 *
 * Deliberately not a discriminated union: the caller already knows the kind, and
 * a union would make every consumer narrow a type it can already read off the
 * question. submit_review maps these onto review_answers' value columns - see
 * the table comment there for which goes where.
 */
export type AnswerValue = string | number | boolean | string[] | null;

export const KIND_LABELS: Record<QuestionKind, string> = {
  yes_no: 'Yes / No',
  yes_no_unsure: 'Yes / No / Not sure',
  single_select: 'Pick one',
  multi_select: 'Pick any',
  scale: 'Scale',
  rating: 'Stars',
  number: 'Number',
  currency: 'Amount of money',
  duration: 'Length of time',
  time_of_day: 'Time of day',
  time_range: 'Opening hours',
  date: 'Date',
  short_text: 'Short text',
  long_text: 'Long text',
};

/** The kinds whose answers come from a list the author writes. */
export function kindNeedsOptions(kind: QuestionKind): boolean {
  return kind === 'single_select' || kind === 'multi_select';
}

type Choice = { value: string; label: string };

function Segmented({
  choices,
  value,
  onChange,
  disabled,
}: {
  choices: Choice[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {choices.map((choice) => (
        <Button
          key={choice.value}
          size="sm"
          disabled={disabled}
          variant={value === choice.value ? 'default' : 'outline'}
          onPress={() => onChange(choice.value)}>
          <Text>{choice.label}</Text>
        </Button>
      ))}
    </View>
  );
}

/** An Input with a fixed unit hung off the end, for number/currency/duration. */
function UnitInput({
  value,
  onChange,
  unit,
  placeholder,
  disabled,
  unitFirst,
}: {
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  unitFirst?: boolean;
}) {
  const label = unit ? (
    <Text className="text-sm text-muted-foreground">{unit}</Text>
  ) : null;

  return (
    <View className="flex-row items-center gap-2">
      {unitFirst ? label : null}
      <Input
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        inputMode="numeric"
        placeholder={placeholder}
        className="w-32"
      />
      {unitFirst ? null : label}
    </View>
  );
}

type QuestionFieldProps = {
  kind: QuestionKind;
  config: Record<string, unknown>;
  options: QuestionOption[];
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
};

/**
 * The control a question is answered with.
 *
 * This is not preview-only scaffolding. It is the renderer the review sheet will
 * import when reviewers start answering tag questions, built here first so that
 * the control an admin previews and the control a reviewer sees are the same
 * component by construction rather than by anyone remembering to keep two in
 * step.
 *
 * Fully controlled, so the same component serves a throwaway preview (local
 * state, discarded) and a real answer (state that gets submitted).
 */
export function QuestionField({
  kind,
  config,
  options,
  value,
  onChange,
  disabled,
}: QuestionFieldProps) {
  const text = (value ?? '') as string;
  const number = typeof config.max === 'number' ? config.max : undefined;

  switch (kind) {
    case 'yes_no':
      return (
        <Segmented
          disabled={disabled}
          value={value === null || value === undefined ? null : value ? 'yes' : 'no'}
          onChange={(next) => onChange(next === 'yes')}
          choices={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
      );

    case 'yes_no_unsure':
      // "Not sure" is a real answer a person chooses, not an absence - the same
      // reasoning that put 'unsure' in public.answer in the first place.
      return (
        <Segmented
          disabled={disabled}
          value={(value as string | null) ?? null}
          onChange={onChange}
          choices={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unsure', label: 'Not sure' },
          ]}
        />
      );

    case 'single_select':
      return (
        <RadioGroup
          value={(value as string | null) ?? undefined}
          onValueChange={onChange}
          className="gap-2">
          {options.map((option) => (
            // Label and control are siblings inside one Pressable target rather
            // than nested pressables: react-native-web renders each as a
            // <button>, and a button inside a button breaks hydration.
            <Pressable
              key={option.id}
              disabled={disabled}
              onPress={() => onChange(option.id)}
              className="flex-row items-center gap-2">
              {/* pointerEvents none: RadioGroupItem is a Pressable, and a pressable
                  inside a pressable swallows the press. The row owns the hit area. */}
              <View pointerEvents="none">
                <RadioGroupItem value={option.id} disabled={disabled} />
              </View>
              <Text className="text-sm">{option.label}</Text>
            </Pressable>
          ))}
        </RadioGroup>
      );

    case 'multi_select': {
      const chosen = Array.isArray(value) ? value : [];
      return (
        <View className="gap-2">
          {options.map((option) => {
            const on = chosen.includes(option.id);
            return (
              <Pressable
                key={option.id}
                disabled={disabled}
                onPress={() =>
                  onChange(on ? chosen.filter((id) => id !== option.id) : [...chosen, option.id])
                }
                className="flex-row items-center gap-2">
                <View pointerEvents="none">
                  <Checkbox checked={on} onCheckedChange={() => {}} disabled={disabled} />
                </View>
                <Text className="text-sm">{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    case 'scale': {
      const min = typeof config.min === 'number' ? config.min : 1;
      const max = typeof config.max === 'number' ? config.max : 5;
      // Numbered buttons rather than a slider. Nothing in the catalogue provides
      // a slider, and across a range this short discrete targets are easier to
      // hit and easier to read back than a thumb on a track.
      const steps = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

      return (
        <View className="gap-1.5">
          <View className="flex-row flex-wrap gap-1.5">
            {steps.map((step) => (
              <Button
                key={step}
                size="sm"
                disabled={disabled}
                variant={value === step ? 'default' : 'outline'}
                className="min-w-9 px-2"
                onPress={() => onChange(step)}>
                <Text>{step}</Text>
              </Button>
            ))}
          </View>
          {config.min_label || config.max_label ? (
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">{String(config.min_label ?? '')}</Text>
              <Text className="text-xs text-muted-foreground">{String(config.max_label ?? '')}</Text>
            </View>
          ) : null}
        </View>
      );
    }

    case 'rating':
      return (
        <StarRating
          size="sm"
          max={number ?? 5}
          value={typeof value === 'number' ? value : null}
          onChange={disabled ? undefined : onChange}
        />
      );

    case 'number':
      return (
        <UnitInput
          value={text}
          onChange={onChange}
          disabled={disabled}
          unit={typeof config.unit === 'string' ? config.unit : undefined}
          placeholder={typeof config.min === 'number' ? String(config.min) : '0'}
        />
      );

    case 'currency':
      return (
        <UnitInput
          value={text}
          onChange={onChange}
          disabled={disabled}
          unitFirst
          unit={typeof config.code === 'string' ? config.code : undefined}
          placeholder="0"
        />
      );

    case 'duration':
      return (
        <UnitInput
          value={text}
          onChange={onChange}
          disabled={disabled}
          unit={typeof config.unit === 'string' ? config.unit : undefined}
          placeholder="0"
        />
      );

    case 'time_of_day':
      return (
        <Input
          value={text}
          onChangeText={onChange}
          editable={!disabled}
          placeholder="23:00"
          className="w-32"
        />
      );

    case 'time_range': {
      // Stored as one 'HH:MM-HH:MM' string, so the two boxes edit halves of it.
      const [from = '', to = ''] = text.split('-');
      return (
        <View className="flex-row items-center gap-2">
          <Input
            value={from}
            onChangeText={(next) => onChange(`${next}-${to}`)}
            editable={!disabled}
            placeholder="09:00"
            className="w-28"
          />
          <Text className="text-sm text-muted-foreground">to</Text>
          <Input
            value={to}
            onChangeText={(next) => onChange(`${from}-${next}`)}
            editable={!disabled}
            placeholder="17:00"
            className="w-28"
          />
        </View>
      );
    }

    case 'date':
      return (
        <Input
          value={text}
          onChangeText={onChange}
          editable={!disabled}
          placeholder="2026-09-11"
          className="w-40"
        />
      );

    case 'short_text':
      return (
        <Input
          value={text}
          onChangeText={onChange}
          editable={!disabled}
          maxLength={typeof config.max_length === 'number' ? config.max_length : 200}
          placeholder="A short answer"
        />
      );

    case 'long_text':
      return (
        <Textarea
          value={text}
          onChangeText={onChange}
          editable={!disabled}
          numberOfLines={3}
          maxLength={typeof config.max_length === 'number' ? config.max_length : 2000}
          placeholder="A longer answer"
        />
      );
  }
}

/**
 * The control with its prompt and help text above it, as a reviewer sees it.
 *
 * `local` drives the preview: state that goes nowhere, so a control in a list of
 * fields still feels like the real thing without pretending to save anything.
 */
export function QuestionFieldPreview({
  prompt,
  helpText,
  kind,
  config,
  options,
  required,
  className,
}: {
  prompt: string;
  helpText?: string | null;
  kind: QuestionKind;
  config: Record<string, unknown>;
  options: QuestionOption[];
  required?: boolean;
  className?: string;
}) {
  const [local, setLocal] = React.useState<AnswerValue>(null);

  return (
    <View className={cn('gap-2', className)}>
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-foreground">
          {prompt || 'Untitled field'}
          {required ? <Text className="text-destructive"> *</Text> : null}
        </Text>
        {helpText ? <Text className="text-xs text-muted-foreground">{helpText}</Text> : null}
      </View>
      <QuestionField
        kind={kind}
        config={config}
        options={options}
        value={local}
        onChange={setLocal}
      />
    </View>
  );
}
