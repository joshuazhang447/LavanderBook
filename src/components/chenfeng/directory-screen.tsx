import {
  BookOpen,
  ChevronLeft,
  ChevronsUpDown,
  CircleX,
  Search,
  SearchX,
  TriangleAlert,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  View,
  type ScrollView,
} from 'react-native';

import { LargeTitleScreen } from '@/components/chenfeng/large-title-screen';
import { ChenfengLocationChoiceScreen } from '@/components/chenfeng/location-choice';
import { ChenfengOnlineRows, ChenfengPlaceRows } from '@/components/chenfeng/venue-list';
import { usePlaceSheets } from '@/components/directory-sheets';
import { DirectoryTransition } from '@/components/directory-transition';
import { DistanceMeter } from '@/components/distance-meter';
import { KindBadge } from '@/components/kind-badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { EmptyState, List, Row, Section } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { directoryLead, EVERY_KIND, ONLINE_KIND, useDirectory, type Directory } from '@/lib/directory';
import { DIRECTORY_TEXT } from '@/lib/directory-text';
import { EVERY_KIND_ICON, kindIcon } from '@/lib/kind-icons';
import { useTagIcons } from '@/lib/tag-icons';
import { cn } from '@/lib/utils';
import type { NearbyVenue } from '@/lib/use-nearby-venues';

/** How long the refresh control shows after a pull: the pull, not the network. */
const REFRESH_MS = 900;
/** A settings tile's size (guideline section 13.5). */
const TILE = 30;

/**
 * Chenfeng's Directory: a large-title screen on the grouped page - what this
 * is a list of, a search field, the distance, then "What Are You Looking For?"
 * as an inset section with a row per kind: its symbol on a tile in the kind's
 * own colours, its name, what it means, how many, a chevron. A kind opens in
 * place, with "All Kinds" to come back; the places are inset rows, "Show on
 * Map" a swipe away. Pull to refresh asks again.
 *
 * The places, the kinds and every rule about them are the other skins'
 * (useDirectory).
 */
export function ChenfengDirectoryScreen() {
  const directory = useDirectory();
  const lead = directoryLead(directory);
  const { open, showOnMap, sheets } = usePlaceSheets(directory.refresh);

  const [refreshing, setRefreshing] = React.useState(false);
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    []
  );
  const pull = () => {
    directory.refresh();
    setRefreshing(true);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setRefreshing(false), REFRESH_MS);
  };

  // A kind opened from far down the list starts at its top.
  const scroller = React.useRef<ScrollView>(null);
  const shown = `${directory.view}:${directory.kind?.tag.slug ?? ''}`;
  React.useEffect(() => {
    if (directory.view !== 'search') scroller.current?.scrollTo({ y: 0, animated: false });
  }, [shown, directory.view]);

  if (directory.where.state === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-grouped">
        <ActivityIndicator />
      </View>
    );
  }

  // Nobody has said where to look yet: the same choice the map opens with,
  // and choosing here settles it for the map too.
  if (directory.where.state === 'unchosen') return <ChenfengLocationChoiceScreen />;

  return (
    <>
      <LargeTitleScreen
        title={DIRECTORY_TEXT.title}
        grouped
        scrollRef={scroller}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} />}>
        <View className="gap-5">
          <Text textStyle="subheadline" className="px-4 text-label-secondary">
            {lead.before}
            {/* Where it is looking stands out: it follows the map. */}
            {lead.place ? (
              <Text textStyle="subheadline" className="font-semibold text-foreground">
                {lead.place}
              </Text>
            ) : null}
            {lead.after}
          </Text>

          <View className="gap-4 px-4">
            <SearchField value={directory.query} onChangeText={directory.setQuery} />
            <DistanceMeter />
          </View>

          <DirectoryTransition directory={directory}>
            <Body directory={directory} onSelect={open} onLocate={showOnMap} />
          </DirectoryTransition>
        </View>
      </LargeTitleScreen>

      {sheets}
    </>
  );
}

/** An inline search field: the tertiary fill, as the city picker's (guideline 13.10). */
function SearchField({ value, onChangeText }: { value: string; onChangeText: (next: string) => void }) {
  return (
    <View className="h-11 flex-row items-center rounded-full bg-fill-tertiary pl-3 pr-1">
      <Icon as={Search} size={17} className="text-label-secondary" />
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={DIRECTORY_TEXT.search}
        accessibilityLabel={DIRECTORY_TEXT.searchLabel}
        returnKeyType="search"
        autoCorrect={false}
        className="h-11 flex-1 bg-transparent px-2"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          className={cn('p-1.5 active:opacity-60', Platform.select({ web: 'cursor-pointer' }))}>
          <Icon as={CircleX} size={17} className="text-label-tertiary" />
        </Pressable>
      ) : null}
    </View>
  );
}

