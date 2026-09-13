import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { KIND_LABELS } from '@/components/question-field';
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
import { Text } from '@/components/ui/text';
import {
  assignQuestions,
  listAdminQuestions,
  listTagQuestions,
  reorderQuestions,
  unassignQuestion,
  type AdminQuestion,
  type TagQuestion,
} from '@/lib/admin';

type PickerProps = {
  tagLabel: string;
  /** Already on this tag, so excluded from the list. */
  assignedIds: string[];
  onClose: () => void;
  onPick: (questionIds: string[]) => void;
};

function AssignPicker({ tagLabel, assignedIds, onClose, onPick }: PickerProps) {
  const [bank, setBank] = React.useState<AdminQuestion[] | null>(null);
  const [chosen, setChosen] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;
    listAdminQuestions('', false)
      .then((rows) => active && setBank(rows.filter((q) => !assignedIds.includes(q.id))))
      .catch(() => active && setBank([]));
    return () => {
      active = false;
    };
  }, [assignedIds]);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach fields to {tagLabel}</DialogTitle>
          <DialogDescription>
            The same field can serve several tags. Attaching it here does not take it away from
            anywhere else.
          </DialogDescription>
        </DialogHeader>

        <ScrollView className="max-h-[50vh]" contentContainerClassName="gap-2 px-0.5">
          {bank === null ? (
            <ActivityIndicator />
          ) : bank.length === 0 ? (
            <Text className="py-4 text-center text-sm text-muted-foreground">
              Every field is already attached to this tag. Write a new one in Custom fields.
            </Text>
          ) : (
            bank.map((question) => {
              const on = chosen.includes(question.id);
              return (
                <Pressable
                  key={question.id}
                  onPress={() =>
                    setChosen(on ? chosen.filter((id) => id !== question.id) : [...chosen, question.id])
                  }
                  className="flex-row items-start gap-3 rounded-md p-2 active:bg-accent">
                  {/* Non-interactive: the row is the button. See field-dialog.tsx. */}
                  <View className="pt-0.5" pointerEvents="none">
                    <Checkbox checked={on} onCheckedChange={() => {}} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm text-foreground">{question.prompt}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {KIND_LABELS[question.kind]}
                      {question.tags.length > 0
                        ? ` · already on ${question.tags.map((t) => t.label).join(', ')}`
                        : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <DialogFooter>
          <Button variant="outline" onPress={onClose}>
            <Text>Cancel</Text>
          </Button>
          <Button disabled={chosen.length === 0} onPress={() => onPick(chosen)}>
            <Text>
              Attach {chosen.length > 0 ? `${chosen.length} ` : ''}field
              {chosen.length === 1 ? '' : 's'}
            </Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TagQuestionsProps = {
  tagId: string;
  tagLabel: string;
  /** Lets the tag row refresh its question count. */
  onChanged: () => void;
};

/**
 * One tag's questionnaire, in its own order.
 *
 * Mounted only when a tag row is expanded, so opening the Tags section does not
 * fetch a questionnaire for every tag on the off-chance.
 */
export function TagQuestions({ tagId, tagLabel, onChanged }: TagQuestionsProps) {
  const [questions, setQuestions] = React.useState<TagQuestion[] | null>(null);
  const [picking, setPicking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    listTagQuestions(tagId)
      .then((rows) => {
        if (!active) return;
        setQuestions(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setQuestions([]);
        setError(cause instanceof Error ? cause.message : 'Could not load this tag’s fields.');
      });
    return () => {
      active = false;
    };
  }, [tagId, reloads]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
    }
    setReloads((n) => n + 1);
    onChanged();
  }

  function move(index: number, direction: -1 | 1) {
    if (!questions) return;
    const next = [...questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    setQuestions(next);
    // Scoped to this tag: the same field keeps its own position in every other
    // tag that asks it.
    void run(() => reorderQuestions(tagId, next.map((q) => q.id)));
  }

  return (
    <View className="gap-2 rounded-md border border-border bg-muted/30 p-3">
      {questions === null ? (
        <ActivityIndicator size="small" />
      ) : questions.length === 0 ? (
        <Text className="text-xs text-muted-foreground">
          No fields yet. This tag adds nothing to a review until it has some.
        </Text>
      ) : (
        questions.map((question, index) => (
          <View key={question.id} className="flex-row items-center gap-2">
            <View className="gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-4"
                aria-label={`Move ${question.prompt} up`}
                disabled={index === 0}
                onPress={() => move(index, -1)}>
                <Icon as={ChevronUp} className="size-3 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-4"
                aria-label={`Move ${question.prompt} down`}
                disabled={index === questions.length - 1}
                onPress={() => move(index, 1)}>
                <Icon as={ChevronDown} className="size-3 text-muted-foreground" />
              </Button>
            </View>
            <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
              {question.prompt}
            </Text>
            <Text className="text-xs text-muted-foreground">{KIND_LABELS[question.kind]}</Text>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Detach ${question.prompt}`}
              onPress={() => void run(() => unassignQuestion(tagId, question.id))}>
              <Icon as={X} className="size-3.5 text-muted-foreground" />
            </Button>
          </View>
        ))
      )}

      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}

      <Button variant="outline" size="sm" className="self-start" onPress={() => setPicking(true)}>
        <Icon as={Plus} className="size-3.5" />
        <Text>Attach fields</Text>
      </Button>

      {picking ? (
        <AssignPicker
          tagLabel={tagLabel}
          assignedIds={(questions ?? []).map((q) => q.id)}
          onClose={() => setPicking(false)}
          onPick={(ids) => {
            setPicking(false);
            void run(() => assignQuestions(tagId, ids));
          }}
        />
      ) : null}
    </View>
  );
}
