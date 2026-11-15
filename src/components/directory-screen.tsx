import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  SearchX,
  TriangleAlert,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChenfengDirectoryScreen } from '@/components/chenfeng/directory-screen';
import { usePlaceSheets } from '@/components/directory-sheets';
import { DirectoryTransition } from '@/components/directory-transition';
import { DistanceMeter } from '@/components/distance-meter';
import { KindBadge } from '@/components/kind-badge';
import { useLeaveNowReserve } from '@/components/leave-now';
import { LocationChoiceScreen } from '@/components/location-choice';
import { OauDirectoryScreen } from '@/components/oau/directory-screen';
import { useIsWideViewport } from '@/components/tab-bar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { OnlineSection, PlaceGroup, PlaceSearchField } from '@/components/venue-list';
import {
  directoryLead,
  EVERY_KIND,
  ONLINE_KIND,
  useDirectory,
  type Directory,
  type Kind,
} from '@/lib/directory';
import { DIRECTORY_TEXT } from '@/lib/directory-text';
import { EVERY_KIND_ICON, kindIcon } from '@/lib/kind-icons';
import { useTagIcons } from '@/lib/tag-icons';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/**
 * The Directory tab: every place LavenderBook lists around here - the
 * community centres, the trans clinics, the shelters, the queer-owned
 * businesses - with what each one is.
 *
 * It opens on one question, "What are you looking for?", answered by the kinds
 * of place there are here: each with its symbol, what it means and how many
 * there are. For somebody new to a city - or to being out - that is the way in;
 * a row of bare tag names asked them to know the vocabulary first. One press
 * opens a kind, "All kinds" comes back, and typing a search looks across every
 * kind at once, in names, descriptions and kinds.
 *
 * Chenfeng's is a large-title screen of inset sections (its own file); Basic
 * and Material keep this one. Both run on useDirectory, so they list the same
 * places and offer the same kinds.
 */
export function DirectoryScreen() {
  const { skin } = useSkin();
  // OAU's is tiles on paper (its own file).
  if (skin === 'chenfeng') return <ChenfengDirectoryScreen />;
  if (skin === 'oau') return <OauDirectoryScreen />;
  return <BasicDirectoryScreen />;
}

function BasicDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  // On wide the header row already clears the status bar; on narrow nothing
  // does - and a phone browser's "Leave now" button holds the corner above
  // the title.
  const { top: leaveNow } = useLeaveNowReserve();
  const topInset = (isWide ? 0 : insets.top) + leaveNow;

  const directory = useDirectory();
  const lead = directoryLead(directory);
  const { open, showOnMap, sheets } = usePlaceSheets(directory.refresh);

  // A kind opened from far down the list starts at its top, not wherever the
  // kinds had been scrolled to.
  const scroller = React.useRef<ScrollView>(null);
  const shown = `${directory.view}:${directory.kind?.tag.slug ?? ''}`;
  React.useEffect(() => {
    if (directory.view !== 'search') scroller.current?.scrollTo({ y: 0, animated: false });
  }, [shown, directory.view]);

  if (directory.where.state === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  // Nobody has said where to look yet: the same choice the map opens with,
  // and choosing here settles it for the map too.
  if (directory.where.state === 'unchosen') return <LocationChoiceScreen />;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      {/* Bottom padding only - the tab bar owns the bottom inset itself. */}
      <ScrollView
        ref={scroller}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        className="flex-1"
        contentContainerClassName="pb-10">
        <View className="w-full max-w-2xl gap-5 self-center px-4 pt-8">
          <View className="gap-1.5 px-2">
            <Text role="heading" className="text-3xl font-bold text-foreground">
              {DIRECTORY_TEXT.title}
            </Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              {lead.before}
              {/* Where it is looking stands out: it follows the map. */}
              {lead.place ? (
                <Text className="text-sm leading-5 font-semibold text-foreground">{lead.place}</Text>
              ) : null}
              {lead.after}
            </Text>
          </View>

          <View className="gap-3">
            <PlaceSearchField
              value={directory.query}
              onChangeText={directory.setQuery}
              placeholder={DIRECTORY_TEXT.search}
              accessibilityLabel={DIRECTORY_TEXT.searchLabel}
            />
            <DistanceMeter className="px-1" />
          </View>

          <DirectoryTransition directory={directory}>
            <DirectoryBody directory={directory} onSelect={open} onLocate={showOnMap} />
          </DirectoryTransition>
        </View>
      </ScrollView>

      {sheets}
    </View>
  );
}

