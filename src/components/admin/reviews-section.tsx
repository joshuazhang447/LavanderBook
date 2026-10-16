import { ChevronLeft, ChevronRight, MessageSquareText, Search, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import { FilterSelect, useDebounced } from '@/components/admin/filters';
import { RejectDialog } from '@/components/admin/reject-dialog';
import { ReviewDialog } from '@/components/admin/review-dialog';
import { ReviewRow, type ReviewFocus } from '@/components/admin/review-row';
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
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  decideReview,
  deleteReview,
  listAdminReviews,
  listAdminTags,
  reviewerLabel,
  type AdminReview,
  type AdminTag,
  type ReviewAuthorStatus,
  type ReviewBodyFilter,
  type ReviewModerationFilter,
  type ReviewSort,
} from '@/lib/admin';
import type { Answer } from '@/lib/answers';
import { cn } from '@/lib/utils';

export type { ReviewFocus } from '@/components/admin/review-row';

const PAGE_SIZES = [25, 50, 100];

/**
 * Star filters as one min/max pair.
 *
 * The two bands are the ones moderation actually reaches for: 1-2 is where a
 * place is being reported as hostile, which is the claim worth checking before
 * it drives people away, and 4-5 is where a place is being talked up, which is
 * where an owner writing their own reviews would show.
 */
const STAR_OPTIONS = [
  { value: 'any', label: 'Any rating', min: null, max: null },
  { value: 'low', label: '1-2 · hostile', min: 1, max: 2 },
  { value: 'high', label: '4-5 · welcoming', min: 4, max: 5 },
  { value: '5', label: '5 stars', min: 5, max: 5 },
  { value: '4', label: '4 stars', min: 4, max: 4 },
  { value: '3', label: '3 stars', min: 3, max: 3 },
  { value: '2', label: '2 stars', min: 2, max: 2 },
  { value: '1', label: '1 star', min: 1, max: 1 },
] as const;

const BODY_OPTIONS = [
  { value: 'any', label: 'Any review' },
  { value: 'with', label: 'Has words' },
  // A rating with nothing written is perfectly legitimate - and is also what a
  // run of drive-by ratings looks like, which is why it is worth isolating.
  { value: 'without', label: 'Rating only' },
] as const;

const BATHROOM_OPTIONS = [
  { value: 'any', label: 'Any bathroom' },
  { value: 'yes', label: 'Bathroom: yes' },
  { value: 'no', label: 'Bathroom: no' },
  { value: 'unsure', label: 'Bathroom: not sure' },
] as const;

const AUTHOR_OPTIONS = [
  { value: 'any', label: 'Any author' },
  { value: 'active', label: 'Active authors' },
  // The first question after any ban: what did that account leave behind.
  { value: 'banned', label: 'Banned authors' },
] as const;

const POSTED_OPTIONS = [
  { value: 'any', label: 'Any time', days: null },
  { value: '1', label: 'Last 24 hours', days: 1 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
] as const;

const STATUS_OPTIONS = [
  { value: 'any', label: 'Any status' },
  { value: 'published', label: 'Published' },
  { value: 'held', label: 'Being checked' },
  { value: 'rejected', label: 'Not published' },
] as const;

/** Each option is a (column, direction) pair, so the list needs no header row. */
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first', sort: 'created_at', desc: true },
  { value: 'oldest', label: 'Oldest first', sort: 'created_at', desc: false },
  { value: 'lowest', label: 'Lowest rated', sort: 'stars', desc: false },
  { value: 'highest', label: 'Highest rated', sort: 'stars', desc: true },
  { value: 'edited', label: 'Recently edited', sort: 'updated_at', desc: true },
  { value: 'venue', label: 'Place A-Z', sort: 'venue_name', desc: false },
  { value: 'author', label: 'Author A-Z', sort: 'author_name', desc: false },
] as const satisfies readonly { value: string; label: string; sort: ReviewSort; desc: boolean }[];

const DAY_MS = 24 * 60 * 60 * 1000;

/** The filter state a link-through resets, and its starting values. */
const DEFAULTS = {
  search: '',
  stars: 'any',
  body: 'any' as ReviewBodyFilter,
  bathroom: 'any',
  tag: 'any',
  author: 'any' as ReviewAuthorStatus,
  posted: 'any',
  status: 'any' as ReviewModerationFilter,
};

