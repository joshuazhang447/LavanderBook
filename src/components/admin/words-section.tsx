import { MoreHorizontal, Plus, Search, SpellCheck, Upload } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';

import { FilterSelect, useDebounced } from '@/components/admin/filters';
import { ImportDialog } from '@/components/admin/import-dialog';
import {
  CATEGORY_LABEL,
  MATCH_LABEL,
  maskTerm,
  TIER_LABEL,
} from '@/components/admin/moderation-labels';
import { EXACT_FORMAT, HighlightedText } from '@/components/admin/review-row';
import { TermDialog } from '@/components/admin/term-dialog';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import {
  deleteTerm,
  fetchModerationSettings,
  listTerms,
  rescreenReviews,
  setModerationEnforced,
  setTermArchived,
  tryModeration,
  type ModerationSettings,
  type ModerationTerm,
  type RescanProgress,
  type TermCategory,
  type TryResult,
} from '@/lib/admin';
import { cn } from '@/lib/utils';

const CATEGORY_OPTIONS = [
  { value: 'any', label: 'Every category' },
  ...(Object.keys(CATEGORY_LABEL) as TermCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABEL[value],
  })),
];

/* -------------------------------------------------------------------------- */

type TermRowProps = {
  term: ModerationTerm;
  showWords: boolean;
  onEdit: () => void;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
};

function TermRow({ term, showWords, onEdit, onArchive, onDelete }: TermRowProps) {
  // Anything that ever matched stays, archived, so the reviews it matched still
  // say why they were held. The server's own test: a past decision counts, not
  // only a review that matches it now.
  const used = term.inUse;

  return (
    <View className="flex-row items-start gap-3 border-b border-border px-6 py-3">
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-medium text-foreground">
            {showWords ? term.term : maskTerm(term.term)}
          </Text>
          <Badge variant={term.tier === 'hold' ? 'destructive' : 'secondary'}>
            <Text>{TIER_LABEL[term.tier]}</Text>
          </Badge>
          <Badge variant="outline">
            <Text>{CATEGORY_LABEL[term.category] ?? term.category}</Text>
          </Badge>
          <Text className="text-xs text-muted-foreground">{MATCH_LABEL[term.matchMode]}</Text>
          {term.language ? (
            <Text className="font-mono text-xs text-muted-foreground">{term.language}</Text>
          ) : null}
        </View>
        {term.allow.length > 0 ? (
          <Text className="text-xs text-muted-foreground">
            Never counts in: {showWords ? term.allow.join(' · ') : term.allow.map(maskTerm).join(' · ')}
          </Text>
        ) : null}
        {term.note ? <Text className="text-xs text-muted-foreground">{term.note}</Text> : null}
        <Text className="text-xs text-muted-foreground">
          Matched {term.reviewCount} {term.reviewCount === 1 ? 'review' : 'reviews'}
          {term.heldCount > 0 ? `, ${term.heldCount} held now` : ''}
          {term.createdByName ? ` · added by ${term.createdByName}` : ''}
        </Text>
      </View>

      <View className="flex-row items-center gap-1">
        <Button variant="outline" size="sm" onPress={onEdit}>
          <Text>Edit</Text>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="More for this word">
              <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onPress={() => onArchive(term.archivedAt === null)}>
              <Text>{term.archivedAt ? 'Restore' : 'Archive'}</Text>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" disabled={used} onPress={onDelete}>
              <Text>{used ? 'Has matched a review - archive it' : 'Delete'}</Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </View>
    </View>
  );
}