type BodyProps = {
  directory: Directory;
  onSelect: Parameters<typeof PlaceGroup>[0]['onSelect'];
  onLocate: Parameters<typeof PlaceGroup>[0]['onLocate'];
};

function DirectoryBody({ directory, onSelect, onLocate }: BodyProps) {
  // Each kind's chosen icon (tags.icon); its slug's default until they load.
  const tagIcons = useTagIcons();
  if (directory.failed) {
    return (
      <Notice icon={TriangleAlert} title={DIRECTORY_TEXT.failedTitle} text={DIRECTORY_TEXT.failed}>
        <Button variant="outline" onPress={directory.retry}>
          <Text>Try again</Text>
        </Button>
      </Notice>
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

  if (view === 'search') {
    if (count === 0) {
      return (
        <Notice
          icon={SearchX}
          title={DIRECTORY_TEXT.nothingFound(directory.searched)}
          text={DIRECTORY_TEXT.nothingFoundHint(km)}
        />
      );
    }
    return (
      <View className="gap-3">
        <Text role="heading" className="px-2 text-sm font-medium text-foreground">
          {DIRECTORY_TEXT.found(count, directory.searched)}
        </Text>
        <Places directory={directory} onSelect={onSelect} onLocate={onLocate} />
      </View>
    );
  }

  if (directory.total === 0) {
    return (
      <Notice icon={BookOpen} title={DIRECTORY_TEXT.emptyTitle} text={DIRECTORY_TEXT.empty(km)} />
    );
  }

  if (view === 'kinds') {
    return (
      <View className="gap-3">
        <Text role="heading" className="px-2 text-base font-semibold text-foreground">
          {DIRECTORY_TEXT.question}
        </Text>
        <View className="overflow-hidden rounded-lg border border-border">
          <KindRow
            first
            label={DIRECTORY_TEXT.every}
            description={DIRECTORY_TEXT.everyLead}
            count={directory.total}
            onPress={() => directory.open(EVERY_KIND)}
          />
          {directory.kinds.map((entry) => (
            <KindRow
              key={entry.tag.slug}
              kind={entry}
              label={entry.tag.label}
              description={entry.description}
              count={entry.count}
              onPress={() => directory.open(entry.tag.slug)}
            />
          ))}
        </View>
      </View>
    );
  }

  // One kind, or every place.
  return (
    <View className="gap-4">
      <Pressable
        onPress={directory.back}
        accessibilityRole="button"
        className={cn(
          'flex-row items-center gap-1 self-start rounded-full border border-border py-1.5 pl-2 pr-3.5 active:bg-accent',
          Platform.select({ web: 'cursor-pointer' })
        )}>
        <Icon as={ChevronLeft} className="size-4 text-foreground" />
        <Text className="text-sm font-medium text-foreground">{DIRECTORY_TEXT.back}</Text>
      </Pressable>

      {/* The open kind is itself the way to another: pressing it goes back to
          the kinds, as "All kinds" above does - a header that looks like a
          title is where people tap to change what they are looking at. */}
      <Pressable
        onPress={directory.back}
        accessibilityRole="button"
        accessibilityLabel={DIRECTORY_TEXT.changeSpoken(kind ? kind.tag.label : DIRECTORY_TEXT.every)}
        className={cn(
          'flex-row items-center gap-3 rounded-lg p-1 active:bg-accent',
          Platform.select({ web: 'cursor-pointer transition-colors hover:bg-accent' })
        )}>
        <KindBadge
          tag={kind?.tag}
          icon={kind ? kindIcon(kind.tag.slug, tagIcons[kind.tag.slug]) : EVERY_KIND_ICON}
          size={44}
        />
        <View className="flex-1 gap-0.5">
          <Text role="heading" className="text-lg font-semibold text-foreground">
            {kind ? kind.tag.label : DIRECTORY_TEXT.every}
          </Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {[kind?.description, DIRECTORY_TEXT.count(count)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View className="flex-row items-center gap-1 self-center rounded-full border border-border py-1 pl-2.5 pr-1.5">
          <Text className="text-xs font-medium text-foreground">{DIRECTORY_TEXT.change}</Text>
          <Icon as={ChevronsUpDown} className="size-3.5 text-muted-foreground" />
        </View>
      </Pressable>

      <Places directory={directory} onSelect={onSelect} onLocate={onLocate} />
    </View>
  );
}

/** The places of the open kind, or the search: the ones you can go to, then the online ones. */
function Places({ directory, onSelect, onLocate }: BodyProps) {
  const places = directory.places;
  if (!places) return null;
  // Under the Online kind its own heading, just above, has said all of this.
  const onlineKind = directory.kind?.tag.slug === ONLINE_KIND;

  return (
    <View className="gap-5">
      {places.nearby.length > 0 ? (
        <PlaceGroup rows={places.nearby} listed onSelect={onSelect} onLocate={onLocate} />
      ) : null}
      {places.online.length > 0 ? (
        <OnlineSection
          rows={places.online}
          // Folded only over every kind at once: a search, or a kind somebody
          // chose, shows all it found.
          open={directory.kind !== null || directory.view === 'search'}
          heading={!onlineKind}
          listed
          onSelect={onSelect}
          onLocate={onLocate}
        />
      ) : null}
    </View>
  );
}

/**
 * One kind of place: its symbol in its own colours, its name, what it means,
 * how many there are here, and a chevron - a row that says it opens.
 */
function KindRow({
  kind,
  label,
  description,
  count,
  first,
  onPress,
}: {
  /** None for "Everything". */
  kind?: Kind;
  label: string;
  description: string | null;
  count: number;
  first?: boolean;
  onPress: () => void;
}) {
  const tagIcons = useTagIcons();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[label, DIRECTORY_TEXT.count(count), description].filter(Boolean).join(', ')}
      className={cn(
        'flex-row items-center gap-3 bg-card p-4 active:bg-accent',
        !first && 'border-t border-border',
        Platform.select({ web: 'cursor-pointer transition-colors hover:bg-accent' })
      )}>
      <KindBadge
        tag={kind?.tag}
        icon={kind ? kindIcon(kind.tag.slug, tagIcons[kind.tag.slug]) : EVERY_KIND_ICON}
      />
      <View className="flex-1 gap-0.5">
        <Text className="font-medium text-foreground">{label}</Text>
        {description ? (
          <Text numberOfLines={2} className="text-sm leading-5 text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </View>
      <Text
        className="text-sm font-medium text-muted-foreground"
        style={{ fontVariant: ['tabular-nums'] }}>
        {count}
      </Text>
      <Icon as={ChevronRight} className="size-4 text-muted-foreground" />
    </Pressable>
  );
}

function Notice({
  icon,
  title,
  text,
  children,
}: React.PropsWithChildren<{ icon: typeof BookOpen; title: string; text: string }>) {
  return (
    <View className="items-center gap-3 px-6 py-10">
      <Icon as={icon} className="size-8 text-muted-foreground" />
      <Text className="text-center font-medium text-foreground">{title}</Text>
      <Text className="text-center text-sm leading-5 text-muted-foreground">{text}</Text>
      {children}
    </View>
  );
}
