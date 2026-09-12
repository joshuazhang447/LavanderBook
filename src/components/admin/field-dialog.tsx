import { Plus, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import {
  KIND_LABELS,
  kindNeedsOptions,
  QuestionFieldPreview,
  type QuestionKind,
} from '@/components/admin/question-field';
import { TagChip } from '@/components/admin/tag-chip';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import {
  createQuestion,
  reviseQuestion,
  setQuestionTags,
  type AdminQuestion,
  type AdminTag,
  type QuestionDraft,
} from '@/lib/admin';

const KIND_ORDER: QuestionKind[] = [
  'yes_no',
  'yes_no_unsure',
  'single_select',
  'multi_select',
  'scale',
  'rating',
  'number',
  'currency',
  'duration',
  'time_of_day',
  'time_range',
  'date',
  'short_text',
  'long_text',
];

type ConfigField = {
  key: string;
  label: string;
  type: 'number' | 'text' | 'choice';
  required?: boolean;
  choices?: string[];
  placeholder?: string;
};

/**
 * Which settings each kind takes, mirroring question_config_valid in
 * 20260911153000. Kept as data rather than markup so the form and the database
 * stay describable by the same table - if one grows a setting, it is obvious
 * where the other one has to.
 */
const CONFIG_FIELDS: Partial<Record<QuestionKind, ConfigField[]>> = {
  number: [
    { key: 'min', label: 'Lowest', type: 'number' },
    { key: 'max', label: 'Highest', type: 'number' },
    { key: 'step', label: 'Steps of', type: 'number', placeholder: '1' },
    { key: 'unit', label: 'Unit', type: 'text', placeholder: 'beds' },
  ],
  scale: [
    { key: 'min', label: 'From', type: 'number', required: true, placeholder: '1' },
    { key: 'max', label: 'To', type: 'number', required: true, placeholder: '5' },
    { key: 'min_label', label: 'Low end says', type: 'text', placeholder: 'Unsafe' },
    { key: 'max_label', label: 'High end says', type: 'text', placeholder: 'Very safe' },
  ],
  rating: [{ key: 'max', label: 'How many stars', type: 'number', placeholder: '5' }],
  currency: [
    { key: 'code', label: 'Currency', type: 'text', required: true, placeholder: 'CAD' },
  ],
  duration: [
    {
      key: 'unit',
      label: 'Measured in',
      type: 'choice',
      required: true,
      choices: ['minutes', 'hours', 'days', 'weeks', 'months'],
    },
  ],
  multi_select: [
    { key: 'min_choices', label: 'Pick at least', type: 'number' },
    { key: 'max_choices', label: 'Pick at most', type: 'number' },
  ],
  short_text: [{ key: 'max_length', label: 'Longest answer', type: 'number', placeholder: '200' }],
  long_text: [{ key: 'max_length', label: 'Longest answer', type: 'number', placeholder: '2000' }],
};

function buildConfig(kind: QuestionKind, raw: Record<string, string>): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of CONFIG_FIELDS[kind] ?? []) {
    const value = (raw[field.key] ?? '').trim();
    if (value === '') continue;
    config[field.key] = field.type === 'number' ? Number(value) : value;
  }
  return config;
}

/**
 * The same rules question_config_valid enforces, checked before the round trip.
 *
 * Not instead of the database - the constraint is the boundary and stays. This
 * exists so the common mistakes read as a sentence under the field rather than
 * coming back as a check-constraint violation.
 */
function problemWith(
  kind: QuestionKind,
  config: Record<string, unknown>,
  options: string[]
): string | null {
  if (kindNeedsOptions(kind)) {
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (filled.length < 2) return 'Needs at least two options.';
    if (new Set(filled).size !== filled.length) return 'Two options have the same label.';
  }

  if (kind === 'scale') {
    if (typeof config.min !== 'number' || typeof config.max !== 'number') {
      return 'A scale needs both ends.';
    }
    if (config.min >= config.max) return 'The high end has to be above the low end.';
  }

  if (kind === 'currency' && !/^[A-Z]{3}$/.test(String(config.code ?? ''))) {
    return 'Currency needs a three-letter code, like CAD.';
  }

  if (kind === 'duration' && !config.unit) return 'Pick a unit.';

  if (kind === 'number' && typeof config.min === 'number' && typeof config.max === 'number') {
    if (config.min > config.max) return 'The highest has to be above the lowest.';
  }

  if (kind === 'rating' && config.max !== undefined) {
    const max = Number(config.max);
    if (max < 3 || max > 10) return 'Between 3 and 10 stars.';
  }

  return null;
}