function TermGroup({
  title,
  hint,
  terms,
  dimmed,
  ...row
}: {
  title: string;
  hint: string;
  terms: ModerationTerm[];
  dimmed?: boolean;
  showWords: boolean;
  onEdit: (term: ModerationTerm) => void;
  onArchive: (term: ModerationTerm, archived: boolean) => void;
  onDelete: (term: ModerationTerm) => void;
}) {
  if (terms.length === 0) return null;
  return (
    <View className="mt-6">
      <View className="px-6 pb-2">
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title} ({terms.length})
        </Text>
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      </View>
      <Separator />
      <View className={cn(dimmed && 'opacity-60')}>
        {terms.map((term) => (
          <TermRow
            key={term.id}
            term={term}
            showWords={row.showWords}
            onEdit={() => row.onEdit(term)}
            onArchive={(archived) => row.onArchive(term, archived)}
            onDelete={() => row.onDelete(term)}
          />
        ))}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

type WordsSectionProps = {
  /** Whether this section is the one on screen. See UsersSection. */
  visible: boolean;
  /** Switching the mode or rescanning changes what is in the queue. */
  onChanged: () => void;
};

/**
 * The word list, which lives only in the database.
 *
 * The words are masked here until someone chooses to see them: a moderator
 * opening the panel for something else should not be met with the list. The
 * mode switch is the one change that alters what every reader sees, so it asks
 * first.
 */
export function WordsSection({ visible, onChanged }: WordsSectionProps) {
  const [terms, setTerms] = React.useState<ModerationTerm[] | null>(null);
  const [settings, setSettings] = React.useState<ModerationSettings | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [reloads, setReloads] = React.useState(0);

  /** undefined closed, null new, a term edits it. */
  const [editing, setEditing] = React.useState<ModerationTerm | null | undefined>(undefined);
  const [importing, setImporting] = React.useState(false);
  const [confirmingMode, setConfirmingMode] = React.useState<boolean | null>(null);
  const [deleting, setDeleting] = React.useState<ModerationTerm | null>(null);

  const [showWords, setShowWords] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState<string>('any');

  const [tryText, setTryText] = React.useState('');
  const [tryResult, setTryResult] = React.useState<TryResult | null>(null);
  const [tryError, setTryError] = React.useState<string | null>(null);

  const [rescanning, setRescanning] = React.useState(false);
  const [rescan, setRescan] = React.useState<RescanProgress | null>(null);

  const settledTry = useDebounced(tryText, 400);
  const settledSearch = useDebounced(search, 200);

  React.useEffect(() => {
    if (!visible) return;
    let active = true;

    Promise.all([listTerms(true), fetchModerationSettings()])
      .then(([rows, mode]) => {
        if (!active) return;
        setTerms(rows);
        setSettings(mode);
        setLoadError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setTerms([]);
        setLoadError(cause instanceof Error ? cause.message : 'Could not load the word list.');
      });

    return () => {
      active = false;
    };
  }, [visible, reloads]);

  React.useEffect(() => {
    if (!visible || settledTry.trim() === '') return;
    let active = true;

    tryModeration(settledTry)
      .then((result) => {
        if (!active) return;
        setTryResult(result);
        setTryError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setTryResult(null);
        setTryError(cause instanceof Error ? cause.message : 'Could not try that.');
      });

    return () => {
      active = false;
    };
    // The list changing changes the answer, so a reload asks again.
  }, [visible, settledTry, reloads]);

  const refetch = React.useCallback(() => setReloads((count) => count + 1), []);

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : 'That did not work.');
    }
    refetch();
  }

  async function startRescan() {
    setRescanning(true);
    setActionError(null);
    setRescan({ scanned: 0, changed: 0, opened: 0 });
    try {
      await rescreenReviews(setRescan);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : 'The rescan stopped.');
    }
    setRescanning(false);
    refetch();
    onChanged();
  }

  const needle = settledSearch.trim().toLowerCase();
  const shown = (terms ?? []).filter(
    (term) =>
      (category === 'any' || term.category === category) &&
      (needle === '' ||
        term.term.toLowerCase().includes(needle) ||
        (term.note ?? '').toLowerCase().includes(needle))
  );
  const hold = shown.filter((term) => term.archivedAt === null && term.tier === 'hold');
  const watch = shown.filter((term) => term.archivedAt === null && term.tier === 'watch');
  const archived = shown.filter((term) => term.archivedAt !== null);

  const groupProps = {
    showWords,
    onEdit: (term: ModerationTerm) => setEditing(term),
    onArchive: (term: ModerationTerm, next: boolean) => void run(() => setTermArchived(term.id, next)),
    onDelete: (term: ModerationTerm) => setDeleting(term),
  };

  return (
    <View className="flex-1">
      <View className="gap-4 border-b border-border px-6 py-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-bold text-foreground">Word list</Text>
            <Text className="text-sm text-muted-foreground">
              Slurs the filter looks for. Hold words keep a review back until someone here
              publishes it; watch words publish it and add an item to Worth a look. Kept only in
              the database, never in the code.
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button variant="outline" onPress={() => setImporting(true)}>
              <Icon as={Upload} className="size-4 text-foreground" />
              <Text>Import</Text>
            </Button>
            <Button onPress={() => setEditing(null)}>
              <Icon as={Plus} className="size-4 text-primary-foreground" />
              <Text>Add a word</Text>
            </Button>
          </View>
        </View>

        {loadError ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {loadError}
          </Text>
        ) : null}
        {actionError ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {actionError}
          </Text>
        ) : null}
      </View>

      {terms === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="pb-10">
          <View className="gap-4 px-6 pt-5">
            {/* The mode. */}
            <View className="gap-2 rounded-md border border-border bg-card p-4">
              <View className="flex-row items-center justify-between gap-4">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    {settings?.enforced ? 'Enforcing' : 'Shadow mode'}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {settings?.enforced
                      ? 'Hold words keep reviews back until someone publishes them, and published reviews show those words masked.'
                      : 'Nothing is held or masked. What would have been held goes to Worth a look, so the list can be tuned on real reviews first.'}
                  </Text>
                </View>
                <Switch
                  aria-label="Enforce the word list"
                  checked={settings?.enforced ?? false}
                  onCheckedChange={(next) => setConfirmingMode(next)}
                  disabled={settings === null}
                />
              </View>
              <Text className="text-xs text-muted-foreground">
                {settings?.heldNow ?? 0} {settings?.heldNow === 1 ? 'review' : 'reviews'} held now ·{' '}
                {settings?.shadowLastWeek ?? 0} would have been held in the last week
                {settings?.updatedByName && settings.updatedAt
                  ? ` · last changed by ${settings.updatedByName}, ${EXACT_FORMAT.format(new Date(settings.updatedAt))}`
                  : ''}
              </Text>
            </View>

            {/* Try it. */}
            <View className="gap-2 rounded-md border border-border bg-card p-4">
              <Label nativeID="words-try">Try a sentence</Label>
              <Textarea
                aria-labelledby="words-try"
                value={tryText}
                onChangeText={setTryText}
                maxLength={2000}
                numberOfLines={2}
                autoCorrect={false}
                placeholder="See what the list makes of it. Nothing is saved."
              />
              {tryError ? (
                <Text className="text-xs text-destructive" accessibilityRole="alert">
                  {tryError}
                </Text>
              ) : tryText.trim() !== '' && tryResult ? (
                <View className="gap-1.5">
                  <Text className="text-sm font-medium text-foreground">
                    {tryResult.held
                      ? 'A review saying this would be held for a person.'
                      : tryResult.terms.length > 0
                        ? 'A review saying this would publish, with an item in Worth a look.'
                        : 'Nothing matched.'}
                  </Text>
                  {tryResult.terms.length > 0 ? (
                    <>
                      <HighlightedText segments={tryResult.segments} />
                      <Text className="text-xs text-muted-foreground">
                        Once published, readers would see: {tryResult.masked}
                      </Text>
                    </>
                  ) : null}
                  <Text className="font-mono text-xs text-muted-foreground" numberOfLines={2}>
                    Compared as: {tryResult.folded}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Rescan. */}
            <View className="flex-row items-center justify-between gap-4 rounded-md border border-border bg-card p-4">
              <View className="flex-1 gap-1">
                <Text className="text-sm font-medium text-foreground">Check reviews already posted</Text>
                <Text className="text-xs text-muted-foreground">
                  {rescan
                    ? `${rescanning ? 'Checking' : 'Checked'} ${rescan.scanned} ${rescan.scanned === 1 ? 'review' : 'reviews'}: ${rescan.changed} matched something new, ${rescan.opened} added to Worth a look.`
                    : 'After adding words, look through every review against the list as it is now. Nothing is held or changed; new matches go to Worth a look.'}
                </Text>
              </View>
              <Button variant="outline" onPress={startRescan} disabled={rescanning}>
                {rescanning ? <ActivityIndicator size="small" /> : <Text>Check now</Text>}
              </Button>
            </View>

            {/* Filters. */}
            <View className="flex-row flex-wrap items-center gap-3">
              <View className="min-w-[220px] flex-1 flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
                <Icon as={Search} className="size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search words and notes"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
                />
              </View>
              <FilterSelect
                label="Category"
                width="w-[200px]"
                value={category}
                options={CATEGORY_OPTIONS}
                onChange={setCategory}
              />
              <View className="flex-row items-center gap-2">
                <Switch aria-labelledby="words-show" checked={showWords} onCheckedChange={setShowWords} />
                <Label nativeID="words-show" onPress={() => setShowWords(!showWords)}>
                  Show words
                </Label>
              </View>
            </View>
          </View>

          {(terms ?? []).length === 0 ? (
            <View className="items-center gap-3 px-6 py-16">
              <Icon as={SpellCheck} className="size-8 text-muted-foreground" />
              <Text className="text-center text-sm text-muted-foreground">
                The list is empty, so nothing is held. Import the reviewers&apos; workbook, or add a
                word.
              </Text>
            </View>
          ) : (
            <>
              <TermGroup
                title="Hold"
                hint="A review using one of these waits for a person."
                terms={hold}
                {...groupProps}
              />
              <TermGroup
                title="Watch"
                hint="A review using one of these publishes, and adds an item to Worth a look."
                terms={watch}
                {...groupProps}
              />
              <TermGroup
                title="Archived"
                hint="No longer matched. Kept so the reviews they matched still say why."
                terms={archived}
                dimmed
                {...groupProps}
              />
            </>
          )}
        </ScrollView>
      )}

      {editing !== undefined ? (
        <TermDialog
          key={editing?.id ?? 'new'}
          term={editing}
          onClose={() => setEditing(undefined)}
          onSaved={refetch}
        />
      ) : null}

      {importing ? (
        <ImportDialog
          showWords={showWords}
          onClose={() => setImporting(false)}
          onImported={refetch}
        />
      ) : null}

      <AlertDialog
        open={confirmingMode !== null}
        onOpenChange={(next) => !next && setConfirmingMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmingMode ? 'Start enforcing the word list?' : 'Go back to shadow mode?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmingMode
                ? 'From now on, a review using a hold word waits for someone here before anyone else can read it, and published reviews show those words masked. Nothing already published is held. App versions older than this change cannot show their authors that a review is waiting.'
                : 'From now on nothing is held or masked; would-be holds go to Worth a look. Reviews already held stay held until someone decides.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={() => {
                const target = confirmingMode;
                setConfirmingMode(null);
                if (target !== null) {
                  void run(() => setModerationEnforced(target)).then(onChanged);
                }
              }}>
              <Text>{confirmingMode ? 'Start enforcing' : 'Shadow mode'}</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this word?</AlertDialogTitle>
            <AlertDialogDescription>
              It has never matched a review, so nothing loses its history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn('bg-destructive', Platform.select({ web: 'hover:bg-destructive/90' }))}
              onPress={() => {
                const target = deleting;
                setDeleting(null);
                if (target) void run(() => deleteTerm(target.id));
              }}>
              <Text className="text-white">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
