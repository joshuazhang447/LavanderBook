import {
  CalendarOff,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  MoreHorizontal,
  VenetianMask,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { TagChip } from '@/components/admin/tag-chip';
import { StarRating } from '@/components/star-rating';
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
import { Text } from '@/components/ui/text';
import {
  listReviewAnswers,
  reviewerLabel,
  type AdminReview,
  type ReviewAnswer,
  type Segment,
} from '@/lib/admin';
import { ANSWER_LABEL, formatStoredAnswer } from '@/lib/answers';
import { STATUS_TEXT, type ModerationStatus } from '@/lib/moderation-text';
import { periodLabel } from '@/lib/review-dates';
import { cn } from '@/lib/utils';

/**
 * One review as the panel shows it, shared by the Reviews section and the
 * queue (src/components/admin/case-card.tsx), so a review reads the same
 * wherever a moderator meets it.
 */

/**
 * What the Reviews section was opened *about*, when it was reached by a link
 * rather than from the nav.
 *
 * One focus, not two: Places links through by venue and Users by author, and
 * neither flow can produce both at once. Stacking them would be a filter nobody
 * can reach and a banner nobody can read.
 */
export type ReviewFocus = {
  kind: 'author' | 'venue';
  id: string;
  /** Carried so the banner can name it without a second round trip. */
  label: string;
};

export const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export const EXACT_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/* -------------------------------------------------------------------------- */

/**
 * Text with the words the list matched marked, so a moderator finds the word
 * at once in two thousand characters. Nested Text, as the panel emphasises
 * inline everywhere else.
 */
export function HighlightedText({
  segments,
  className,
  numberOfLines,
}: {
  segments: Segment[];
  className?: string;
  numberOfLines?: number;
}) {
  return (
    <Text className={cn('text-sm text-foreground', className)} numberOfLines={numberOfLines}>
      {segments.map((segment, index) =>
        segment.hit ? (
          <Text
            key={index}
            className="rounded-sm bg-destructive/15 font-semibold text-destructive">
            {segment.text}
          </Text>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        )
      )}
    </Text>
  );
}

/** "Being checked" or "Not published", in the words the author is shown. */
export function ModerationBadge({ status }: { status: ModerationStatus }) {
  if (status === 'published') return null;
  return (
    <Badge variant={status === 'rejected' ? 'destructive' : 'secondary'}>
      <Text>{STATUS_TEXT[status].label}</Text>
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * One review's tag-question answers, fetched when the row is opened.
 *
 * Its own component so the fetch lives and dies with the expansion - the same
 * arrangement VenueNotes uses in Places - rather than the section holding a
 * cache it then has to invalidate.
 */
export function ReviewAnswers({ reviewId }: { reviewId: string }) {
  const [answers, setAnswers] = React.useState<ReviewAnswer[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;

    listReviewAnswers(reviewId)
      .then((rows) => active && setAnswers(rows))
      .catch((cause: unknown) => {
        if (!active) return;
        setAnswers([]);
        setError(cause instanceof Error ? cause.message : 'Could not load the answers.');
      });

    return () => {
      active = false;
    };
  }, [reviewId]);

  if (answers === null) {
    return (
      <View className="py-2">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (error) {
    return (
      <Text className="text-xs text-destructive" accessibilityRole="alert">
        {error}
      </Text>
    );
  }

  if (answers.length === 0) {
    return (
      <Text className="text-xs text-muted-foreground">
        No custom fields answered. Either this place carries no tags, or none of its questions
        existed when this was written.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {answers.map((answer) => {
        const value = formatStoredAnswer(answer.kind, answer.config, answer);
        return (
          <View key={answer.questionId} className="gap-0.5">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-xs font-medium text-foreground">{answer.prompt}</Text>
              {/* The question has been reworded since. The prompt above is still
                  the one this person was asked, which is the point of archiving
                  rather than editing an answered question. */}
              {answer.archived ? (
                <Text className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  retired wording
                </Text>
              ) : null}
            </View>
            <Text className={cn('text-sm', value === null ? 'text-muted-foreground' : 'text-foreground')}>
              {value ?? 'Answered, but the value could not be read.'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Who actually wrote it, in full.
 *
 * A per-place name hides the account from readers and from nobody here. The
 * uuid is spelled out and copyable because it is the one identifier that
 * survives everything - the Users search, a ban, a support thread.
 */
export function AuthorAccount({ review }: { review: AdminReview }) {
  const [copied, setCopied] = React.useState(false);

  function copy() {
    navigator.clipboard?.writeText(review.authorId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <View className="gap-1">
      <Text className="text-xs text-muted-foreground">
        Posted by account <Text className="text-xs font-medium text-foreground">{review.authorName}</Text>
        {review.alias
          ? `. Readers see ${review.alias} instead, a name used on this review only.`
          : '. Readers see that name too: per-place names have been off since this was posted.'}
      </Text>
      {/* The panel shows the exact time; readers never get it. Said here so a
          moderator quoting a review back knows which date that person saw. */}
      <Text className="text-xs text-muted-foreground">
        {review.hideDate
          ? `Readers see "${periodLabel(review.postedPeriod) ?? 'a rough time'}" instead of the date. Exact times are shown only here.`
          : `Readers see the day it was posted (in UTC), never the time.`}
      </Text>
      <Pressable
        onPress={copy}
        role="button"
        aria-label={`Copy the UUID of ${review.authorName}`}
        className={cn(
          'flex-row items-center gap-1 self-start',
          Platform.select({ web: 'cursor-pointer hover:opacity-80' })
        )}>
        <Text className="font-mono text-xs text-muted-foreground">{review.authorId}</Text>
        <Icon
          as={copied ? Check : Copy}
          className={cn('size-3', copied ? 'text-primary' : 'text-muted-foreground/50')}
        />
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The two lines above a review's words: the rating and the place, then the
 * name readers see, the account behind it and when. Shared by the Reviews list
 * and the queue.
 */
export function ReviewHeadline({ review }: { review: AdminReview }) {
  // Bumped by the trigger itself, so "edited" means the author came back - not
  // that updated_at was touched a millisecond after insert.
  const edited = new Date(review.updatedAt).getTime() - new Date(review.createdAt).getTime() > 1000;

  return (
    <>
      <View className="flex-row flex-wrap items-center gap-2">
        <StarRating value={review.stars} size="sm" />
        <Text className="text-sm font-medium text-foreground">{review.venueName}</Text>
        {review.venueTags.map((tag) => (
          <TagChip key={tag.id} label={tag.label} color={tag.color} textColor={tag.textColor} />
        ))}
        <ModerationBadge status={review.moderation} />
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        {/* The name readers see first, because that is the one a report
            quotes; the account it hides second, because that is the one
            every action here acts on. */}
        {review.alias ? (
          <>
            <View className="flex-row items-center gap-1">
              <Icon as={VenetianMask} className="size-3.5 text-muted-foreground" />
              <Text className="text-xs font-medium text-foreground">{review.alias}</Text>
            </View>
            <Text className="text-xs text-muted-foreground">· account {review.authorName}</Text>
          </>
        ) : (
          <Text className="text-xs text-muted-foreground">{review.authorName}</Text>
        )}
        {review.authorBannedAt ? (
          <Badge variant="destructive">
            <Text>Banned</Text>
          </Badge>
        ) : null}
        {review.authorIsAdmin ? (
          <Badge>
            <Text>Admin</Text>
          </Badge>
        ) : null}
        {/* The crossed-out calendar: readers see only a period for this
            one. The date beside it is the panel's view, not theirs. */}
        <View className="flex-row items-center gap-1">
          {review.hideDate ? (
            <Icon as={CalendarOff} className="size-3.5 text-muted-foreground" />
          ) : null}
          <Text
            className="text-xs text-muted-foreground"
            {...Platform.select({
              web: { title: EXACT_FORMAT.format(new Date(review.createdAt)) },
            })}>
            {DATE_FORMAT.format(new Date(review.createdAt))}
          </Text>
        </View>
        {edited ? (
          <Text
            className="text-xs text-muted-foreground"
            {...Platform.select({
              web: { title: EXACT_FORMAT.format(new Date(review.updatedAt)) },
            })}>
            · edited
          </Text>
        ) : null}
        {/* updated_at cannot tell an admin's edit from the author's own, so
            it is said outright rather than left to look like the latter. */}
        {review.adminEditedAt ? (
          <Text
            className="text-xs text-primary"
            {...Platform.select({
              web: { title: EXACT_FORMAT.format(new Date(review.adminEditedAt)) },
            })}>
            · edited by an admin
          </Text>
        ) : null}
      </View>
    </>
  );
}

/* -------------------------------------------------------------------------- */

type ReviewRowProps = {
  review: AdminReview;
  onEdit: () => void;
  onDelete: () => void;
  onFocus: (focus: ReviewFocus) => void;
  /** Publish a held or rejected review. */
  onPublish?: () => void;
  /** Reject a held review, or take down a published one. */
  onReject?: () => void;
  /** Open the queue, where the review's open item is. */
  onOpenQueue?: () => void;
};

export function ReviewRow({
  review,
  onEdit,
  onDelete,
  onFocus,
  onPublish,
  onReject,
  onOpenQueue,
}: ReviewRowProps) {
  const [expanded, setExpanded] = React.useState(false);

  const hasBody = review.body !== null && review.body.trim() !== '';

  return (
    <View className="border-b border-border px-6 py-3">
      <View className="flex-row items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={`${expanded ? 'Hide' : 'Show'} the full review of ${review.venueName}`}
          aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)}>
          <Icon as={expanded ? ChevronDown : ChevronRight} className="size-4 text-muted-foreground" />
        </Button>

        <View className="flex-1 gap-1">
          <ReviewHeadline review={review} />

          {hasBody ? (
            <Text
              className="text-sm text-foreground"
              // Clamped closed, whole when open: 2000 characters is a legitimate
              // review and also where a wall of abuse would sit.
              numberOfLines={expanded ? undefined : 3}>
              {review.body}
            </Text>
          ) : (
            <Text className="text-sm italic text-muted-foreground">No written review</Text>
          )}

          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs text-muted-foreground">
              Bathroom: {ANSWER_LABEL[review.transBathroom]}
            </Text>
            {review.answerCount > 0 ? (
              <Text className="text-xs text-muted-foreground">
                · {review.answerCount} custom {review.answerCount === 1 ? 'answer' : 'answers'}
              </Text>
            ) : null}
            {review.openCaseId ? (
              <Text className="text-xs text-primary">· in the queue</Text>
            ) : null}
          </View>
        </View>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`Actions for ${reviewerLabel(review)}'s review of ${review.venueName}`}>
              <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {onPublish && review.moderation !== 'published' ? (
              <DropdownMenuItem onPress={onPublish}>
                <Text>Publish</Text>
              </DropdownMenuItem>
            ) : null}
            {onReject && review.moderation !== 'rejected' ? (
              <DropdownMenuItem onPress={onReject}>
                <Text>{review.moderation === 'held' ? 'Reject...' : 'Take down...'}</Text>
              </DropdownMenuItem>
            ) : null}
            {onOpenQueue && review.openCaseId ? (
              <DropdownMenuItem onPress={onOpenQueue}>
                <Text>Open in the queue</Text>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onPress={onEdit}>
              <Text>Edit review</Text>
            </DropdownMenuItem>
            <DropdownMenuItem
              onPress={() =>
                onFocus({ kind: 'venue', id: review.venueId, label: review.venueName })
              }>
              <Text>All reviews of this place</Text>
            </DropdownMenuItem>
            <DropdownMenuItem
              onPress={() =>
                onFocus({ kind: 'author', id: review.authorId, label: review.authorName })
              }>
              <Text>All reviews by this author</Text>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onPress={onDelete}>
              <Text>Delete review</Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </View>

      {expanded ? (
        <View className="ml-9 mt-3 gap-3 border-l border-border pl-4">
          {review.venueAddress ? (
            <Text className="text-xs text-muted-foreground">{review.venueAddress}</Text>
          ) : null}
          <AuthorAccount review={review} />
          <ReviewAnswers reviewId={review.id} />
        </View>
      ) : null}
    </View>
  );
}