function Body({
  directory,
  onSelect,
  onLocate,
}: {
  directory: Directory;
  onSelect: (venue: NearbyVenue) => void;
  onLocate: (venue: NearbyVenue) => void;
}) {
  // Each kind's chosen icon (tags.icon); its slug's default until they load.
  const tagIcons = useTagIcons();
  if (directory.failed) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title={DIRECTORY_TEXT.failedTitleTitle}
        description={DIRECTORY_TEXT.failed}
        action={
          <Button variant="secondary" onPress={directory.retry}>
            <Text>Try Again</Text>
          </Button>
        }
      />
    );
  }

  if (!directory.loaded || !directory.places) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator />
      </View>
    );
  }

  const { places, view, kind, km } = directory;
  const count = places.nearby.length + places.online.length;
  // Under the Online kind its own heading, just above, has said all of this.
  const onlineKind = kind?.tag.slug === ONLINE_KIND;

  const rows = (
    <List className="gap-7">
      {places.nearby.length > 0 ? (
        <ChenfengPlaceRows
          plain={false}
          rows={places.nearby}
          listed
          onSelect={onSelect}
          onLocate={onLocate}
        />
      ) : null}
      {places.online.length > 0 ? (
        <ChenfengOnlineRows
          plain={false}
          // Folded only over every kind at once: a search, or a kind somebody
          // chose, shows all it found.
          open={kind !== null || view === 'search'}
          heading={!onlineKind}
          rows={places.online}
          listed
          onSelect={onSelect}
          onLocate={onLocate}
        />
      ) : null}
    </List>
  );

  if (view === 'search') {
    return count === 0 ? (
      <EmptyState
        icon={SearchX}
        title={DIRECTORY_TEXT.nothingFoundTitle(directory.searched)}
        description={DIRECTORY_TEXT.nothingFoundHint(km)}
      />
    ) : (
      <View className="gap-3">
        <Text textStyle="headline" role="heading" className="px-8 text-label-secondary">
          {DIRECTORY_TEXT.found(count, directory.searched)}
        </Text>
        {rows}
      </View>
    );
  }

  if (directory.total === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title={DIRECTORY_TEXT.emptyTitleTitle}
        description={DIRECTORY_TEXT.empty(km)}
      />
    );
  }

  if (view === 'kinds') {
    return (
      <List>
        <Section header={DIRECTORY_TEXT.questionTitle}>
          <Row
            leading={<KindBadge icon={EVERY_KIND_ICON} size={TILE} square />}
            leadingWidth={TILE}
            title={DIRECTORY_TEXT.every}
            subtitle={DIRECTORY_TEXT.everyLead}
            denseSubtitle
            detail={String(directory.total)}
            accessory="chevron"
            accessibilityLabel={`${DIRECTORY_TEXT.every}, ${DIRECTORY_TEXT.count(directory.total)}`}
            onPress={() => directory.open(EVERY_KIND)}
          />
          {directory.kinds.map((entry) => (
            <Row
              key={entry.tag.slug}
              leading={
                <KindBadge
                  tag={entry.tag}
                  icon={kindIcon(entry.tag.slug, tagIcons[entry.tag.slug])}
                  size={TILE}
                  square
                />
              }
              leadingWidth={TILE}
              title={entry.tag.label}
              subtitle={entry.description ?? undefined}
              denseSubtitle
              detail={String(entry.count)}
              accessory="chevron"
              accessibilityLabel={[
                entry.tag.label,
                DIRECTORY_TEXT.count(entry.count),
                entry.description,
              ]
                .filter(Boolean)
                .join(', ')}
              onPress={() => directory.open(entry.tag.slug)}
            />
          ))}
        </Section>
      </List>
    );
  }

  // One kind, or every place.
  return (
    <View className="gap-4">
      <View className="gap-3 px-4">
        <Pressable
          onPress={directory.back}
          accessibilityRole="button"
          hitSlop={8}
          className={cn(
            'flex-row items-center gap-0.5 self-start active:opacity-50',
            Platform.select({ web: 'cursor-pointer' })
          )}>
          <Icon as={ChevronLeft} size={20} weight="semibold" className="text-primary" />
          <Text textStyle="body" className="text-primary">
            {DIRECTORY_TEXT.backTitle}
          </Text>
        </Pressable>
        {/* The open kind is itself the way to another, as "All Kinds" above
            is: pressing it goes back to the kinds. */}
        <Pressable
          onPress={directory.back}
          accessibilityRole="button"
          accessibilityLabel={DIRECTORY_TEXT.changeSpoken(
            kind ? kind.tag.label : DIRECTORY_TEXT.every
          )}
          className={cn(
            'flex-row items-center gap-3 active:opacity-60',
            Platform.select({ web: 'cursor-pointer' })
          )}>
          <KindBadge
            tag={kind?.tag}
            icon={kind ? kindIcon(kind.tag.slug, tagIcons[kind.tag.slug]) : EVERY_KIND_ICON}
            size={44}
            square
          />
          <View className="flex-1">
            <Text textStyle="title3" emphasized role="heading" className="text-foreground">
              {kind ? kind.tag.label : DIRECTORY_TEXT.every}
            </Text>
            <Text textStyle="subheadline" className="text-label-secondary">
              {[kind?.description, DIRECTORY_TEXT.count(count)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View className="flex-row items-center gap-0.5 self-center">
            <Text textStyle="subheadline" className="text-primary">
              {DIRECTORY_TEXT.changeTitle}
            </Text>
            <Icon as={ChevronsUpDown} size={14} weight="semibold" className="text-primary" />
          </View>
        </Pressable>
      </View>
      {rows}
    </View>
  );
}
