import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { PlaceDialog } from '@/components/admin/place-dialog';
import { TagChip } from '@/components/admin/tag-chip';
import { VenueNotes } from '@/components/admin/venue-notes';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import {
  deleteVenue,
  listAdminTags,
  listAdminVenues,
  setVenueTags,
  type AdminTag,
  type AdminVenue,
  type VenueHas,
  type VenueSort,
  type VenueTagState,
  type VenueVisibility,
} from '@/lib/admin';
import { cn } from '@/lib/utils';

const PAGE_SIZES = [25, 50, 100];

const NOTES_OPTIONS = [
  { value: 'any', label: 'Any notes' },
  { value: 'with', label: 'Has notes' },
  { value: 'without', label: 'No notes' },
] as const;

const REVIEW_OPTIONS = [
  { value: 'any', label: 'Any reviews' },
  { value: 'with', label: 'Reviewed' },
  { value: 'without', label: 'Not reviewed' },
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'any', label: 'Anywhere' },
  { value: 'on', label: 'On the map' },
  { value: 'off', label: 'Not on the map' },
] as const;

/** Waits for typing to stop, so a search is one request rather than one per key. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function summarise(venue: AdminVenue): string {
  const parts = [
    venue.reviewCount === 1 ? '1 review' : `${venue.reviewCount} reviews`,
    venue.avgStars === null ? null : `${venue.avgStars.toFixed(1)} stars`,
    venue.noteCount === 1 ? '1 note' : `${venue.noteCount} notes`,
  ];
  return parts.filter(Boolean).join(' · ');
}

type TagsDialogProps = {
  venue: AdminVenue;
  allTags: AdminTag[];
  onClose: () => void;
  onSaved: () => void;
};

function VenueTagsDialog({ venue, allTags, onClose, onSaved }: TagsDialogProps) {
  const [tagIds, setTagIds] = React.useState<string[]>(venue.tags.map((t) => t.id));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Removing the last tag from a place nobody has reviewed takes it off the map
  // entirely, and nothing else in the UI would say so.
  const willVanish = tagIds.length === 0 && venue.reviewCount === 0;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await setVenueTags(venue.id, tagIds);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Those tags could not be saved.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Tags for {venue.name}</DialogTitle>
          <DialogDescription>
            A place is asked the fields of every tag it carries.
          </DialogDescription>
        </DialogHeader>

        <ScrollView className="max-h-[45vh]" contentContainerClassName="gap-2 px-0.5">
          {allTags
            .filter((tag) => tag.archivedAt === null)
            .map((tag) => {
              const on = tagIds.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  onPress={() =>
                    setTagIds(on ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id])
                  }
                  className="flex-row items-center gap-2 rounded-md p-1.5 active:bg-accent">
                  {/* Non-interactive: the row is the button. See field-dialog.tsx. */}
                  <View pointerEvents="none">
                    <Checkbox checked={on} onCheckedChange={() => {}} />
                  </View>
                  <TagChip label={tag.label} color={tag.color} textColor={tag.textColor} />
                </Pressable>
              );
            })}

          {willVanish ? (
            <View className="flex-row items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
              <Icon as={EyeOff} className="mt-0.5 size-4 text-muted-foreground" />
              <Text className="flex-1 text-xs text-muted-foreground">
                Nobody has reviewed this place, so removing its last tag takes it off the map.
                Its notes are kept.
              </Text>
            </View>
          ) : null}

          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        </ScrollView>

        <DialogFooter>
          <Button variant="outline" onPress={onClose} disabled={busy}>
            <Text>Cancel</Text>
          </Button>
          <Button onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator size="small" /> : <Text>Save tags</Text>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type VenueRowProps = {
  venue: AdminVenue;
  onEditTags: () => void;
  onDelete: () => void;
  onChanged: () => void;
};

