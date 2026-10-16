import * as React from 'react';
import { View } from 'react-native';

import { DatePicker } from '@/components/date-picker';
import type { AnswerValue, QuestionKind, QuestionOption } from '@/components/question-field';
import { StarRating } from '@/components/star-rating';
import { TimePicker } from '@/components/time-picker';
import { Input } from '@/components/ui/input';
import { Row } from '@/components/ui/list';
import { Menu, measureAnchor, type MenuAnchor } from '@/components/ui/menu';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { selectionTick } from '@/lib/haptics';

type Props = {
  kind: QuestionKind;
  config: Record<string, unknown>;
  options: QuestionOption[];
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
};

/** More options than this, and a choice becomes a menu (guideline section 13.8). */
const INLINE_OPTIONS = 5;
/** More steps than this, and a scale's segments get too narrow to read. */
const SEGMENTED_STEPS = 7;

/**
 * How a tag question is answered in Chenfeng: what goes inside its section of
 * the review form, the prompt being the section's header (guideline section
 * 13.8). iOS has no radio buttons and no checkboxes - a choice is a segmented
 * control, checkmark rows, or a menu; a number is a field at the end of a row
 * with its unit after it; a date or a time is the system's compact pill.
 *
 * The same values in and out as QuestionField's other look, which this is a
 * branch of: what is stored never depends on the skin.
 */
