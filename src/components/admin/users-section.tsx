import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  MoreHorizontal,
  Search,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

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
import { FilterSelect, useDebounced } from '@/components/admin/filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  listAdminUsers,
  setUserAdmin,
  setUserBanned,
  type AdminUser,
  type AdminUserSort,
  type AdminUserStatus,
} from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const PAGE_SIZES = [50, 100, 200];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
  // Not a third value of the same thing - an admin is also active or banned -
  // but it is the one list you want to be able to call up on its own, because
  // "who can get in here" is a question worth being able to answer in one look.
  { value: 'admin', label: 'Administrators' },
] as const;

/**
 * Review-count filters. `null` is an open bound, so "None" is an upper bound of
 * zero rather than a lower bound of zero, which would match everyone.
 *
 * These two ends are what moderation actually looks at: accounts posting nothing
 * are the throwaways and the sign-up spam, and the accounts posting a great deal
 * are the ones whose influence on a rating is worth checking.
 */
const POSTED_OPTIONS = [
  { value: 'any', label: 'Any amount', min: null, max: null },
  { value: 'none', label: 'None', min: null, max: 0 },
  { value: '1', label: '1 or more', min: 1, max: null },
  { value: '5', label: '5 or more', min: 5, max: null },
  { value: '10', label: '10 or more', min: 10, max: null },
] as const;

