import { ChevronLeft, ChevronRight, Inbox, ShieldAlert } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, ScrollView, View } from 'react-native';

import { CaseCard, type CaseAuthor } from '@/components/admin/case-card';
import { FilterSelect } from '@/components/admin/filters';
import { InlinePicker } from '@/components/admin/inline-picker';
import { RejectDialog } from '@/components/admin/reject-dialog';
import { ReviewDialog } from '@/components/admin/review-dialog';
import type { ReviewFocus } from '@/components/admin/review-row';
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
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  decideReview,
  listCases,
  setUserBanned,
  takeDownAuthorReviews,
  type AdminCase,
  type AdminReview,
  type CaseKindFilter,
  type CaseQueue,
  type ModerationCounts,
} from '@/lib/admin';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

const KIND_OPTIONS = [
  { value: 'any', label: 'Everything' },
  { value: 'review', label: 'Reviews' },
  { value: 'venue_name', label: 'Place names' },
  { value: 'reported', label: 'Reported' },
] as const;

type QueueSectionProps = {
  /** Whether this section is the one on screen. See UsersSection. */
  visible: boolean;
  /** The panel's polled counts. A change while open means new items: fetch again. */
  counts: ModerationCounts | null;
  /** Called after every decision, so the badge does not wait for the next poll. */
  onChanged: () => void;
  onFocus: (focus: ReviewFocus) => void;
};

/**
 * Everything waiting for a person.
 *
 * Needs a decision: reviews the word list held, held place names, and
 * reported reviews. Worth a look: published reviews with a watch word, shadow
 * mode's would-be holds, rescans, and reports on words a person already kept.
 * Decided: the record - who decided what, when and why.
 *
 * Nothing in the queue is hidden by being here. A reported review stays up
 * until somebody takes it down; only the word list holds anything, and only
 * while enforcing.
 */