export function ChenfengQuestionField({ kind, config, options, value, onChange, disabled }: Props) {
  const text = (value ?? '') as string;

  switch (kind) {
    case 'yes_no':
      return (
        <Padded>
          <Segmented
            disabled={disabled}
            value={value === null || value === undefined ? null : value ? 'yes' : 'no'}
            onChange={(next) => onChange(next === 'yes')}
            segments={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
        </Padded>
      );

    case 'yes_no_unsure':
      // "Not sure" is a real answer a person chooses, not an absence.
      return (
        <Padded>
          <Segmented
            disabled={disabled}
            value={(value as string | null) ?? null}
            onChange={onChange}
            segments={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'unsure', label: 'Not Sure' },
            ]}
          />
        </Padded>
      );

    case 'single_select':
      if (options.length > INLINE_OPTIONS) {
        return (
          <MenuPicker
            options={options}
            value={(value as string | null) ?? null}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }
      return (
        <>
          {options.map((option) => (
            <Row
              key={option.id}
              title={option.label}
              accessory={value === option.id ? 'checkmark' : 'none'}
              accessibilityRole="radio"
              accessibilityState={{ selected: value === option.id }}
              disabled={disabled}
              onPress={() => {
                if (value !== option.id) selectionTick();
                onChange(option.id);
              }}
            />
          ))}
        </>
      );

    case 'multi_select': {
      const chosen = Array.isArray(value) ? value : [];
      return (
        <>
          {options.map((option) => {
            const on = chosen.includes(option.id);
            return (
              <Row
                key={option.id}
                title={option.label}
                accessory={on ? 'checkmark' : 'none'}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                disabled={disabled}
                onPress={() => {
                  selectionTick();
                  onChange(on ? chosen.filter((id) => id !== option.id) : [...chosen, option.id]);
                }}
              />
            );
          })}
        </>
      );
    }

    case 'scale': {
      const min = typeof config.min === 'number' ? config.min : 1;
      const max = typeof config.max === 'number' ? config.max : 5;
      const steps = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => String(min + i));
      const labels =
        config.min_label || config.max_label ? (
          <View className="flex-row justify-between pt-2">
            <Text textStyle="footnote" className="text-label-secondary">
              {String(config.min_label ?? '')}
            </Text>
            <Text textStyle="footnote" className="text-label-secondary">
              {String(config.max_label ?? '')}
            </Text>
          </View>
        ) : null;
      if (steps.length > SEGMENTED_STEPS) {
        return (
          <>
            <MenuPicker
              options={steps.map((step) => ({ id: step, label: step }))}
              value={typeof value === 'number' ? String(value) : null}
              onChange={(next) => onChange(next === null ? null : Number(next))}
              disabled={disabled}
            />
            {labels ? <Padded>{labels}</Padded> : null}
          </>
        );
      }
      return (
        <Padded>
          <Segmented
            disabled={disabled}
            value={typeof value === 'number' ? String(value) : null}
            onChange={(next) => onChange(Number(next))}
            segments={steps.map((step) => ({ value: step, label: step }))}
          />
          {labels}
        </Padded>
      );
    }

    case 'rating':
      return (
        <Padded className="items-center">
          <StarRating
            max={typeof config.max === 'number' ? config.max : 5}
            value={typeof value === 'number' ? value : null}
            onChange={disabled ? undefined : onChange}
          />
        </Padded>
      );

    case 'number':
    case 'currency':
    case 'duration': {
      const unit =
        kind === 'currency'
          ? typeof config.code === 'string'
            ? config.code
            : undefined
          : typeof config.unit === 'string'
            ? config.unit
            : undefined;
      return (
        <View className="min-h-[52px] flex-row items-center gap-2 pl-4 pr-4">
          <Input
            look="row"
            value={text}
            onChangeText={onChange}
            editable={!disabled}
            inputMode="decimal"
            returnKeyType="done"
            placeholder={kind === 'number' && typeof config.min === 'number' ? String(config.min) : '0'}
            accessibilityLabel={unit ? `Amount in ${unit}` : 'Amount'}
            className="flex-1 px-0 text-right"
          />
          {unit ? (
            <Text textStyle="body" className="text-label-secondary">
              {unit}
            </Text>
          ) : null}
        </View>
      );
    }

    case 'time_of_day':
      return (
        <Row>
          <PickerRow title="Time">
            <TimePicker
              value={text}
              onChange={onChange}
              disabled={disabled}
              label="Time"
              defaultTime="12:00"
            />
          </PickerRow>
        </Row>
      );

    case 'time_range': {
      // Stored as one 'HH:MM-HH:MM' string, so the two pickers set halves of it.
      const [from = '', to = ''] = text.split('-');
      return (
        <>
          <Row>
            <PickerRow title="From">
              <TimePicker
                value={from}
                onChange={(next) => onChange(`${next}-${to}`)}
                disabled={disabled}
                label="From"
                defaultTime="09:00"
              />
            </PickerRow>
          </Row>
          <Row>
            <PickerRow title="To">
              <TimePicker
                value={to}
                onChange={(next) => onChange(`${from}-${next}`)}
                disabled={disabled}
                label="To"
                defaultTime="17:00"
              />
            </PickerRow>
          </Row>
        </>
      );
    }

    case 'date':
      return (
        <Row>
          <PickerRow title="Date">
            <DatePicker value={text} onChange={onChange} disabled={disabled} label="Date" />
          </PickerRow>
        </Row>
      );

    case 'short_text':
      return (
        <Input
          look="row"
          value={text}
          onChangeText={onChange}
          editable={!disabled}
          maxLength={typeof config.max_length === 'number' ? config.max_length : 200}
          placeholder="A Short Answer"
          returnKeyType="done"
        />
      );

    case 'long_text':
      return (
        <Textarea
          look="row"
          value={text}
          onChangeText={onChange}
          editable={!disabled}
          numberOfLines={6}
          maxLength={typeof config.max_length === 'number' ? config.max_length : 2000}
          placeholder="A Longer Answer"
        />
      );
  }
}

function Padded({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <View className={className ? `px-4 py-3 ${className}` : 'px-4 py-3'}>{children}</View>;
}

/** A row's title leading, its picker trailing. */
function PickerRow({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text textStyle="body" className="text-foreground">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * One of many: a row showing the current value, opening a menu of the options
 * with a checkmark on the chosen one.
 */
function MenuPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: QuestionOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const ref = React.useRef<View>(null);
  const [anchor, setAnchor] = React.useState<MenuAnchor | null>(null);
  const current = options.find((option) => option.id === value);

  return (
    <View ref={ref} collapsable={false}>
      <Row
        title="Choose"
        detail={current?.label ?? 'None'}
        accessory="menu"
        disabled={disabled}
        accessibilityLabel={`Choose, ${current?.label ?? 'nothing chosen'}`}
        onPress={async () => setAnchor(await measureAnchor(ref.current))}
      />
      <Menu
        anchor={anchor}
        accessibilityLabel="Options"
        onClose={() => setAnchor(null)}
        groups={[
          options.map((option) => ({
            label: option.label,
            checked: option.id === value,
            onPress: () => {
              selectionTick();
              onChange(option.id);
            },
          })),
        ]}
      />
    </View>
  );
}