function VenueRow({ venue, onEditTags, onDelete, onChanged }: VenueRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const noCoords = venue.lat === null || venue.lng === null;

  return (
    <View className="border-b border-border px-6 py-3">
      <View className="flex-row items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={`${expanded ? 'Hide' : 'Show'} the notes on ${venue.name}`}
          aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)}>
          <Icon
            as={expanded ? ChevronDown : ChevronRight}
            className="size-4 text-muted-foreground"
          />
        </Button>

        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-sm font-medium text-foreground">{venue.name}</Text>
            {venue.tags.map((tag) => (
              <TagChip key={tag.id} label={tag.label} color={tag.color} textColor={tag.textColor} />
            ))}
          </View>
          {venue.address ? (
            <Text className="text-xs text-muted-foreground">{venue.address}</Text>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs text-muted-foreground">{summarise(venue)}</Text>
            {!venue.onMap ? (
              <View className="flex-row items-center gap-1">
                <Icon as={EyeOff} className="size-3 text-destructive" />
                <Text className="text-xs text-destructive">
                  {noCoords ? 'no coordinates — cannot be mapped' : 'not on the map'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center gap-1">
          <Button variant="outline" size="sm" onPress={onEditTags}>
            <Text>Tags</Text>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`More for ${venue.name}`}>
                <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {/* Disabled with the reason on it: deleting a reviewed place would
                  cascade its reviews away, and that should never be a surprise. */}
              <DropdownMenuItem
                variant="destructive"
                disabled={venue.reviewCount > 0}
                onPress={onDelete}>
                <Text>
                  {venue.reviewCount > 0
                    ? `${venue.reviewCount} review${venue.reviewCount === 1 ? '' : 's'} would be lost`
                    : 'Delete'}
                </Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </View>
      </View>

      {expanded ? (
        <View className="ml-8 mt-3">
          <VenueNotes venueId={venue.id} onChanged={onChanged} />
        </View>
      ) : null}
    </View>
  );
}

type PlacesSectionProps = {
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

export function PlacesSection({ visible }: PlacesSectionProps) {
  const [search, setSearch] = React.useState('');
  const settledSearch = useDebounced(search, 300);
  const [tagFilter, setTagFilter] = React.useState<string>('any');
  const [notes, setNotes] = React.useState<VenueHas>('any');
  const [reviews, setReviews] = React.useState<VenueHas>('any');
  const [visibility, setVisibility] = React.useState<VenueVisibility>('any');
  const [sort, setSort] = React.useState<VenueSort>('created_at');
  const [descending] = React.useState(true);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const [page, setPage] = React.useState(0);

  const [venues, setVenues] = React.useState<AdminVenue[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [tags, setTags] = React.useState<AdminTag[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [editingTags, setEditingTags] = React.useState<AdminVenue | null>(null);
  const [confirming, setConfirming] = React.useState<AdminVenue | null>(null);
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    if (!visible) return;
    let active = true;

    // 'any' and 'untagged' are states rather than a specific tag, so only a real
    // uuid goes to p_tag_id.
    const tagState: VenueTagState =
      tagFilter === 'untagged' ? 'untagged' : tagFilter === 'any' ? 'any' : 'tagged';
    const tagId = tagFilter === 'any' || tagFilter === 'untagged' ? null : tagFilter;

    Promise.all([
      listAdminVenues({
        search: settledSearch,
        tagId,
        tagState,
        notes,
        reviews,
        visibility,
        sort,
        descending,
        limit: pageSize,
        offset: page * pageSize,
      }),
      listAdminTags(),
    ])
      .then(([result, tagRows]) => {
        if (!active) return;
        setTags(tagRows);
        // The total rides on the rows, so a page past the end reports zero
        // rather than the real count. Step back and ask again.
        if (result.rows.length === 0 && page > 0) {
          setPage(0);
          return;
        }
        setVenues(result.rows);
        setTotal(result.total);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setVenues([]);
        setTotal(0);
        setError(cause instanceof Error ? cause.message : 'Could not load places.');
      });

    return () => {
      active = false;
    };
  }, [
    settledSearch,
    tagFilter,
    notes,
    reviews,
    visibility,
    sort,
    descending,
    pageSize,
    page,
    reloads,
    visible,
  ]);

  const refetch = React.useCallback(() => setReloads((n) => n + 1), []);

  /** Any change to what is being asked for starts again from the first page. */
  function refine(change: () => void) {
    change();
    setPage(0);
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
    }
    refetch();
  }

  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  const tagOptions = [
    { value: 'any', label: 'Any tag' },
    { value: 'untagged', label: 'Untagged' },
    ...tags.filter((t) => t.archivedAt === null).map((t) => ({ value: t.id, label: t.label })),
  ];

  return (
    <View className="flex-1">
      <View className="gap-4 border-b border-border px-6 py-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-2xl font-bold text-foreground">Places</Text>
            <Text className="text-sm text-muted-foreground">
              Everywhere LavenderBook knows about. Tagging a place puts it on the map before
              anyone has reviewed it.
            </Text>
          </View>
          <Button onPress={() => setAdding(true)}>
            <Icon as={Plus} className="size-4 text-primary-foreground" />
            <Text>Add a place</Text>
          </Button>
        </View>

        <View className="flex-row flex-wrap items-center gap-3">
          <View className="min-w-[220px] flex-1 flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
            <Icon as={Search} className="size-4 text-muted-foreground" />
            <Input
              value={search}
              onChangeText={(next) => refine(() => setSearch(next))}
              placeholder="Search a name or address"
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
            />
          </View>

          <Select
            value={tagOptions.find((o) => o.value === tagFilter)}
            onValueChange={(option) => option && refine(() => setTagFilter(option.value))}>
            <SelectTrigger className="w-[150px]" aria-label="Tag">
              <SelectValue placeholder="Any tag" />
            </SelectTrigger>
            <SelectContent className="w-[150px]">
              {tagOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} label={option.label} />
              ))}
            </SelectContent>
          </Select>

          <Select
            value={NOTES_OPTIONS.find((o) => o.value === notes)}
            onValueChange={(option) => option && refine(() => setNotes(option.value as VenueHas))}>
            <SelectTrigger className="w-[140px]" aria-label="Notes">
              <SelectValue placeholder="Any notes" />
            </SelectTrigger>
            <SelectContent className="w-[140px]">
              {NOTES_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} label={option.label} />
              ))}
            </SelectContent>
          </Select>

          <Select
            value={REVIEW_OPTIONS.find((o) => o.value === reviews)}
            onValueChange={(option) => option && refine(() => setReviews(option.value as VenueHas))}>
            <SelectTrigger className="w-[150px]" aria-label="Reviews">
              <SelectValue placeholder="Any reviews" />
            </SelectTrigger>
            <SelectContent className="w-[150px]">
              {REVIEW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} label={option.label} />
              ))}
            </SelectContent>
          </Select>

          <Select
            value={VISIBILITY_OPTIONS.find((o) => o.value === visibility)}
            onValueChange={(option) =>
              option && refine(() => setVisibility(option.value as VenueVisibility))
            }>
            <SelectTrigger className="w-[160px]" aria-label="On the map">
              <SelectValue placeholder="Anywhere" />
            </SelectTrigger>
            <SelectContent className="w-[160px]">
              {VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} label={option.label} />
              ))}
            </SelectContent>
          </Select>
        </View>

        {notice ? <Text className="text-sm text-muted-foreground">{notice}</Text> : null}
        {error ? (
          <Text className="text-sm text-destructive" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>

      {venues === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : venues.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Icon as={MapPin} className="size-8 text-muted-foreground" />
          <Text className="text-center text-sm text-muted-foreground">
            No places match these filters.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {venues.map((venue) => (
            <VenueRow
              key={venue.id}
              venue={venue}
              onEditTags={() => setEditingTags(venue)}
              onDelete={() => setConfirming(venue)}
              onChanged={refetch}
            />
          ))}
        </ScrollView>
      )}

      <View className="flex-row items-center justify-end gap-6 border-t border-border px-6 py-3">
        <Select
          value={{ value: String(sort), label: SORT_LABELS[sort] }}
          onValueChange={(option) => option && refine(() => setSort(option.value as VenueSort))}>
          <SelectTrigger className="w-[150px]" aria-label="Sort by">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent className="w-[150px]">
            {(Object.keys(SORT_LABELS) as VenueSort[]).map((option) => (
              <SelectItem key={option} value={option} label={SORT_LABELS[option]} />
            ))}
          </SelectContent>
        </Select>

        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-muted-foreground">Rows per page</Text>
          <Select
            value={{ value: String(pageSize), label: String(pageSize) }}
            onValueChange={(option) => option && refine(() => setPageSize(Number(option.value)))}>
            <SelectTrigger className="w-[90px]" aria-label="Rows per page">
              <SelectValue placeholder="25" />
            </SelectTrigger>
            <SelectContent className="w-[90px]">
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)} label={String(size)} />
              ))}
            </SelectContent>
          </Select>
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

      {adding ? (
        <PlaceDialog
          allTags={tags}
          onClose={() => setAdding(false)}
          onSaved={({ created, name }) => {
            setNotice(
              created
                ? `Added ${name}. It is on the map now.`
                : `We already knew ${name} — your tags were added to it.`
            );
            refetch();
          }}
        />
      ) : null}

      {editingTags ? (
        <VenueTagsDialog
          key={editingTags.id}
          venue={editingTags}
          allTags={tags}
          onClose={() => setEditingTags(null)}
          onSaved={refetch}
        />
      ) : null}

      <AlertDialog open={confirming !== null} onOpenChange={(next) => !next && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirming?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its {confirming?.tags.length ?? 0} tag
              {(confirming?.tags.length ?? 0) === 1 ? '' : 's'} and {confirming?.noteCount ?? 0} note
              {(confirming?.noteCount ?? 0) === 1 ? '' : 's'} go with it. Nobody has reviewed this
              place, so no review is lost — but this cannot be undone.
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
                if (target) void run(() => deleteVenue(target.id));
              }}>
              <Text className="text-white">Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}

const SORT_LABELS: Record<VenueSort, string> = {
  created_at: 'Newest',
  name: 'Name',
  review_count: 'Most reviews',
  note_count: 'Most notes',
};
