import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import {
  CATEGORY_LABEL,
  DECISION_LABEL,
  SIGNAL_LABEL,
  TIER_LABEL,
} from '@/components/admin/moderation-labels';
import {
  AuthorAccount,
  DATE_FORMAT,
  EXACT_FORMAT,
  HighlightedText,
  ReviewAnswers,
  ReviewHeadline,
  type ReviewFocus,
} from '@/components/admin/review-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  decideReview,
  decideVenueName,
  listCaseReports,
  type AdminCase,
  type AdminReview,
  type CaseReport,
} from '@/lib/admin';
import { reasonText } from '@/lib/moderation-text';
import { cn } from '@/lib/utils';

export type CaseAuthor = { id: string; name: string; banned: boolean };

type CaseCardProps = {
  item: AdminCase;
  /** Runs a decision, then refreshes the list and the badge. */
  onAct: (action: () => Promise<unknown>) => void;
  onEdit: (review: AdminReview) => void;
  /** Reject a held review, or take a published one down: both ask for a reason. */
  onReject: (review: AdminReview) => void;
  onBan: (author: CaseAuthor) => void;
  onTakeDownAll: (author: CaseAuthor) => void;
  onFocus: (focus: ReviewFocus) => void;
};

/**
 * One item in the queue: what put it there, the words as they stand now with
 * every match marked, who reported it, and the decisions that fit it.
 */
