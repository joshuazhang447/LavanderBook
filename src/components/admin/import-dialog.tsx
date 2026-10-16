import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { maskTerm } from '@/components/admin/moderation-labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { importTerms, type ImportAction, type ImportResult, type ImportRow } from '@/lib/admin';
import { cn } from '@/lib/utils';

/** The workbook's columns, in the order they are read when there is no header row. */
const COLUMNS = ['term', 'language', 'tier', 'category', 'match', 'allow', 'note'] as const;
type Column = (typeof COLUMNS)[number];

const ACTION_LABEL: Record<ImportAction, string> = {
  add: 'Add',
  update: 'Update',
  same: 'No change',
  duplicate: 'Duplicate',
  invalid: 'Not imported',
};

/**
 * Turns a paste from the reviewers' workbook into rows.
 *
 * Tab-separated, as a spreadsheet copies. A first line naming the columns
 * (term, language, tier, category, match, allow, note - any order, any case)
 * is used as the header; otherwise the columns are read in that order. Line
 * numbers are the paste's own, so a problem can be found in the workbook.
 */
function parsePaste(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/);
  let order: (Column | null)[] = [...COLUMNS];
  let start = 0;

  const first = lines[0]?.split('\t').map((cell) => cell.trim().toLowerCase()) ?? [];
  if (first.includes('term') && first.includes('tier')) {
    order = first.map((name) => (COLUMNS as readonly string[]).includes(name) ? (name as Column) : null);
    start = 1;
  }

  const rows: ImportRow[] = [];
  for (let index = start; index < lines.length; index++) {
    const cells = lines[index].split('\t');
    if (cells.every((cell) => cell.trim() === '')) continue;

    const row: Record<Column, string> = {
      term: '',
      language: '',
      tier: '',
      category: '',
      match: '',
      allow: '',
      note: '',
    };
    order.forEach((column, position) => {
      if (column) row[column] = (cells[position] ?? '').trim();
    });

    rows.push({
      line: index + 1,
      term: row.term,
      tier: row.tier,
      category: row.category,
      match: row.match || undefined,
      language: row.language || undefined,
      allow: row.allow || undefined,
      note: row.note || undefined,
    });
  }
  return rows;
}

type ImportDialogProps = {
  /** Whether the words themselves are shown, as in the list behind it. */
  showWords: boolean;
  onClose: () => void;
  onImported: () => void;
};

/**
 * Paste the reviewers' workbook in, see what would change, then apply it.
 *
 * Nothing is written by Preview. Apply writes the rows the preview called add
 * or update, and comes back with what actually happened to each.
 */
export function ImportDialog({ showWords, onClose, onImported }: ImportDialogProps) {
  const [text, setText] = React.useState('');
  const [results, setResults] = React.useState<ImportResult[] | null>(null);
  const [applied, setApplied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rows = React.useMemo(() => parsePaste(text), [text]);
  const writable = results?.filter((result) => result.action === 'add' || result.action === 'update').length ?? 0;

  function onTextChange(next: string) {
    setText(next);
    // A preview of different text says nothing about this one.
    setResults(null);
    setApplied(false);
  }

  async function run(apply: boolean) {
    if (busy || rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await importTerms(rows, apply));
      if (apply) {
        setApplied(true);
        onImported();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The import could not run.');
    }
    setBusy(false);
  }

  const counts = (results ?? []).reduce<Record<ImportAction, number>>(
    (total, result) => ({ ...total, [result.action]: total[result.action] + 1 }),
    { add: 0, update: 0, same: 0, duplicate: 0, invalid: 0 }
  );

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import words</DialogTitle>
          <DialogDescription>
            Copy the rows from the reviewers&apos; workbook and paste them here. Columns: term,
            language, tier (hold or watch), category, match (word, prefix or anywhere), allow
            (innocent phrases, separated by semicolons), note. A header row is optional.
          </DialogDescription>
        </DialogHeader>

        <ScrollView className="max-h-[60vh]" contentContainerClassName="gap-4 px-0.5">
          <Textarea
            aria-label="Rows to import"
            value={text}
            onChangeText={onTextChange}
            numberOfLines={8}
            autoCapitalize="none"
            autoCorrect={false}
            className="font-mono text-xs"
          />
          <Text className="text-xs text-muted-foreground">
            {rows.length === 0
              ? 'Nothing pasted yet.'
              : `${rows.length} ${rows.length === 1 ? 'row' : 'rows'} read. Empty language, allow and note keep what an existing word has.`}
          </Text>

          {results ? (
            <View className="gap-2">
              <Text className="text-sm text-foreground">
                {applied ? 'Imported: ' : 'Preview: '}
                {counts.add} to add, {counts.update} to update, {counts.same} unchanged,{' '}
                {counts.duplicate} duplicated in the paste, {counts.invalid} not imported.
              </Text>
              <View className="rounded-md border border-border">
                {results.map((result) => (
                  <View
                    key={`${result.line}-${result.term}`}
                    className="flex-row items-start gap-3 border-b border-border px-3 py-2">
                    <Text className="w-10 font-mono text-xs text-muted-foreground">{result.line}</Text>
                    <Text className="w-40 text-sm text-foreground" numberOfLines={1}>
                      {result.term ? (showWords ? result.term : maskTerm(result.term)) : '-'}
                    </Text>
                    <Text className="w-28 text-xs text-muted-foreground">
                      {[result.tier, result.category].filter(Boolean).join(' · ')}
                    </Text>
                    <View className="flex-1 gap-0.5">
                      <Text
                        className={cn(
                          'text-xs font-medium',
                          result.action === 'invalid' ? 'text-destructive' : 'text-foreground'
                        )}>
                        {ACTION_LABEL[result.action] ?? result.action}
                      </Text>
                      {result.problem ? (
                        <Text className="text-xs text-muted-foreground">{result.problem}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <DialogFooter>
          <Button variant="outline" onPress={onClose} disabled={busy}>
            <Text>{applied ? 'Done' : 'Cancel'}</Text>
          </Button>
          {!applied ? (
            <>
              <Button variant="outline" onPress={() => run(false)} disabled={busy || rows.length === 0}>
                <Text>Preview</Text>
              </Button>
              <Button onPress={() => run(true)} disabled={busy || results === null || writable === 0}>
                {busy ? <ActivityIndicator size="small" /> : <Text>Apply {writable || ''}</Text>}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
