import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MoreHorizontal,
  Plus,
  Tag as TagIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';

import { TagChip } from '@/components/admin/tag-chip';
import { TagDialog } from '@/components/admin/tag-dialog';
import { TagQuestions } from '@/components/admin/tag-questions';
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
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import {
  deleteTag,
  listAdminTags,
  reorderTags,
  setTagArchived,
  type AdminTag,
} from '@/lib/admin';
import { cn } from '@/lib/utils';

function usage(tag: AdminTag): string {
  const venues = `${tag.venueCount} venue${tag.venueCount === 1 ? '' : 's'}`;
  const questions = `${tag.questionCount} question${tag.questionCount === 1 ? '' : 's'}`;
  return `${venues} · ${questions}`;
}

type TagRowProps = {
  tag: AdminTag;
  /** Null for archived rows, which have no position to move. */
  onMove: ((direction: -1 | 1) => void) | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
  /** Attaching or detaching a field changes the count on this row. */
  onQuestionsChanged: () => void;
};

function TagRow({
  tag,
  onMove,
  canMoveUp,
  canMoveDown,
  onEdit,
  onArchive,
  onDelete,
  onQuestionsChanged,
}: TagRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  // Fields no longer hold a tag down: detaching them cascades and they survive
  // in the bank. Only a venue still carrying the tag blocks a delete.
  const inUse = tag.venueCount > 0;

  return (
    <View className="border-b border-border px-6 py-3">
      <View className="flex-row items-start gap-3">
        {onMove ? (
          <View className="gap-0.5 pt-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              aria-label={`Move ${tag.label} up`}
              disabled={!canMoveUp}
              onPress={() => onMove(-1)}>
              <Icon as={ChevronUp} className="size-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-5"
              aria-label={`Move ${tag.label} down`}
              disabled={!canMoveDown}
              onPress={() => onMove(1)}>
              <Icon as={ChevronDown} className="size-3.5 text-muted-foreground" />
            </Button>
          </View>
        ) : (
          <View className="w-5" />
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={`${expanded ? 'Hide' : 'Show'} the fields on ${tag.label}`}
          aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)}>
          <Icon
            as={expanded ? ChevronDown : ChevronRight}
            className="size-4 text-muted-foreground"
          />
        </Button>

        <View className="flex-1 gap-1">
          <View className="flex-row items-center gap-2">
            {/* The list is its own colour preview - no separate swatch needed. */}
            <TagChip label={tag.label} color={tag.color} textColor={tag.textColor} />
            <Text className="font-mono text-xs text-muted-foreground">{tag.slug}</Text>
            {tag.textColor ? (
              <Text className="text-[10px] text-muted-foreground">fixed colours</Text>
            ) : null}
          </View>
          {tag.description ? (
            <Text className="text-sm text-muted-foreground">{tag.description}</Text>
          ) : null}
          <Text className="text-xs text-muted-foreground">{usage(tag)}</Text>
        </View>

        <View className="flex-row items-center gap-1">
          <Button variant="outline" size="sm" onPress={onEdit}>
            <Text>Edit</Text>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label={`More for ${tag.label}`}>
                <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onPress={() => onArchive(tag.archivedAt === null)}>
                <Text>{tag.archivedAt ? 'Restore' : 'Archive'}</Text>
              </DropdownMenuItem>
              {/* Disabled with the reason on it rather than hidden, so its absence
                  is never a mystery. */}
              <DropdownMenuItem variant="destructive" disabled={inUse} onPress={onDelete}>
                <Text>
                  {inUse
                    ? `Applied to ${tag.venueCount} venue${tag.venueCount === 1 ? '' : 's'}`
                    : 'Delete'}
                </Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </View>
      </View>

      {/* Mounted only while open, so opening this section does not fetch a
          questionnaire for every tag on the off-chance. */}
      {expanded ? (
        <View className="ml-8 mt-3">
          <TagQuestions tagId={tag.id} tagLabel={tag.label} onChanged={onQuestionsChanged} />
        </View>
      ) : null}
    </View>
  );
}

