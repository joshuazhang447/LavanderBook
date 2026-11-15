import { ChevronLeft, ChevronRight, ChevronsUpDown, SearchX, TriangleAlert } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaceSheets } from '@/components/directory-sheets';
import { DirectoryTransition } from '@/components/directory-transition';
import { DistanceMeter } from '@/components/distance-meter';
import { KindBadge } from '@/components/kind-badge';
import { useLeaveNowReserve } from '@/components/leave-now';
import { LocationChoiceScreen } from '@/components/location-choice';
import { BookTile, OauCard, OauHeading } from '@/components/oau/card';
import { PaperBackdrop } from '@/components/oau/paper';
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
import { cn } from '@/lib/utils';

const PRESS_WEB = Platform.select({
  web: 'cursor-pointer transition-transform hover:bg-muted/40',
});

/**
 * OAU's Directory (LavenderBookStyle/oau-style-guide.md, sections 14.7 and
 * 14.8): white paper; the kinds of place as tiles in a grid, "Everything"
 * across the top; an open kind under a header card with its badge, what it
 * means and how many; the places as rows in one card, with a round sticker to
 * show each on the map. Everything it lists and offers is useDirectory's, as
 * for every skin.
 */
export function OauDirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  const { top: leaveNow } = useLeaveNowReserve();
  const topInset = (isWide ? 0 : insets.top) + leaveNow;

  const directory = useDirectory();
  const lead = directoryLead(directory);
  const { open, showOnMap, sheets } = usePlaceSheets(directory.refresh);

  // A kind opened from far down starts at its top.
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

  // Nobody has said where to look yet: the map's own first question.
  if (directory.where.state === 'unchosen') return <LocationChoiceScreen />;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      <PaperBackdrop tab="directory" washHeight={260} />
      {/* Bottom padding only - the tab bar owns the bottom inset itself. */}
      <ScrollView
        ref={scroller}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        className="flex-1"
        contentContainerClassName="pb-12">
        <View className="w-full max-w-[840px] gap-6 self-center px-4 pt-7 sm:px-6">
          <View className="gap-2">
            <Text oauStyle="display" role="heading" className="text-foreground">
              {DIRECTORY_TEXT.title}
            </Text>
            <Text oauStyle="body" className="text-muted-foreground">
              {lead.before}
              {/* Where it is looking stands out: it follows the map. */}
              {lead.place ? (
                <Text oauStyle="body" className="font-semibold text-foreground">
                  {lead.place}
                </Text>
              ) : null}
              {lead.after}
            </Text>
          </View>

          <View className="gap-4">
            <PlaceSearchField
              value={directory.query}
              onChangeText={directory.setQuery}
              placeholder={DIRECTORY_TEXT.search}
              accessibilityLabel={DIRECTORY_TEXT.searchLabel}
            />
            <DistanceMeter />
          </View>

          <DirectoryTransition directory={directory}>
            <Body directory={directory} onSelect={open} onLocate={showOnMap} />
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

function Body({ directory, onSelect, onLocate }: BodyProps) {
  const { isWide: wide } = useIsWideViewport();
  if (directory.failed) {
    return (
      <Notice icon={TriangleAlert} title={DIRECTORY_TEXT.failedTitle} text={DIRECTORY_TEXT.failed}>
        <Button variant="secondary" onPress={directory.retry}>
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
        <Text oauStyle="subheading" role="heading" className="text-foreground">
          {DIRECTORY_TEXT.found(count, directory.searched)}
        </Text>
        <Places directory={directory} onSelect={onSelect} onLocate={onLocate} />
      </View>
    );
  }

  if (directory.total === 0) {
    return <Notice title={DIRECTORY_TEXT.emptyTitle} text={DIRECTORY_TEXT.empty(km)} />;
  }

  if (view === 'kinds') {
    return (
      <View className="gap-3">
        <OauHeading title={DIRECTORY_TEXT.question} />
        <EverythingTile count={directory.total} onPress={() => directory.open(EVERY_KIND)} />
        <KindGrid kinds={directory.kinds} onOpen={(slug) => directory.open(slug)} />
      </View>
    );
  }

  // One kind, or every place. Wide: the header card in a column of its own
  // beside the places (section 14.14).
  const header = (
    <View className="gap-4">
      <View className="items-start">
        <Button variant="secondary" size="sm" onPress={directory.back}>
          <Icon as={ChevronLeft} className="size-4 text-foreground" />
          <Text>{DIRECTORY_TEXT.back}</Text>
        </Button>
      </View>
      <KindHeader kind={kind} count={count} onChange={directory.back} />
    </View>
  );
  if (wide) {
    return (
      <View className="flex-row items-start gap-6">
        <View className="w-[300px]">{header}</View>
        <View className="flex-1 pt-12">
          <Places directory={directory} onSelect={onSelect} onLocate={onLocate} />
        </View>
      </View>
    );
  }
  return (
    <View className="gap-4">
      {header}
      <Places directory={directory} onSelect={onSelect} onLocate={onLocate} />
    </View>
  );
}