export function QueueSection({ visible, counts, onChanged, onFocus }: QueueSectionProps) {
  const [queue, setQueue] = React.useState<CaseQueue>('decide');
  const [kind, setKind] = React.useState<CaseKindFilter>('any');
  const [page, setPage] = React.useState(0);

  const [rows, setRows] = React.useState<AdminCase[] | null>(null);
  const [total, setTotal] = React.useState(0);
  // Kept apart: a refetch's success clears the first and must never clear the
  // second, or a refused decision vanishes one round trip after it appears.
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [reloads, setReloads] = React.useState(0);

  const [editing, setEditing] = React.useState<AdminReview | null>(null);
  const [rejecting, setRejecting] = React.useState<AdminReview | null>(null);
  const [banning, setBanning] = React.useState<CaseAuthor | null>(null);
  const [takingDown, setTakingDown] = React.useState<CaseAuthor | null>(null);

  const decideCount = counts?.decide;
  const lookCount = counts?.look;

  React.useEffect(() => {
    if (!visible) return;
    let active = true;

    listCases({ queue, kind, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        // A decision can empty the last page; step back rather than show "0-0 of 0".
        if (result.rows.length === 0 && page > 0) {
          setPage(0);
          return;
        }
        setRows(result.rows);
        setTotal(result.total);
        setLoadError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setLoadError(cause instanceof Error ? cause.message : 'Could not load the queue.');
      });

    return () => {
      active = false;
    };
    // The counts are in the dependencies on purpose: when the panel's poll
    // finds new items, the list on screen should show them.
  }, [visible, queue, kind, page, reloads, decideCount, lookCount]);

  function refetch() {
    setReloads((count) => count + 1);
  }

  /** Runs one decision. A refusal stays on screen until the next action. */
  async function act(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : 'That decision was refused.');
    }
    refetch();
    onChanged();
  }

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  const queueOptions = [
    {
      value: 'decide' as const,
      label: `Needs a decision${decideCount === undefined ? '' : ` (${decideCount})`}`,
    },
    { value: 'look' as const, label: `Worth a look${lookCount === undefined ? '' : ` (${lookCount})`}` },
    { value: 'decided' as const, label: 'Decided' },
  ];

  return (
    <View className="flex-1">
      <View className="gap-4 border-b border-border px-6 py-5">
        <View className="gap-1">
          <Text className="text-2xl font-bold text-foreground">Queue</Text>
          <Text className="text-sm text-muted-foreground">
            Reviews and place names the word list held, and what readers reported. A report never
            takes anything down by itself - you do. Matched words are marked.
          </Text>
        </View>

        {counts && !counts.enforced ? (
          <View className="flex-row items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
            <Icon as={ShieldAlert} className="mt-0.5 size-4 text-muted-foreground" />
            <Text className="flex-1 text-sm text-muted-foreground">
              Shadow mode. The word list records what it would hold, under Worth a look, and holds
              nothing. Turn it on in Word list once it holds the right things.
            </Text>
          </View>
        ) : null}

        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <InlinePicker
            value={queue}
            options={queueOptions}
            onChange={(next) => {
              setQueue(next);
              setPage(0);
            }}
          />
          <FilterSelect
            label="Show"
            width="w-[170px]"
            value={kind}
            options={KIND_OPTIONS}
            onChange={(next) => {
              setKind(next as CaseKindFilter);
              setPage(0);
            }}
          />
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

      {rows === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Icon as={Inbox} className="size-8 text-muted-foreground" />
          <Text className="text-center text-sm text-muted-foreground">
            {queue === 'decided'
              ? 'Nothing has been decided yet.'
              : queue === 'decide'
                ? 'Nothing is waiting for a decision.'
                : 'Nothing to look at.'}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="pb-10">
          {rows.map((item) => (
            <CaseCard
              key={item.id}
              item={item}
              onAct={(action) => void act(action)}
              onEdit={setEditing}
              onReject={setRejecting}
              onBan={setBanning}
              onTakeDownAll={setTakingDown}
              onFocus={onFocus}
            />
          ))}
        </ScrollView>
      )}

      {editing ? (
        <ReviewDialog
          review={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refetch();
            onChanged();
          }}
        />
      ) : null}

      {rejecting ? (
        <RejectDialog
          title={rejecting.moderation === 'held' ? 'Reject this review?' : 'Take this review down?'}
          description={
            rejecting.moderation === 'held'
              ? 'It stays unpublished. Its author sees the reason and your note, and editing it sends it back here.'
              : 'Readers stop seeing it. Its author sees the reason and your note, and editing it sends it back here.'
          }
          confirmLabel={rejecting.moderation === 'held' ? 'Reject' : 'Take down'}
          onClose={() => setRejecting(null)}
          onConfirm={async (reason, note) => {
            const target = rejecting;
            await decideReview(target.id, 'reject', {
              reason,
              note,
              seenStatus: target.moderation,
              seenUpdatedAt: target.updatedAt,
            });
            refetch();
            onChanged();
          }}
        />
      ) : null}

      {takingDown ? (
        <RejectDialog
          title={`Take down every review by ${takingDown.name}?`}
          description="All of them come down at once, which tells anyone comparing the map before and after that they were written by one person. That is why this is kept for banned accounts. Each one is recorded with this reason."
          confirmLabel="Take them all down"
          onClose={() => setTakingDown(null)}
          onConfirm={async (reason, note) => {
            await takeDownAuthorReviews(takingDown.id, reason, note);
            refetch();
            onChanged();
          }}
        />
      ) : null}

      <AlertDialog open={banning !== null} onOpenChange={(next) => !next && setBanning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {banning?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to post or edit reviews, add places, or send reports.
              Their reviews stay as they are; you can take them all down afterwards from here or
              from Users. A ban can be lifted in Users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn('bg-destructive', Platform.select({ web: 'hover:bg-destructive/90' }))}
              onPress={() => {
                const target = banning;
                setBanning(null);
                if (target) void act(() => setUserBanned(target.id, true));
              }}>
              <Text className="text-white">Ban</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <View className="flex-row items-center justify-end gap-6 border-t border-border px-6 py-3">
        <Text className="text-sm text-muted-foreground">
          {from}-{to} of {total}
        </Text>
        <View className="flex-row items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous page"
            disabled={page === 0}
            onPress={() => setPage(page - 1)}>
            <Icon as={ChevronLeft} className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next page"
            disabled={page >= lastPage}
            onPress={() => setPage(page + 1)}>
            <Icon as={ChevronRight} className="size-4" />
          </Button>
        </View>
      </View>
    </View>
  );
}