/**
 * A wrapped row of buttons, used where a Select would normally go.
 *
 * Deliberately NOT `@/components/ui/select` inside this dialog. On web both are
 * Radix: the Select portals its list to document.body and toggles
 * `pointer-events` on body while open, so a click around that transition lands
 * on the Dialog's own overlay - whose handler closes the dialog when
 * `event.target === event.currentTarget`. The effect is that opening the picker
 * dismisses the whole form.
 *
 * A portal inside a portal is the problem, so this has no portal. It also shows
 * every option at once, which for "what is this answered with" is better than a
 * dropdown anyway. Selects elsewhere in the panel are fine - none of them are
 * inside a dialog.
 */
function InlinePicker<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {options.map((option) => (
        <Button
          key={option.value}
          size="sm"
          variant={value === option.value ? 'default' : 'outline'}
          onPress={() => onChange(option.value)}>
          <Text>{option.label}</Text>
        </Button>
      ))}
    </View>
  );
}

type FieldDialogProps = {
  /** Null creates; a question edits it. */
  question: AdminQuestion | null;
  allTags: AdminTag[];
  /** Pre-selected when opened from inside a tag. */
  initialTagIds?: string[];
  onClose: () => void;
  onSaved: () => void;
};

export function FieldDialog({
  question,
  allTags,
  initialTagIds,
  onClose,
  onSaved,
}: FieldDialogProps) {
  const isNew = question === null;

  const [prompt, setPrompt] = React.useState(question?.prompt ?? '');
  const [helpText, setHelpText] = React.useState(question?.helpText ?? '');
  const [kind, setKind] = React.useState<QuestionKind>(question?.kind ?? 'yes_no');
  const [required, setRequired] = React.useState(question?.required ?? false);
  const [options, setOptions] = React.useState<string[]>(
    question && question.options.length > 0 ? question.options.map((o) => o.label) : ['', '']
  );
  const [rawConfig, setRawConfig] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [key, value] of Object.entries(question?.config ?? {})) {
      initial[key] = String(value);
    }
    return initial;
  });
  const [tagIds, setTagIds] = React.useState<string[]>(
    question ? question.tags.map((t) => t.id) : (initialTagIds ?? [])
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const config = buildConfig(kind, rawConfig);
  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const problem = problemWith(kind, config, options);
  const canSave = !busy && prompt.trim().length >= 3 && problem === null;

  async function save() {
    if (!canSave) return;

    setBusy(true);
    setError(null);

    const draft: QuestionDraft = {
      prompt: prompt.trim(),
      helpText: helpText.trim(),
      kind,
      config,
      required,
      options: kindNeedsOptions(kind) ? cleanOptions : [],
    };

    try {
      // reviseQuestion returns a NEW id when the field has been answered, so the
      // assignment below has to follow whichever id came back rather than the
      // one we opened with.
      const id = isNew ? await createQuestion(draft, tagIds) : await reviseQuestion(question.id, draft);
      if (!isNew) await setQuestionTags(id, tagIds);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be saved.');
      setBusy(false);
    }
  }

  const configFields = CONFIG_FIELDS[kind] ?? [];

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-full max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New field' : 'Edit field'}</DialogTitle>
          <DialogDescription>
            A field can be attached to any number of tags. A place is asked every field of
            every tag it carries.
          </DialogDescription>
        </DialogHeader>

        <ScrollView className="max-h-[60vh]" contentContainerClassName="gap-4 px-0.5">
          <View className="gap-1.5">
            <Label nativeID="field-prompt">Question</Label>
            <Input
              aria-labelledby="field-prompt"
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Is this place clean?"
            />
            <Text className="text-xs text-muted-foreground">
              Phrase it so it still reads correctly on every tag you might attach it to.
              &ldquo;Is this place clean?&rdquo; travels; &ldquo;Is the shelter clean?&rdquo; does
              not.
            </Text>
          </View>

          <View className="gap-1.5">
            <Label nativeID="field-help">Hint</Label>
            <Input
              aria-labelledby="field-help"
              value={helpText}
              onChangeText={setHelpText}
              placeholder="Bedding, bathrooms and common areas."
            />
            <Text className="text-xs text-muted-foreground">
              Shown under the question. Optional.
            </Text>
          </View>

          <View className="gap-1.5">
            <Label>Answered with</Label>
            <InlinePicker
              value={kind}
              onChange={setKind}
              options={KIND_ORDER.map((option) => ({ value: option, label: KIND_LABELS[option] }))}
            />
          </View>

          {configFields.length > 0 ? (
            <View className="flex-row flex-wrap gap-3">
              {configFields.map((field) => (
                <View key={field.key} className="min-w-[140px] flex-1 gap-1.5">
                  <Label nativeID={`cfg-${field.key}`}>
                    {field.label}
                    {field.required ? <Text className="text-destructive"> *</Text> : null}
                  </Label>
                  {field.type === 'choice' ? (
                    <InlinePicker
                      value={rawConfig[field.key] ?? ''}
                      onChange={(next) => setRawConfig({ ...rawConfig, [field.key]: next })}
                      options={(field.choices ?? []).map((choice) => ({
                        value: choice,
                        label: choice,
                      }))}
                    />
                  ) : (
                    <Input
                      aria-labelledby={`cfg-${field.key}`}
                      value={rawConfig[field.key] ?? ''}
                      onChangeText={(next) => setRawConfig({ ...rawConfig, [field.key]: next })}
                      inputMode={field.type === 'number' ? 'numeric' : 'text'}
                      autoCapitalize={field.key === 'code' ? 'characters' : 'none'}
                      placeholder={field.placeholder}
                    />
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {kindNeedsOptions(kind) ? (
            <View className="gap-2">
              <Label>Options</Label>
              {options.map((option, index) => (
                <View key={index} className="flex-row items-center gap-2">
                  <Input
                    value={option}
                    onChangeText={(next) =>
                      setOptions(options.map((o, i) => (i === index ? next : o)))
                    }
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                    aria-label={`Option ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Remove option ${index + 1}`}
                    disabled={options.length <= 2}
                    onPress={() => setOptions(options.filter((_, i) => i !== index))}>
                    <Icon as={X} className="size-4 text-muted-foreground" />
                  </Button>
                </View>
              ))}
              <Button variant="outline" size="sm" onPress={() => setOptions([...options, ''])}>
                <Icon as={Plus} className="size-4" />
                <Text>Add option</Text>
              </Button>
            </View>
          ) : null}

          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-0.5">
              <Label nativeID="field-required">Must be answered</Label>
              <Text className="text-xs text-muted-foreground">
                Turning this on later leaves earlier reviews incomplete.
              </Text>
            </View>
            <Switch aria-labelledby="field-required" checked={required} onCheckedChange={setRequired} />
          </View>

          <View className="gap-2">
            <Label>Attached to</Label>
            {allTags.filter((tag) => tag.archivedAt === null).length === 0 ? (
              <Text className="text-xs text-muted-foreground">No tags yet.</Text>
            ) : (
              <View className="flex-row flex-wrap gap-x-4 gap-y-2">
                {allTags
                  .filter((tag) => tag.archivedAt === null)
                  .map((tag) => {
                    const on = tagIds.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        onPress={() =>
                          setTagIds(on ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id])
                        }
                        className="flex-row items-center gap-2">
                        {/* pointerEvents none: Checkbox is itself a Pressable, and a
                            pressable inside a pressable swallows the press. The row owns
                            the hit area, so the square and the chip behave alike. */}
                        <View pointerEvents="none">
                          <Checkbox checked={on} onCheckedChange={() => {}} />
                        </View>
                        <TagChip label={tag.label} color={tag.color} textColor={tag.textColor} />
                      </Pressable>
                    );
                  })}
              </View>
            )}
            <Text className="text-xs text-muted-foreground">
              Attaching nothing is fine — the field waits in the bank until you need it.
            </Text>
          </View>

          <View className="gap-1.5 rounded-md border border-border bg-muted/40 p-3">
            <Label>Preview</Label>
            <QuestionFieldPreview
              prompt={prompt}
              helpText={helpText}
              kind={kind}
              config={config}
              required={required}
              options={cleanOptions.map((label, index) => ({ id: `preview-${index}`, label }))}
            />
          </View>

          {question && question.answerCount > 0 ? (
            <Text className="text-xs text-muted-foreground">
              This field has been answered {question.answerCount} time
              {question.answerCount === 1 ? '' : 's'}. Saving keeps the old wording on those
              answers and attaches this version going forward, in the same place on every tag.
            </Text>
          ) : null}

          {problem ? <Text className="text-sm text-destructive">{problem}</Text> : null}
          {error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <DialogFooter>
          <Button variant="outline" onPress={onClose} disabled={busy}>
            <Text>Cancel</Text>
          </Button>
          <Button onPress={save} disabled={!canSave}>
            {busy ? <ActivityIndicator size="small" /> : <Text>{isNew ? 'Create field' : 'Save'}</Text>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