/** The places you can go to, then the ones with no public address. */
function Places({ directory, onSelect, onLocate }: BodyProps) {
  const places = directory.places;
  if (!places) return null;
  // Under the Online kind its own header has said all of this.
  const onlineKind = directory.kind?.tag.slug === ONLINE_KIND;

  return (
    <View className="gap-6">
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

/** "Everything": the full-width tile at the top. */
function EverythingTile({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[DIRECTORY_TEXT.every, DIRECTORY_TEXT.count(count), DIRECTORY_TEXT.everyLead].join(
        ', '
      )}
      className={cn(
        'flex-row items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3.5 active:scale-[0.99] active:bg-muted',
        PRESS_WEB
      )}>
      <KindBadge icon={EVERY_KIND_ICON} size={40} />
      <View className="flex-1 gap-0.5">
        <Text oauStyle="subheading" className="text-foreground">
          {DIRECTORY_TEXT.every}
        </Text>
        <Text oauStyle="callout" className="text-muted-foreground">
          {DIRECTORY_TEXT.everyLead}
        </Text>
      </View>
      <Text oauStyle="label" className="text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
        {count}
      </Text>
      <Icon as={ChevronRight} className="size-[18px] text-muted-foreground" />
    </Pressable>
  );
}

/**
 * The kinds as tiles: two across on a phone, three or four on wider screens,
 * each a card that presses like a sticker - badge, name, count. What a kind
 * means is on its own page, rather than cut off at two lines here.
 */
function KindGrid({ kinds, onOpen }: { kinds: Kind[]; onOpen: (slug: string) => void }) {
  const [width, setWidth] = React.useState(0);
  const columns = width >= 760 ? 4 : width >= 520 ? 3 : 2;
  const rows: Kind[][] = [];
  for (let i = 0; i < kinds.length; i += columns) rows.push(kinds.slice(i, i + columns));

  return (
    <View
      className="gap-3"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      {rows.map((row, index) => (
        <View key={index} className="flex-row gap-3">
          {row.map((kind) => (
            <KindTile key={kind.tag.slug} kind={kind} onPress={() => onOpen(kind.tag.slug)} />
          ))}
          {/* Keeps the last row's tiles the width of the others. */}
          {Array.from({ length: columns - row.length }, (_, pad) => (
            <View key={`pad-${pad}`} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  );
}

function KindTile({ kind, onPress }: { kind: Kind; onPress: () => void }) {
  const tagIcons = useTagIcons();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[kind.tag.label, DIRECTORY_TEXT.count(kind.count), kind.description]
        .filter(Boolean)
        .join(', ')}
      className={cn(
        'min-h-[124px] flex-1 gap-2.5 rounded-[18px] border border-border bg-card p-3.5 active:scale-[0.98] active:bg-muted',
        PRESS_WEB
      )}>
      <KindBadge tag={kind.tag} icon={kindIcon(kind.tag.slug, tagIcons[kind.tag.slug])} size={36} />
      <View className="flex-1 justify-end gap-0.5">
        <Text oauStyle="subheading" numberOfLines={2} className="text-foreground">
          {kind.tag.label}
        </Text>
        <Text oauStyle="caption" className="text-muted-foreground">
          {DIRECTORY_TEXT.count(kind.count)}
        </Text>
      </View>
    </Pressable>
  );
}

/** An open kind: its 56 badge, its name, what it means, how many - and "Change". */
function KindHeader({
  kind,
  count,
  onChange,
}: {
  kind: Kind | null;
  count: number;
  onChange: () => void;
}) {
  const tagIcons = useTagIcons();
  const label = kind ? kind.tag.label : DIRECTORY_TEXT.every;
  return (
    <OauCard className="gap-3 p-5">
      <View className="flex-row items-start gap-4">
        <KindBadge
          tag={kind?.tag}
          icon={kind ? kindIcon(kind.tag.slug, tagIcons[kind.tag.slug]) : EVERY_KIND_ICON}
          size={56}
        />
        <View className="flex-1 gap-1">
          <Text oauStyle="title" role="heading" className="text-foreground">
            {label}
          </Text>
          {/* "Change" beside the count, not beside the title: there it took
              the title's room and broke the kind's name inside a word. */}
          <View className="flex-row flex-wrap items-center gap-x-1.5">
            <Text oauStyle="callout" className="text-muted-foreground">
              {DIRECTORY_TEXT.count(count)} ·
            </Text>
            <Pressable
              onPress={onChange}
              accessibilityRole="button"
              accessibilityLabel={DIRECTORY_TEXT.changeSpoken(label)}
              hitSlop={8}
              className={cn(
                'flex-row items-center gap-0.5 active:opacity-60',
                Platform.select({ web: 'cursor-pointer' })
              )}>
              <Text oauStyle="callout" className="font-semibold text-primary">
                {DIRECTORY_TEXT.change}
              </Text>
              <Icon as={ChevronsUpDown} className="size-3.5 text-primary" />
            </Pressable>
          </View>
        </View>
      </View>
      {kind?.description ? (
        <Text oauStyle="body" className="text-foreground">
          {kind.description}
        </Text>
      ) : null}
    </OauCard>
  );
}

/** Empty and failed: the book on its tile, a line, a second line, at most one sticker. */
function Notice({
  icon,
  title,
  text,
  children,
}: React.PropsWithChildren<{ icon?: typeof SearchX; title: string; text: string }>) {
  return (
    <View className="items-center gap-3 px-6 py-10">
      {icon ? (
        <View className="size-14 items-center justify-center rounded-full bg-muted">
          <Icon as={icon} className="size-7 text-muted-foreground" />
        </View>
      ) : (
        <BookTile />
      )}
      <Text oauStyle="subheading" className="text-center text-foreground">
        {title}
      </Text>
      <Text oauStyle="callout" className="text-center text-muted-foreground">
        {text}
      </Text>
      {children}
    </View>
  );
}