type TagsSectionProps = {
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

export function TagsSection({ visible }: TagsSectionProps) {
  const [tags, setTags] = React.useState<AdminTag[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  /** undefined closed, null new, a tag edits it. */
  const [editing, setEditing] = React.useState<AdminTag | null | undefined>(undefined);
  const [confirming, setConfirming] = React.useState<AdminTag | null>(null);
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    if (!visible) return;
    let active = true;

    listAdminTags()
      .then((rows) => {
        if (!active) return;
        setTags(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setTags([]);
        setError(cause instanceof Error ? cause.message : 'Could not load tags.');
      });

    return () => {
      active = false;
    };
  }, [reloads, visible]);

  const refetch = React.useCallback(() => setReloads((n) => n + 1), []);

  const live = (tags ?? []).filter((tag) => tag.archivedAt === null);
  const archived = (tags ?? []).filter((tag) => tag.archivedAt !== null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
    }
    refetch();
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...live];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    // Optimistic, because a reorder that waits for a round trip reads as a
    // click that missed. The refetch inside run() settles it either way.
    setTags([...next, ...archived]);
    void run(() => reorderTags(next.map((tag) => tag.id)));
  }

  return (
    <View className="flex-1">
      <View className="gap-4 border-b border-border px-6 py-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="gap-1">
            <Text className="text-2xl font-bold text-foreground">Tags</Text>
            <Text className="text-sm text-muted-foreground">
              The kinds of place LavenderBook knows about. Each one carries its own questions.
            </Text>
          </View>
          <Button onPress={() => setEditing(null)}>
            <Icon as={Plus} className="size-4 text-primary-foreground" />
            <Text>New tag</Text>
          </Button>
        </View>

        {error ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>

      {tags === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : live.length === 0 && archived.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Icon as={TagIcon} className="size-8 text-muted-foreground" />
          <Text className="text-sm text-muted-foreground">
            No tags yet. Add one to start classifying places.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="pb-10">
          {live.map((tag, index) => (
            <TagRow
              key={tag.id}
              tag={tag}
              onMove={(direction) => move(index, direction)}
              canMoveUp={index > 0}
              canMoveDown={index < live.length - 1}
              onEdit={() => setEditing(tag)}
              onArchive={(archived) => void run(() => setTagArchived(tag.id, archived))}
              onDelete={() => setConfirming(tag)}
              onQuestionsChanged={refetch}
            />
          ))}

          {archived.length > 0 ? (
            <View className="mt-6">
              <View className="px-6 pb-2">
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Archived ({archived.length})
                </Text>
                <Text className="text-xs text-muted-foreground">
                  Kept, not asked. Existing answers stay readable; no new venue can take one.
                </Text>
              </View>
              <Separator />
              <View className="opacity-60">
                {archived.map((tag) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    onMove={null}
                    canMoveUp={false}
                    canMoveDown={false}
                    onEdit={() => setEditing(tag)}
                    onArchive={(archived) => void run(() => setTagArchived(tag.id, archived))}
                    onDelete={() => setConfirming(tag)}
              onQuestionsChanged={refetch}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Keyed and mounted on demand, so every field initialises from props and
          nothing has to sync state in an effect. */}
      {editing !== undefined ? (
        <TagDialog
          key={editing?.id ?? 'new'}
          tag={editing}
          onClose={() => setEditing(undefined)}
          onSaved={refetch}
        />
      ) : null}

      {/* The one irreversible action in the panel, and the only one that asks. */}
      <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirming?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Its {confirming?.questionCount ?? 0} field
              {(confirming?.questionCount ?? 0) === 1 ? '' : 's'} will be detached but kept in the
              bank, with every answer intact. If you might want the tag itself back, archive it
              instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn('bg-destructive', Platform.select({ web: 'hover:bg-destructive/90' }))}
              onPress={() => {
                const target = confirming;
                setConfirming(null);
                if (target) void run(() => deleteTag(target.id));
              }}>
              <Text className="text-white">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