/** Newly created accounts are where abuse concentrates, so this is a filter. */
const JOINED_OPTIONS = [
  { value: 'any', label: 'Any time', days: null },
  { value: '1', label: 'Last 24 hours', days: 1 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const JOINED_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

type HeaderCellProps = {
  label: string;
  className?: string;
  column?: AdminUserSort;
  sort: AdminUserSort;
  descending: boolean;
  onSort: (column: AdminUserSort) => void;
};

function HeaderCell({ label, className, column, sort, descending, onSort }: HeaderCellProps) {
  const text = <Text className="text-xs font-medium text-muted-foreground">{label}</Text>;

  if (!column) return <View className={className}>{text}</View>;

  const active = sort === column;

  return (
    <Pressable
      onPress={() => onSort(column)}
      role="columnheader"
      // Web reads this off the DOM attribute; it is what tells a screen reader
      // the column is sorted and which way.
      aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}
      className={cn(
        'flex-row items-center gap-1 rounded-md py-1',
        Platform.select({ web: 'cursor-pointer hover:opacity-80' }),
        className
      )}>
      {text}
      <Icon
        as={active ? (descending ? ArrowDown : ArrowUp) : ChevronsUpDown}
        className={cn('size-3', active ? 'text-foreground' : 'text-muted-foreground/50')}
      />
    </Pressable>
  );
}

type UsersSectionProps = {
  onShowReviews: (user: AdminUser) => void;
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

export function UsersSection({ onShowReviews, visible }: UsersSectionProps) {
  const { session } = useAuth();
  const selfId = session?.user.id ?? null;

  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<AdminUserStatus>('all');
  const [posted, setPosted] = React.useState<string>('any');
  const [joined, setJoined] = React.useState<string>('any');
  const [sort, setSort] = React.useState<AdminUserSort>('created_at');
  const [descending, setDescending] = React.useState(true);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const [page, setPage] = React.useState(0);

  const [rows, setRows] = React.useState<AdminUser[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());
  const [copied, setCopied] = React.useState<string | null>(null);
  /**
   * The account whose admin access is being changed, and which way.
   *
   * Every other action here applies the moment you choose it. This one asks
   * first: banning is reversible by the same person in the same screen, whereas
   * handing someone admin hands them everything in it, including the ability to
   * do this.
   */
  const [promoting, setPromoting] = React.useState<{ user: AdminUser; next: boolean } | null>(null);
  /** Bumped to force a refetch after an action leaves the page possibly stale. */
  const [reloads, setReloads] = React.useState(0);

  const settledSearch = useDebounced(search, 300);

  React.useEffect(() => {
    if (!visible) return;
    let active = true;

    const since = JOINED_OPTIONS.find((option) => option.value === joined) ?? JOINED_OPTIONS[0];
    const bounds = POSTED_OPTIONS.find((option) => option.value === posted) ?? POSTED_OPTIONS[0];

    listAdminUsers({
      search: settledSearch,
      status,
      minReviews: bounds.min,
      maxReviews: bounds.max,
      joinedAfter:
        since.days === null ? null : new Date(Date.now() - since.days * DAY_MS).toISOString(),
      sort,
      descending,
      limit: pageSize,
      offset: page * pageSize,
    })
      .then((result) => {
        if (!active) return;
        // The total rides on the rows themselves, so a page past the end of the
        // set reports zero rather than the real count. That happens when the set
        // shrinks under an open page; step back and ask again rather than show a
        // convincing "0-0 of 0".
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
        setError(cause instanceof Error ? cause.message : 'Could not load accounts.');
      });

    // Dropping a late reply from a superseded query. Without this, a slow
    // response to "qui" can land after the fast one to "quiet" and put the
    // wrong rows under a search box that says something else.
    return () => {
      active = false;
    };
  }, [settledSearch, status, posted, joined, sort, descending, pageSize, page, reloads, visible]);

  /** Any change to what is being asked for starts again from the first page. */
  function refine(change: () => void) {
    change();
    setPage(0);
    setSelected(new Set());
  }

  function toggleSort(column: AdminUserSort) {
    refine(() => {
      if (sort === column) {
        setDescending(!descending);
        return;
      }
      setSort(column);
      // Names read best A-Z; dates and counts are almost always wanted biggest
      // first, which is where the interesting accounts are.
      setDescending(column !== 'display_name');
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const pageIds = rows?.map((row) => row.id) ?? [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pageIds));
  }

  /**
   * Applies straight away - there is no Apply button by design.
   *
   * The rows move first and the request follows, because a moderation decision
   * that takes a round trip to show up reads as a click that did not register.
   * A refusal refetches rather than rolling back a guess: with several ids in
   * flight some may have succeeded, and the only honest thing then is to go and
   * ask.
   */
  async function applyBan(ids: string[], banned: boolean) {
    if (ids.length === 0) return;

    setError(null);
    const optimistic = banned ? new Date().toISOString() : null;
    setRows(
      (current) =>
        current?.map((row) => (ids.includes(row.id) ? { ...row, bannedAt: optimistic } : row)) ??
        current
    );

    try {
      const settled = await Promise.all(ids.map((id) => setUserBanned(id, banned)));
      setRows(
        (current) =>
          current?.map((row) => {
            const index = ids.indexOf(row.id);
            return index === -1 ? row : { ...row, bannedAt: settled[index] };
          }) ?? current
      );
      setSelected(new Set());
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'That change was refused.');
      setReloads((count) => count + 1);
    }
  }

  /**
   * Grant or revoke admin access for one account.
   *
   * Unlike applyBan there is no optimistic row, because the dialog in front of
   * this already covers the wait and a promotion that appears to have happened
   * and then has not is a worse thing to show than a short pause. The row is set
   * from what the server says the membership is, not from what was asked.
   */
  async function applyAdmin(user: AdminUser, next: boolean) {
    setError(null);

    try {
      const settled = await setUserAdmin(user.id, next);
      setRows(
        (current) =>
          current?.map((row) => (row.id === user.id ? { ...row, isAdmin: settled } : row)) ?? current
      );
      // Filtering by Administrators and then revoking one leaves a row that no
      // longer matches the filter it arrived under.
      if (status === 'admin' && !settled) setReloads((count) => count + 1);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'That change was refused.');
      setReloads((count) => count + 1);
    }
  }

  function copyId(id: string) {
    navigator.clipboard?.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied((current) => (current === id ? null : current)), 1200);
  }

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <View className="flex-1">
      <View className="gap-4 border-b border-border px-6 py-5">
        <View className="gap-1">
          <Text className="text-2xl font-bold text-foreground">Users</Text>
          <Text className="text-sm text-muted-foreground">
            Every account with a profile. Actions apply the moment you choose them.
          </Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-3">
          <View className="min-w-[240px] flex-1 flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
            <Icon as={Search} className="size-4 text-muted-foreground" />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search a display name, or paste a UUID"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
            />
          </View>

          <FilterSelect
            label="Status"
            width="w-[150px]"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(next) => refine(() => setStatus(next as AdminUserStatus))}
          />
          <FilterSelect
            label="Posted"
            width="w-[150px]"
            value={posted}
            options={POSTED_OPTIONS}
            onChange={(next) => refine(() => setPosted(next))}
          />
          <FilterSelect
            label="Joined"
            width="w-[160px]"
            value={joined}
            options={JOINED_OPTIONS}
            onChange={(next) => refine(() => setJoined(next))}
          />
        </View>

        {error ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        {selected.size > 0 ? (
          <View className="flex-row items-center gap-3 rounded-md border border-border bg-muted px-3 py-2">
            <Text className="text-sm text-foreground">
              {selected.size} selected
            </Text>
            <Button size="sm" variant="destructive" onPress={() => applyBan([...selected], true)}>
              <Text>Ban</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => applyBan([...selected], false)}>
              <Text>Unban</Text>
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setSelected(new Set())}>
              <Text>Clear</Text>
            </Button>
          </View>
        ) : null}
      </View>

      <View className="flex-row items-center gap-3 border-b border-border bg-muted/40 px-6 py-2">
        <View className="w-8">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
            aria-label="Select every account on this page"
          />
        </View>
        <HeaderCell
          label="UUID"
          className="w-[110px]"
          column="id"
          sort={sort}
          descending={descending}
          onSort={toggleSort}
        />
        <HeaderCell
          label="Display name"
          className="min-w-[140px] flex-1"
          column="display_name"
          sort={sort}
          descending={descending}
          onSort={toggleSort}
        />
        <HeaderCell
          label="Joined"
          className="w-[110px]"
          column="created_at"
          sort={sort}
          descending={descending}
          onSort={toggleSort}
        />
        <HeaderCell
          label="Posted"
          className="w-[70px]"
          column="review_count"
          sort={sort}
          descending={descending}
          onSort={toggleSort}
        />
        <HeaderCell
          label="Status"
          className="w-[160px]"
          sort={sort}
          descending={descending}
          onSort={toggleSort}
        />
        <View className="w-10" />
      </View>

      {rows === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm text-muted-foreground">No accounts match these filters.</Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {rows.map((row) => (
            <View
              key={row.id}
              className={cn(
                'flex-row items-center gap-3 border-b border-border px-6 py-2',
                selected.has(row.id) && 'bg-accent/40'
              )}>
              <View className="w-8">
                <Checkbox
                  checked={selected.has(row.id)}
                  onCheckedChange={() => toggleOne(row.id)}
                  aria-label={`Select ${row.displayName}`}
                />
              </View>

              {/* Siblings, never nested: react-native-web renders each Pressable
                  as a <button>, and a button inside a button breaks hydration. */}
              <Pressable
                onPress={() => copyId(row.id)}
                role="button"
                aria-label={`Copy the UUID of ${row.displayName}`}
                className={cn(
                  'w-[110px] flex-row items-center gap-1',
                  Platform.select({ web: 'cursor-pointer hover:opacity-80' })
                )}>
                <Text
                  className="font-mono text-xs text-muted-foreground"
                  // The full value on hover, because eight characters is enough
                  // to recognise a row and never enough to act on one.
                  {...Platform.select({ web: { title: row.id } })}>
                  {row.id.slice(0, 8)}
                </Text>
                <Icon
                  as={copied === row.id ? Check : Copy}
                  className={cn(
                    'size-3',
                    copied === row.id ? 'text-primary' : 'text-muted-foreground/50'
                  )}
                />
              </Pressable>

              {/* Blue and a little heavier, so admins are findable by running
                  an eye down the names rather than by reading every Status
                  cell. The badge stays: colour alone is not a label, and a
                  display name is the one column somebody might be colourblind
                  to and still need to act on. */}
              <Text
                className={cn(
                  'min-w-[140px] flex-1 text-sm',
                  row.isAdmin ? 'font-medium text-admin' : 'text-foreground'
                )}
                numberOfLines={1}>
                {row.displayName}
              </Text>

              <Text className="w-[110px] text-sm text-muted-foreground">
                {JOINED_FORMAT.format(new Date(row.createdAt))}
              </Text>

              {/* Not a link at zero. It looked like one before, and landing on
                  an empty Reviews tab is a worse answer than the count itself
                  already gave you. */}
              {row.reviewCount > 0 ? (
                <Pressable
                  onPress={() => onShowReviews(row)}
                  role="link"
                  aria-label={`Show the ${row.reviewCount} reviews by ${row.displayName}`}
                  className={cn('w-[70px]', Platform.select({ web: 'cursor-pointer' }))}>
                  <Text
                    className={cn(
                      'text-sm text-primary',
                      Platform.select({ web: 'hover:underline' })
                    )}>
                    {row.reviewCount}
                  </Text>
                </Pressable>
              ) : (
                <Text className="w-[70px] text-sm text-muted-foreground">0</Text>
              )}

              <View className="w-[160px] flex-row flex-wrap items-center gap-1">
                {row.bannedAt ? (
                  // A status column should read as a status, so the date it
                  // happened is on hover rather than crowding the badge.
                  <Badge
                    variant="destructive"
                    {...Platform.select({
                      web: { title: `Banned ${JOINED_FORMAT.format(new Date(row.bannedAt))}` },
                    })}>
                    <Text>Banned</Text>
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Text>Active</Text>
                  </Badge>
                )}
                {/* Alongside rather than instead of: admin is orthogonal to
                    active/banned, and an admin who has been banned is exactly
                    the row you would least want to read as only one of the two. */}
                {row.isAdmin ? (
                  <Badge>
                    <Text>Admin</Text>
                  </Badge>
                ) : null}
              </View>

              <View className="w-10 items-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Actions for ${row.displayName}`}>
                      <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  {/* A menu rather than a button because this is where the rest
                      of the moderation actions will land. */}
                  <DropdownMenuContent align="end" className="w-52">
                    {row.bannedAt ? (
                      <DropdownMenuItem onPress={() => applyBan([row.id], false)}>
                        <Text>Unban</Text>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        variant="destructive"
                        onPress={() => applyBan([row.id], true)}>
                        <Text>Ban</Text>
                      </DropdownMenuItem>
                    )}

                    {/* Your own row offers neither: the server refuses to strip
                        your access, and granting what you already hold is a menu
                        item that can only disappoint. */}
                    {row.id === selfId ? null : row.isAdmin ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onPress={() => setPromoting({ user: row, next: false })}>
                        <Text>Revoke admin access</Text>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onPress={() => setPromoting({ user: row, next: true })}>
                        <Text>Grant admin access</Text>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <AlertDialog open={promoting !== null} onOpenChange={(next) => !next && setPromoting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {promoting?.next ? 'Grant admin access?' : 'Revoke admin access?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {promoting?.next
                ? `${promoting.user.displayName} will be able to open this panel and do everything you can do here — including banning accounts, deleting places, and granting this same access to somebody else.`
                : `${promoting?.user.displayName} will lose the admin panel the next time they ask for anything. Their account, their profile and their reviews are untouched.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(promoting?.next ? undefined : 'bg-destructive')}
              onPress={() => {
                const target = promoting;
                setPromoting(null);
                if (target) void applyAdmin(target.user, target.next);
              }}>
              <Text className={cn(promoting?.next ? undefined : 'text-white')}>
                {promoting?.next ? 'Grant access' : 'Revoke'}
              </Text>
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
            onPress={() => {
              setPage(page - 1);
              setSelected(new Set());
            }}>
            <Icon as={ChevronLeft} className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next page"
            disabled={page >= lastPage}
            onPress={() => {
              setPage(page + 1);
              setSelected(new Set());
            }}>
            <Icon as={ChevronRight} className="size-4" />
          </Button>
        </View>
      </View>
    </View>
  );
}