export function CaseCard({ item, onAct, onEdit, onReject, onBan, onTakeDownAll, onFocus }: CaseCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const review = item.review;
  const author: CaseAuthor | null =
    item.authorId && item.authorName
      ? { id: item.authorId, name: item.authorName, banned: item.authorBannedAt !== null }
      : null;

  return (
    <View className="gap-3 border-b border-border px-6 py-4">
      <View className="flex-row flex-wrap items-center gap-2">
        {item.signals.map((signal) => (
          <Badge key={signal} variant="outline">
            <Text>{SIGNAL_LABEL[signal] ?? signal}</Text>
          </Badge>
        ))}
        {item.terms.map((term) => (
          <Badge key={term.id} variant={term.tier === 'hold' ? 'destructive' : 'secondary'}>
            <Text>
              {term.term} · {TIER_LABEL[term.tier]} · {CATEGORY_LABEL[term.category] ?? term.category}
            </Text>
          </Badge>
        ))}
        <Text
          className="text-xs text-muted-foreground"
          {...Platform.select({ web: { title: EXACT_FORMAT.format(new Date(item.openedAt)) } })}>
          In the queue since {DATE_FORMAT.format(new Date(item.openedAt))}
        </Text>
      </View>

      {item.kind === 'venue_name' && item.venue ? (
        <VenueNameContent item={item} />
      ) : review ? (
        <View className="flex-row items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`${expanded ? 'Hide' : 'Show'} who wrote it and its answers`}
            aria-expanded={expanded}
            onPress={() => setExpanded(!expanded)}>
            <Icon as={expanded ? ChevronDown : ChevronRight} className="size-4 text-muted-foreground" />
          </Button>
          <View className="flex-1 gap-1">
            <ReviewHeadline review={review} />
            {review.body && review.body.trim() !== '' ? (
              <HighlightedText segments={review.bodySegments} />
            ) : (
              <Text className="text-sm italic text-muted-foreground">No written review</Text>
            )}
            {review.answerSegments.map((answer) => (
              <View key={answer.questionId} className="mt-1 gap-0.5">
                <Text className="text-xs font-medium text-muted-foreground">{answer.prompt}</Text>
                <HighlightedText segments={answer.segments} />
              </View>
            ))}
            {expanded ? (
              <View className="mt-2 gap-3 border-l border-border pl-4">
                {review.venueAddress ? (
                  <Text className="text-xs text-muted-foreground">{review.venueAddress}</Text>
                ) : null}
                <AuthorAccount review={review} />
                <ReviewAnswers reviewId={review.id} />
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <Text className="text-sm italic text-muted-foreground">
          The review has since been deleted. This record keeps who wrote it and what it matched,
          never the words.
        </Text>
      )}

      {item.reportCount > 0 ? <ReportsBlock item={item} /> : null}

      {item.state === 'closed' ? (
        <Decided item={item} />
      ) : item.kind === 'venue_name' && item.venue ? (
        <VenueNameActions item={item} onAct={onAct} />
      ) : review ? (
        <View className="flex-row flex-wrap items-center gap-2">
          {review.moderation === 'published' ? (
            <>
              <Button
                size="sm"
                onPress={() =>
                  onAct(() =>
                    decideReview(review.id, 'keep', {
                      seenStatus: review.moderation,
                      seenUpdatedAt: review.updatedAt,
                    })
                  )
                }>
                <Text>Keep it up</Text>
              </Button>
              <Button size="sm" variant="outline" onPress={() => onReject(review)}>
                <Text className="text-destructive">Take down...</Text>
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onPress={() =>
                  onAct(() =>
                    decideReview(review.id, 'publish', {
                      seenStatus: review.moderation,
                      seenUpdatedAt: review.updatedAt,
                    })
                  )
                }>
                <Text>Publish</Text>
              </Button>
              {review.moderation === 'held' ? (
                <Button size="sm" variant="outline" onPress={() => onReject(review)}>
                  <Text className="text-destructive">Reject...</Text>
                </Button>
              ) : null}
            </>
          )}
          <Button size="sm" variant="outline" onPress={() => onEdit(review)}>
            <Text>Edit</Text>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`More for the review of ${review.venueName}`}>
                <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onPress={() =>
                  onFocus({ kind: 'author', id: review.authorId, label: review.authorName })
                }>
                <Text>All reviews by this author</Text>
              </DropdownMenuItem>
              <DropdownMenuItem
                onPress={() =>
                  onFocus({ kind: 'venue', id: review.venueId, label: review.venueName })
                }>
                <Text>All reviews of this place</Text>
              </DropdownMenuItem>
              {author ? (
                <>
                  <DropdownMenuSeparator />
                  {author.banned ? (
                    <DropdownMenuItem variant="destructive" onPress={() => onTakeDownAll(author)}>
                      <Text>Take down all their reviews...</Text>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" onPress={() => onBan(author)}>
                      <Text>Ban the author...</Text>
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function VenueNameContent({ item }: { item: AdminCase }) {
  const venue = item.venue;
  if (!venue) return null;
  return (
    <View className="gap-1">
      <Text className="text-xs font-medium text-muted-foreground">
        {venue.pendingName ? 'Place name waiting for a check' : 'Place name'}
      </Text>
      <HighlightedText segments={venue.nameSegments} className="text-base" />
      {venue.pendingName ? (
        <Text className="text-xs text-muted-foreground">
          Readers see &quot;{venue.name}&quot; until you decide. Reviews of it are unaffected.
        </Text>
      ) : null}
      {venue.address ? (
        <Text className="text-xs text-muted-foreground">{venue.address}</Text>
      ) : null}
      {venue.googlePlaceId ? (
        <Text className="font-mono text-xs text-muted-foreground">{venue.googlePlaceId}</Text>
      ) : null}
      {item.authorName ? (
        <Text className="text-xs text-muted-foreground">Added by account {item.authorName}</Text>
      ) : null}
    </View>
  );
}

function VenueNameActions({
  item,
  onAct,
}: {
  item: AdminCase;
  onAct: (action: () => Promise<unknown>) => void;
}) {
  const venue = item.venue;
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState('');
  if (!venue) return null;

  if (renaming) {
    return (
      <View className="flex-row flex-wrap items-center gap-2">
        <Input
          value={name}
          onChangeText={setName}
          maxLength={200}
          placeholder="The place's real name"
          aria-label="New name for the place"
          className="min-w-[240px] flex-1"
        />
        <Button
          size="sm"
          disabled={name.trim() === ''}
          onPress={() => onAct(() => decideVenueName(venue.id, 'rename', name))}>
          <Text>Save name</Text>
        </Button>
        <Button size="sm" variant="outline" onPress={() => setRenaming(false)}>
          <Text>Cancel</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {venue.pendingName ? (
        <Button size="sm" onPress={() => onAct(() => decideVenueName(venue.id, 'publish'))}>
          <Text>Publish the name</Text>
        </Button>
      ) : (
        <Button size="sm" onPress={() => onAct(() => decideVenueName(venue.id, 'keep'))}>
          <Text>Keep the name</Text>
        </Button>
      )}
      <Button size="sm" variant="outline" onPress={() => setRenaming(true)}>
        <Text>Rename...</Text>
      </Button>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

function Decided({ item }: { item: AdminCase }) {
  const reason = reasonText(item.reason);
  return (
    <View className="gap-1 rounded-md border border-border bg-muted/40 p-3">
      <Text className="text-sm text-foreground">
        <Text className="font-medium">{DECISION_LABEL[item.decision ?? ''] ?? item.decision}</Text>
        {item.decidedByName ? ` by ${item.decidedByName}` : ''}
        {item.decidedAt ? ` on ${EXACT_FORMAT.format(new Date(item.decidedAt))}` : ''}
      </Text>
      {reason ? <Text className="text-xs text-muted-foreground">Reason: {reason.label}</Text> : null}
      {item.note ? <Text className="text-xs text-muted-foreground">Note: {item.note}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The reports behind an item: a count by reason up front, and each report with
 * its reporter's record on request. The record is the point - an account that
 * only ever reports, has nothing upheld and joined last week is what a group
 * burying honest reviews looks like.
 */
function ReportsBlock({ item }: { item: AdminCase }) {
  const [open, setOpen] = React.useState(false);
  const [reports, setReports] = React.useState<CaseReport[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    listCaseReports(item.id)
      .then((rows) => active && setReports(rows))
      .catch((cause: unknown) => {
        if (!active) return;
        setReports([]);
        setError(cause instanceof Error ? cause.message : 'Could not load the reports.');
      });
    return () => {
      active = false;
    };
  }, [open, item.id]);

  const summary = item.reportReasons
    .map((entry) => `${reasonText(entry.reason)?.label ?? entry.reason} ${entry.count}`)
    .join(' · ');

  return (
    <View className="gap-2 rounded-md border border-border bg-muted/30 p-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-sm text-foreground">
          <Text className="font-medium">
            {item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}
          </Text>
          {summary ? ` - ${summary}` : ''}
        </Text>
        <Button size="sm" variant="ghost" onPress={() => setOpen(!open)}>
          <Text>{open ? 'Hide reports' : 'Show reports'}</Text>
        </Button>
      </View>

      {open ? (
        reports === null ? (
          <ActivityIndicator size="small" />
        ) : error ? (
          <Text className="text-xs text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : (
          <View className="gap-2">
            {reports.map((report) => (
              <View key={report.id} className="gap-0.5 border-t border-border pt-2">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-sm font-medium text-foreground">
                    {reasonText(report.reason)?.label ?? report.reason}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    by {report.reporterName}, joined {DATE_FORMAT.format(new Date(report.reporterJoinedAt))}
                  </Text>
                  {report.reporterBannedAt ? (
                    <Badge variant="destructive">
                      <Text>Banned</Text>
                    </Badge>
                  ) : null}
                </View>
                {report.note ? (
                  <Text className="text-sm text-foreground">&quot;{report.note}&quot;</Text>
                ) : null}
                <Text className={cn('text-xs text-muted-foreground')}>
                  Has posted {report.reporterReviewCount}{' '}
                  {report.reporterReviewCount === 1 ? 'review' : 'reviews'} and sent{' '}
                  {report.reportsSent} {report.reportsSent === 1 ? 'report' : 'reports'}:{' '}
                  {report.reportsUpheld} upheld, {report.reportsDismissed} dismissed.
                </Text>
              </View>
            ))}
          </View>
        )
      ) : null}
    </View>
  );
}
