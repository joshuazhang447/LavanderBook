import { ListChecks, MoreHorizontal, Plus, Search } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { FieldDialog } from '@/components/admin/field-dialog';
import { KIND_LABELS, QuestionFieldPreview } from '@/components/question-field';
import { TagChip } from '@/components/admin/tag-chip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
  deleteQuestion,
  listAdminQuestions,
  listAdminTags,
  setQuestionArchived,
  type AdminQuestion,
  type AdminTag,
} from '@/lib/admin';
import { cn } from '@/lib/utils';

/** Waits for typing to stop, so a search is one request rather than one per key. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

type FieldRowProps = {
  question: AdminQuestion;
  onEdit: () => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
};

function FieldRow({ question, onEdit, onArchive, onDelete }: FieldRowProps) {
  const answered = question.answerCount > 0;

  return (
    <View className="gap-3 border-b border-border px-6 py-4">
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-sm font-medium text-foreground">{question.prompt}</Text>
            {question.required ? (
              <Text className="text-xs text-muted-foreground">required</Text>
            ) : null}
          </View>
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs text-muted-foreground">
              {KIND_LABELS[question.kind]} · {question.answerCount} answer
              {question.answerCount === 1 ? '' : 's'}
            </Text>
            {question.tags.length === 0 ? (
              <Text className="text-xs text-muted-foreground">· not attached to anything</Text>
            ) : (
              question.tags.map((tag) => (
                <TagChip key={tag.id} label={tag.label} color={tag.color} textColor={tag.textColor} />
              ))
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-1">
          <Button variant="outline" size="sm" onPress={onEdit}>
            <Text>Edit</Text>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`More for ${question.prompt}`}>
                <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onPress={() => onArchive(question.archivedAt === null)}>
                <Text>{question.archivedAt ? 'Restore' : 'Archive'}</Text>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" disabled={answered} onPress={onDelete}>
                <Text>
                  {answered ? `Answered ${question.answerCount}× — archive instead` : 'Delete'}
                </Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </View>
      </View>

      {/* The control itself. Interactive, but the state goes nowhere - the
          header says so, because a control that looks dead reads as broken. */}
      <View className="rounded-md border border-border bg-muted/30 p-3">
        <QuestionFieldPreview
          prompt={question.prompt}
          helpText={question.helpText}
          kind={question.kind}
          config={question.config}
          options={question.options}
          required={question.required}
        />
      </View>
    </View>
  );
}

type FieldsSectionProps = {
  /**
   * Whether this section is the one on screen.
   *
   * Every section stays mounted so its filters survive a trip elsewhere, which
   * also means its effect never re-runs on its own. Becoming visible is the
   * moment to ask again: a tag made in Tags has to be offered here, and nothing
   * else would have told us about it.
   */
  visible: boolean;
};

export function FieldsSection({ visible }: FieldsSectionProps) {
  const [search, setSearch] = React.useState('');
  const settledSearch = useDebounced(search, 300);

  const [questions, setQuestions] = React.useState<AdminQuestion[] | null>(null);
  const [tags, setTags] = React.useState<AdminTag[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  /** undefined closed, null new, a question edits it. */
  const [editing, setEditing] = React.useState<AdminQuestion | null | undefined>(undefined);
  const [confirming, setConfirming] = React.useState<AdminQuestion | null>(null);
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    if (!visible) return;
    let active = true;

    Promise.all([listAdminQuestions(settledSearch, true), listAdminTags()])
      .then(([rows, tagRows]) => {
        if (!active) return;
        setQuestions(rows);
        setTags(tagRows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setQuestions([]);
        setError(cause instanceof Error ? cause.message : 'Could not load fields.');
      });

    return () => {
      active = false;
    };
  }, [settledSearch, reloads, visible]);

  const refetch = React.useCallback(() => setReloads((n) => n + 1), []);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
    }
    refetch();
  }

  const live = (questions ?? []).filter((q) => q.archivedAt === null);
  const archived = (questions ?? []).filter((q) => q.archivedAt !== null);

  return (
    <View className="flex-1">
      <View className="gap-4 border-b border-border px-6 py-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-bold text-foreground">Custom fields</Text>
            <Text className="text-sm text-muted-foreground">
              Questions that can be attached to any tag. A place is asked every field of every
              tag it carries. The controls below are previews — nothing you tap here is saved.
            </Text>
          </View>
          <Button onPress={() => setEditing(null)}>
            <Icon as={Plus} className="size-4 text-primary-foreground" />
            <Text>New field</Text>
          </Button>
        </View>

        <View className="flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
          <Icon as={Search} className="size-4 text-muted-foreground" />
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search the question or its hint"
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
          />
        </View>

        {error ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>

      {questions === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : live.length === 0 && archived.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Icon as={ListChecks} className="size-8 text-muted-foreground" />
          <Text className="text-center text-sm text-muted-foreground">
            {settledSearch
              ? 'No fields match that search.'
              : 'No fields yet. Add one, then attach it to the tags that should ask it.'}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="pb-10">
          {live.map((question) => (
            <FieldRow
              key={question.id}
              question={question}
              onEdit={() => setEditing(question)}
              onArchive={(archived) => void run(() => setQuestionArchived(question.id, archived))}
              onDelete={() => setConfirming(question)}
            />
          ))}

          {archived.length > 0 ? (
            <View className="mt-6">
              <View className="px-6 pb-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Archived ({archived.length})
                </Text>
                <Text className="text-xs text-muted-foreground">
                  No longer asked. Answers already given keep the wording they were given under.
                </Text>
              </View>
              <Separator />
              <View className="opacity-60">
                {archived.map((question) => (
                  <FieldRow
                    key={question.id}
                    question={question}
                    onEdit={() => setEditing(question)}
                    onArchive={(archived) =>
                      void run(() => setQuestionArchived(question.id, archived))
                    }
                    onDelete={() => setConfirming(question)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {editing !== undefined ? (
        <FieldDialog
          key={editing?.id ?? 'new'}
          question={editing}
          allTags={tags}
          onClose={() => setEditing(undefined)}
          onSaved={refetch}
        />
      ) : null}

      <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this field?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{confirming?.prompt}&rdquo; will be removed from every tag it is attached to.
              Nobody has answered it, so nothing else changes — but archiving keeps it around in
              case you want it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn('bg-destructive')}
              onPress={() => {
                const target = confirming;
                setConfirming(null);
                if (target) void run(() => deleteQuestion(target.id));
              }}>
              <Text className="text-white">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