/* -------------------------------------------------------------------------- */

type ReviewsSectionProps = {
  /** Set when this was reached from a link, null from the nav. */
  focus: ReviewFocus | null;
  /**
   * Bumped on every link-through, including one to the focus already showing.
   *
   * Clicking a second user's posted count while already focused on a user
   * changes `focus` in a way React may or may not notice; this always changes.
   */
  focusNonce: number;
  onFocus: (focus: ReviewFocus) => void;
  onClearFocus: () => void;
  /** Opens the queue, for a review with an open item there. */
  onOpenQueue: () => void;
  /** Called after a publish or reject, so the queue's badge catches up. */
  onModerated: () => void;
  /** Whether this section is the one on screen. See UsersSection. */
  visible: boolean;
};

export function ReviewsSection({
  focus,
  focusNonce,
  onFocus,
  onClearFocus,
  onOpenQueue,
  onModerated,
  visible,
}: ReviewsSectionProps) {
  const [search, setSearch] = React.useState(DEFAULTS.search);
  const [stars, setStars] = React.useState<string>(DEFAULTS.stars);
  const [body, setBody] = React.useState<ReviewBodyFilter>(DEFAULTS.body);
  const [bathroom, setBathroom] = React.useState<string>(DEFAULTS.bathroom);
  const [tag, setTag] = React.useState<string>(DEFAULTS.tag);
  const [author, setAuthor] = React.useState<ReviewAuthorStatus>(DEFAULTS.author);
  const [posted, setPosted] = React.useState<string>(DEFAULTS.posted);
  const [status, setStatus] = React.useState<ReviewModerationFilter>(DEFAULTS.status);
  const [sort, setSort] = React.useState<string>('newest');
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const [page, setPage] = React.useState(0);

  const [rows, setRows] = React.useState<AdminReview[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [tags, setTags] = React.useState<AdminTag[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  // Kept apart from error, which every successful fetch clears: a refused
  // publish must still be on screen after the refetch that follows it.
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AdminReview | null>(null);
  const [confirming, setConfirming] = React.useState<AdminReview | null>(null);
  const [rejecting, setRejecting] = React.useState<AdminReview | null>(null);
  /** Bumped to force a refetch after an action leaves the page possibly stale. */
  const [reloads, setReloads] = React.useState(0);

  /**
   * Arriving by a link is a fresh question, so it clears the filters.
   *
   * Without this you click "10 posted" and get an empty list, because a rating
   * filter you set ten minutes ago is still on and the banner says nothing
   * about it. Coming in from the NAV is the opposite case and keeps them: there
   * you are returning to work you had set up.
   *
   * Done during render rather than in an effect on purpose. An effect would let
   * one fetch go out against the old filters before the reset landed - harmless,
   * because the `active` flag drops it, but a wasted round trip on every click.
   */
  const [appliedNonce, setAppliedNonce] = React.useState(focusNonce);
  if (appliedNonce !== focusNonce) {
    setAppliedNonce(focusNonce);
    setSearch(DEFAULTS.search);
    setStars(DEFAULTS.stars);
    setBody(DEFAULTS.body);
    setBathroom(DEFAULTS.bathroom);
    setTag(DEFAULTS.tag);
    setAuthor(DEFAULTS.author);
    setPosted(DEFAULTS.posted);
    setStatus(DEFAULTS.status);
    setPage(0);
  }

  const settledSearch = useDebounced(search, 300);

  // The tag filter's options. Refetched on becoming visible because a tag made
  // over in Tags has to show up here, and nothing else would have said so.
  React.useEffect(() => {
    if (!visible) return;
    let active = true;

    listAdminTags(false)
      .then((rows) => active && setTags(rows))
      // A tag list that will not load is not worth an error banner over the
      // reviews themselves; the filter simply offers nothing but "Any tag".
      .catch(() => active && setTags([]));

    return () => {
      active = false;
    };
  }, [visible]);

  React.useEffect(() => {
    if (!visible) return;
    let active = true;

    const bounds = STAR_OPTIONS.find((option) => option.value === stars) ?? STAR_OPTIONS[0];
    const since = POSTED_OPTIONS.find((option) => option.value === posted) ?? POSTED_OPTIONS[0];
    const order = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

    listAdminReviews({
      search: settledSearch,
      venueId: focus?.kind === 'venue' ? focus.id : null,
      authorId: focus?.kind === 'author' ? focus.id : null,
      minStars: bounds.min,
      maxStars: bounds.max,
      body,
      bathroom: bathroom === 'any' ? null : (bathroom as Answer),
      tagId: tag === 'any' ? null : tag,
      authorStatus: author,
      postedAfter:
        since.days === null ? null : new Date(Date.now() - since.days * DAY_MS).toISOString(),
      moderation: status,
      sort: order.sort,
      descending: order.desc,
      limit: pageSize,
      offset: page * pageSize,
    })
      .then((result) => {
        if (!active) return;
        // The total rides on the rows themselves, so a page past the end of the
        // set reports zero rather than the real count - which is what deleting
        // the last review on the last page leaves behind. Step back and ask
        // again rather than show a convincing "0-0 of 0".
        if (result.rows.length === 0 && page > 0) {
          setPage(0);
          return;
        }
        setRows(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setRows([]);
        setTotal(0);
        setError(cause instanceof Error ? cause.message : 'Could not load reviews.');
      });

    // Dropping a late reply from a superseded query: a slow response to "qui"
    // must not land after the fast one to "quiet".
    return () => {
      active = false;
    };
  }, [
    settledSearch,
    focus?.kind,
    focus?.id,
    stars,
    body,
    bathroom,
    tag,
    author,
    posted,
    status,
    sort,
    pageSize,
    page,
    reloads,
    visible,
  ]);

  /** Any change to what is being asked for starts again from the first page. */
  function refine(change: () => void) {
    change();
    setPage(0);
  }

  function refetch() {
    setReloads((count) => count + 1);
  }

  async function remove(review: AdminReview) {
    setActionError(null);
    try {
      await deleteReview(review.id);
    } catch (cause: unknown) {
      // Includes "no such review", which is what a second admin deleting the
      // same row looks like. Either way the page is stale, so it refetches.
      setActionError(cause instanceof Error ? cause.message : 'That review could not be deleted.');
    }
    refetch();
    onModerated();
  }

  async function publish(review: AdminReview) {
    setActionError(null);
    try {
      await decideReview(review.id, 'publish', {
        seenStatus: review.moderation,
        seenUpdatedAt: review.updatedAt,
      });
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : 'That review could not be published.');
    }
    refetch();
    onModerated();
  }

  const tagOptions = React.useMemo(
    () => [
      { value: 'any', label: 'Any tag' },
      ...tags.map((option) => ({ value: option.id, label: option.label })),
    ],
    [tags]
  );

  const filtered =
    settledSearch.trim() !== '' ||
    stars !== DEFAULTS.stars ||
    body !== DEFAULTS.body ||
    bathroom !== DEFAULTS.bathroom ||
    tag !== DEFAULTS.tag ||
    author !== DEFAULTS.author ||
    posted !== DEFAULTS.posted ||
    status !== DEFAULTS.status;

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <View className="flex-1">
      <View className="gap-4 border-b border-border px-6 py-5">
        <View className="gap-1">
          <Text className="text-2xl font-bold text-foreground">Reviews</Text>
          <Text className="text-sm text-muted-foreground">
            Every review posted to LavenderBook, published or not. Editing one is recorded on it. A
            mask marks a per-place name, shown to readers instead of the account name. A
            crossed-out calendar marks a date readers can&apos;t see; they get a rough period
            instead.
          </Text>
        </View>

        {/* Named and dismissible, so a filtered list can never be mistaken for
            the whole set - which is the one way a moderator could conclude
            "there are only two reviews" and be wrong. */}
        {focus ? (
          <View className="flex-row items-center gap-2 self-start rounded-md border border-border bg-muted px-3 py-1.5">
            <Text className="text-sm text-foreground">
              {focus.kind === 'venue' ? 'Reviews of ' : 'Reviews by '}
              <Text className="font-medium">{focus.label}</Text>
            </Text>
            <Pressable
              onPress={onClearFocus}
              role="button"
              aria-label="Show every review instead"
              className={cn('rounded-sm', Platform.select({ web: 'cursor-pointer hover:opacity-70' }))}>
              <Icon as={X} className="size-4 text-muted-foreground" />
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row flex-wrap items-center gap-3">
          <View className="min-w-[240px] flex-1 flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
            <Icon as={Search} className="size-4 text-muted-foreground" />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search the words, a place, an author or per-place name, or paste a UUID"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
            />
          </View>

          <FilterSelect
            label="Sort"
            width="w-[170px]"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(next) => refine(() => setSort(next))}
          />
        </View>

        <View className="flex-row flex-wrap items-center gap-3">
          <FilterSelect
            label="Status"
            width="w-[160px]"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(next) => refine(() => setStatus(next as ReviewModerationFilter))}
          />
          <FilterSelect
            label="Rating"
            width="w-[170px]"
            value={stars}
            options={STAR_OPTIONS}
            onChange={(next) => refine(() => setStars(next))}
          />
          <FilterSelect
            label="Written"
            width="w-[150px]"
            value={body}
            options={BODY_OPTIONS}
            onChange={(next) => refine(() => setBody(next as ReviewBodyFilter))}
          />
          <FilterSelect
            label="Bathroom"
            width="w-[180px]"
            value={bathroom}
            options={BATHROOM_OPTIONS}
            onChange={(next) => refine(() => setBathroom(next))}
          />
          <FilterSelect
            label="Tag"
            width="w-[150px]"
            value={tag}
            options={tagOptions}
            onChange={(next) => refine(() => setTag(next))}
          />
          <FilterSelect
            label="Author"
            width="w-[160px]"
            value={author}
            options={AUTHOR_OPTIONS}
            onChange={(next) => refine(() => setAuthor(next as ReviewAuthorStatus))}
          />
          <FilterSelect
            label="Posted"
            width="w-[160px]"
            value={posted}
            options={POSTED_OPTIONS}
            onChange={(next) => refine(() => setPosted(next))}
          />
        </View>

        {error ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {error}
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
          <Icon as={MessageSquareText} className="size-8 text-muted-foreground" />
          <Text className="text-center text-sm text-muted-foreground">
            {filtered || focus
              ? 'No reviews match these filters.'
              : 'Nobody has posted a review yet.'}
          </Text>
          {focus ? (
            <Button variant="outline" size="sm" onPress={onClearFocus}>
              <Text>Show every review</Text>
            </Button>
          ) : null}
        </View>
      ) : (
        <ScrollView className="flex-1">
          {rows.map((review) => (
            <ReviewRow
              key={review.id}
              review={review}
              onEdit={() => setEditing(review)}
              onDelete={() => setConfirming(review)}
              onFocus={onFocus}
              onPublish={() => void publish(review)}
              onReject={() => setRejecting(review)}
              onOpenQueue={onOpenQueue}
            />
          ))}
        </ScrollView>
      )}

      {editing ? (
        <ReviewDialog review={editing} onClose={() => setEditing(null)} onSaved={refetch} />
      ) : null}

      {rejecting ? (
        <RejectDialog
          title={rejecting.moderation === 'held' ? 'Reject this review?' : 'Take this review down?'}
          description={
            rejecting.moderation === 'held'
              ? 'It stays unpublished. Its author sees the reason and your note, and editing it sends it back to the queue.'
              : 'Readers stop seeing it. Its author sees the reason and your note, and editing it sends it back to the queue.'
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
            onModerated();
          }}
        />
      ) : null}

      <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming
                ? `${reviewerLabel(confirming)}'s review of ${confirming.venueName} will be removed for good${
                    confirming.answerCount === 0
                      ? ''
                      : confirming.answerCount === 1
                        ? ', along with its one custom-field answer'
                        : `, along with its ${confirming.answerCount} custom-field answers`
                  }. The place's rating is recalculated without it, and this cannot be undone. To take it off the map but keep it, its author told why, use Take down instead.`
                : null}
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
                if (target) void remove(target);
              }}>
              <Text className="text-white">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <View className="flex-row items-center justify-end gap-6 border-t border-border px-6 py-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-muted-foreground">Rows per page</Text>
          <FilterSelect
            label="Rows per page"
            width="w-[90px]"
            value={String(pageSize)}
            options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
            onChange={(next) => refine(() => setPageSize(Number(next)))}
          />
        </View>

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
