import { MapPin, RotateCw, Search, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DistanceMeter } from '@/components/distance-meter';
import { useLeaveNowReserve } from '@/components/leave-now';
import { ListFilterControl } from '@/components/list-filter';
import { RecenterButton } from '@/components/map-controls';
import { usePlaceSearch } from '@/components/map-search';
import { IconSticker, OauCard } from '@/components/oau/card';
import { PaperBackdrop } from '@/components/oau/paper';
import { OauPlaceCard } from '@/components/oau/venue-sheet';
import { useIsWideViewport } from '@/components/tab-bar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { KindBadge } from '@/components/kind-badge';
import {
  formatDistance,
  OnlineSection,
  PlaceRowCard,
  useListRows,
} from '@/components/venue-list';
import { useListPlaceName } from '@/lib/area-name';
import { arrangePlaces, type PlaceRow } from '@/lib/directory';
import { DISTANCE_TEXT, LIST_FILTER_TEXT, LIST_TEXT } from '@/lib/directory-text';
import { useMapLocation } from '@/lib/map-location';
import { materialSpring } from '@/lib/motion';
import { OAU_MAP_TEXT as T } from '@/lib/oau-text';
import { EVERY_KIND_ICON, kindIcon } from '@/lib/kind-icons';
import { matchPlaces } from '@/lib/place-match';
import type { PlaceResult } from '@/lib/place-search';
import { useTagIcons } from '@/lib/tag-icons';
import { useFieldText } from '@/lib/use-field-text';
import { useVenueNameSearch } from '@/lib/venue-search';
import { distanceMeters, type Coords } from '@/lib/use-location';
import { isMapped, type NearbyVenue } from '@/lib/use-nearby-venues';
import { cn } from '@/lib/utils';

/**
 * OAU's Map tab chrome (LavenderBookStyle/oau-style-guide.md, sections 14.2,
 * 14.3 and 14.14): no Map | List switch. A search bar that is always there,
 * and the places as a sheet over the map - peeking at the bottom of a phone
 * with how many there are, half and full height on a drag - or, from 768 wide,
 * a panel down the leading side with the search bar at its top. Tapping a pin
 * or a row opens that place's card in the same sheet or panel, with a way back
 * to the list; the map never disappears behind a list.
 *
 * Everything listed is useListRows', as in Basic's list: every listed or
 * reviewed place out to the distance meter, nearest first, measured on the
 * device.
 */

const SHADOW_WEB = Platform.select({ web: 'shadow-[0_6px_24px_-6px_rgba(69,49,30,0.35)]' });

/** A bare TextInput's own box, as map-search.tsx explains. */
const fieldStyles = StyleSheet.create({
  field: {
    flex: 1,
    height: 40,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: 17,
  },
});

/** At most this many of LavenderBook's own places, then this many others. */
const MAX_OURS = 4;
const MAX_OTHERS = 5;

/**
 * The search bar (section 13.5): a cream card you type into, a 1.5 ink
 * outline, 52 tall; its results drop under it. Keeps its own text on a phone
 * (useFieldText).
 *
 * LavenderBook's own places come first, as you type: the ones around here,
 * searched on the device the way the Directory is (@/lib/place-match), and
 * any further away whose name holds what was typed (useVenueNameSearch).
 * Picking one opens its card, as a row does. Then any other place, from the
 * place search the other skins' pill uses, through the same billed-call
 * guards (usePlaceSearch); picking one moves the map there.
 */
function OauSearchBar({
  origin,
  rows,
  measureFrom,
  onPick,
  onPickVenue,
  onClear,
}: {
  /** Biases the other places toward what is on screen. */
  origin: Coords | null;
  /** The list's places, whatever its filter: searched first. */
  rows: readonly PlaceRow[];
  /** Where the list measures from, for the distance of a place further away. */
  measureFrom: Coords | null;
  onPick: (place: PlaceResult) => void;
  onPickVenue: (venue: NearbyVenue) => void;
  onClear: () => void;
}) {
  const search = usePlaceSearch(origin, true);
  const { query, trimmed, results, setResults, error, busy, change, reset } = search;
  // Closed by a pick and opened again by typing: LavenderBook's places are
  // there for as long as the text is, so the results alone cannot say.
  const [open, setOpen] = React.useState(true);
  const type = React.useCallback(
    (next: string) => {
      change(next);
      setOpen(true);
    },
    [change]
  );
  const field = useFieldText({ value: query, onChangeText: type });
  const inputRef = React.useRef<TextInput>(null);

  const further = useVenueNameSearch(trimmed, origin);
  const ours = React.useMemo(() => {
    if (trimmed.length === 0) return [];
    const known = new Set(rows.map((row) => row.venue.id));
    const extra = arrangePlaces(
      further.filter((venue) => !known.has(venue.id)),
      measureFrom
    );
    const far = new Set([...extra.nearby, ...extra.online]);
    // Further than the list goes counts for half: the places around here
    // first, unless the one further away is plainly what was typed.
    return matchPlaces([...rows, ...far], trimmed, (row) => (far.has(row) ? 0.5 : 1)).slice(
      0,
      MAX_OURS
    );
  }, [rows, further, measureFrom, trimmed]);

  // A place LavenderBook already has is shown once, as LavenderBook's.
  const others = React.useMemo(() => {
    const ourPlaces = new Set(ours.map((row) => row.venue.google_place_id).filter(Boolean));
    return (results ?? [])
      .filter((place) => !ourPlaces.has(place.placeId))
      .slice(0, ours.length > 0 ? MAX_OTHERS - 1 : MAX_OTHERS);
  }, [results, ours]);

  const answered = error !== null || results !== null;
  const showResults = open && trimmed.length > 0 && (ours.length > 0 || answered);

  const close = () => {
    setResults(null);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    // Above whatever follows it, so its results cover the list rather than
    // slipping under it.
    <View className="z-20">
      <View
        className={cn(
          'h-[52px] flex-row items-center gap-2.5 rounded-[18px] border-[1.5px] border-outline-ink bg-card pl-4 pr-2',
          SHADOW_WEB
        )}>
        <Icon as={Search} className="size-5 text-muted-foreground" />
        <TextInput
          ref={inputRef}
          key={field.key}
          {...field.props}
          onSubmitEditing={search.submit}
          placeholder={T.search}
          accessibilityLabel={T.searchLabel}
          returnKeyType="search"
          autoCorrect={false}
          underlineColorAndroid="transparent"
          style={fieldStyles.field}
          className="text-foreground placeholder:text-muted-foreground outline-none"
        />
        {busy ? (
          <ActivityIndicator size="small" className="mr-2" />
        ) : query.length > 0 ? (
          <IconSticker
            icon={X}
            label={T.clear}
            onPress={() => {
              reset();
              onClear();
            }}
          />
        ) : null}
      </View>

      {showResults ? (
        <View
          className={cn(
            'absolute left-0 right-0 top-[60px] overflow-hidden rounded-[18px] border border-border bg-card',
            SHADOW_WEB
          )}>
          {ours.length > 0 ? (
            <>
              <ResultsHeading label={T.ours} first />
              {ours.map((row) => (
                <OurResult
                  key={row.venue.id}
                  row={row}
                  onPress={() => {
                    close();
                    onPickVenue(row.venue);
                  }}
                />
              ))}
            </>
          ) : null}

          {error && ours.length === 0 ? (
            <Text oauStyle="callout" className="px-4 py-3 text-muted-foreground">
              {error}
            </Text>
          ) : results && results.length === 0 && ours.length === 0 ? (
            <Text oauStyle="callout" className="px-4 py-3 text-muted-foreground">
              {T.nothingFound(trimmed)}
            </Text>
          ) : others.length > 0 ? (
            <>
              {ours.length > 0 ? <ResultsHeading label={T.others} /> : null}
              {others.map((place, index) => (
                <Pressable
                  key={place.placeId}
                  onPress={() => {
                    close();
                    onPick(place);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${place.name} on the map`}
                  className={cn(
                    'flex-row items-center gap-3 px-4 py-3 active:bg-muted',
                    index > 0 && 'border-t border-border',
                    Platform.select({ web: 'cursor-pointer hover:bg-muted/60' })
                  )}>
                  <View className="size-8 items-center justify-center rounded-full bg-wash">
                    <Icon as={MapPin} className="size-4 text-primary" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text oauStyle="label" numberOfLines={1} className="flex-1 text-foreground">
                        {place.name}
                      </Text>
                      {place.reviewable === false ? (
                        <View className="rounded-full bg-muted px-2 py-0.5">
                          <Text oauStyle="micro" className="text-muted-foreground">
                            {T.area}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {place.address ? (
                      <Text oauStyle="caption" numberOfLines={1} className="text-muted-foreground">
                        {place.address}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** "On LavenderBook", "Other places": over each part of the results. */
function ResultsHeading({ label, first }: { label: string; first?: boolean }) {
  return (
    <Text
      oauStyle="overline"
      role="heading"
      className={cn('px-4 pb-1 pt-3 text-muted-foreground', !first && 'border-t border-border')}>
      {label}
    </Text>
  );
}

/** One of LavenderBook's places in the results: its kind's badge, name, kind and how far. */
function OurResult({ row, onPress }: { row: PlaceRow; onPress: () => void }) {
  const tagIcons = useTagIcons();
  const lead = row.tags[0];
  const away = formatDistance(row.distance);
  const detail = [lead?.label, away].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[T.openPlace(row.venue.name), detail].filter(Boolean).join(', ')}
      className={cn(
        'flex-row items-center gap-3 px-4 py-2.5 active:bg-muted',
        Platform.select({ web: 'cursor-pointer hover:bg-muted/60' })
      )}>
      <KindBadge
        tag={lead}
        icon={lead ? kindIcon(lead.slug, tagIcons[lead.slug]) : EVERY_KIND_ICON}
        size={32}
      />
      <View className="flex-1">
        <Text oauStyle="label" numberOfLines={1} className="text-foreground">
          {row.venue.name}
        </Text>
        {detail ? (
          <Text oauStyle="caption" numberOfLines={1} className="text-muted-foreground">
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Rows under the distance bands: within 1 km, 1 - 5 km, 5 - 25 km, further. */
function bandsOf(rows: PlaceRow[]): { label: string | null; rows: PlaceRow[] }[] {
  // No origin, no distances: one card, no bands.
  if (rows.every((row) => row.distance === null)) return [{ label: null, rows }];
  const limits = [1000, 5000, 25000, Infinity];
  const bands = T.bands.map((label) => ({ label, rows: [] as PlaceRow[] }));
  for (const row of rows) {
    const at = limits.findIndex((limit) => (row.distance ?? Infinity) < limit);
    bands[at === -1 ? bands.length - 1 : at].rows.push(row);
  }
  return bands.filter((band) => band.rows.length > 0);
}

type ListData = ReturnType<typeof useListRows>;

/** The sheet's and panel's title: how many places, where; the distance; refresh. */
function PlacesHeader({
  data,
  where,
  refreshing,
  onRefresh,
  settingsOpen,
  onToggleSettings,
}: {
  data: ListData;
  where: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
}) {
  const count = data.places ? data.places.nearby.length + data.places.online.length : null;
  return (
    <View className="flex-row items-start gap-3 px-5 pb-3 pt-1">
      <View className="flex-1 gap-0.5">
        <Text oauStyle="heading" role="heading" className="text-foreground">
          {count === null ? (
            T.placesLoading(where)
          ) : (
            <>
              <Text oauStyle="heading" className="text-primary">
                {count}
              </Text>
              {` ${T.placesWord(count)} ${T.near(where)}`}
            </>
          )}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-1.5">
          <Text oauStyle="callout" className="text-muted-foreground">
            {DISTANCE_TEXT.within(data.km)}
            {data.filter !== 'all' ? ` · ${LIST_FILTER_TEXT[data.filter].label}` : ''} ·
          </Text>
          <Pressable
            onPress={onToggleSettings}
            accessibilityRole="button"
            accessibilityLabel={T.changeSpoken}
            accessibilityState={{ expanded: settingsOpen }}
            hitSlop={8}
            className={cn('active:opacity-60', Platform.select({ web: 'cursor-pointer' }))}>
            <Text oauStyle="callout" className="font-semibold text-primary">
              {settingsOpen ? T.done : T.change}
            </Text>
          </Pressable>
        </View>
      </View>
      <IconSticker
        icon={RotateCw}
        label={refreshing ? T.refreshing : T.refresh}
        onPress={onRefresh}
        spinning={refreshing}
      />
    </View>
  );
}

/** Under the header: the ruler and the filter while "Change" is open, then the places by band. */
function PlacesBody({
  data,
  settingsOpen,
  onSelect,
  onLocate,
}: {
  data: ListData;
  settingsOpen: boolean;
  onSelect: (venue: NearbyVenue) => void;
  onLocate: (venue: NearbyVenue) => void;
}) {
  const { places, loading, failed, retry, km, filter, counts } = data;
  return (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-4 px-4 pb-8 pt-1">
      {settingsOpen ? (
        <OauCard className="gap-4 p-4">
          <DistanceMeter />
          <ListFilterControl counts={counts} />
        </OauCard>
      ) : null}

      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator />
        </View>
      ) : failed ? (
        <View className="items-center gap-3 py-8">
          <Text oauStyle="callout" className="text-center text-muted-foreground">
            {LIST_TEXT.failed}
          </Text>
          <Button variant="secondary" size="sm" onPress={retry}>
            <Text>{LIST_TEXT.retry}</Text>
          </Button>
        </View>
      ) : places && places.nearby.length + places.online.length > 0 ? (
        <>
          {bandsOf(places.nearby).map((band, index) => (
            <View key={band.label ?? index} className="gap-2">
              {band.label ? (
                <Text oauStyle="overline" className="px-1 text-muted-foreground">
                  {band.label}
                </Text>
              ) : null}
              <OauCard>
                {band.rows.map((row, rowIndex) => (
                  <PlaceRowCard
                    key={row.venue.id}
                    row={row}
                    first={rowIndex === 0}
                    onSelect={onSelect}
                    onLocate={onLocate}
                  />
                ))}
              </OauCard>
            </View>
          ))}
          {places.online.length > 0 ? (
            <OnlineSection rows={places.online} open={false} onSelect={onSelect} onLocate={onLocate} />
          ) : null}
        </>
      ) : (
        <View className="gap-1 py-8">
          <Text oauStyle="subheading" className="text-center text-foreground">
            {filter !== 'all' && counts.all > 0 ? LIST_FILTER_TEXT.empty(filter, km) : LIST_TEXT.empty(km)}
          </Text>
          <Text oauStyle="callout" className="text-center text-muted-foreground">
            {filter !== 'all' && counts.all > 0 ? LIST_FILTER_TEXT.emptyHint : LIST_TEXT.emptyHint}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

export type OauMapChromeProps = {
  /** Where the list looks around and measures from: the user, or the map's middle. */
  origin: Coords | null;
  /** Biases the search toward what is on screen. */
  searchOrigin: Coords | null;
  refreshKey: string;
  refreshing: boolean;
  onRefresh: () => void;
  /** The place whose card is open, from a pin or a row. */
  venue: NearbyVenue | null;
  onSelectVenue: (venue: NearbyVenue) => void;
  onCloseVenue: () => void;
  onWriteReview: (venue: NearbyVenue) => void;
  onLocate: (venue: NearbyVenue) => void;
  onPickPlace: (place: PlaceResult) => void;
  onClearPlace: () => void;
  following: boolean;
  usingLocation: boolean;
  onRecenter: () => void;
};

export function OauMapChrome(props: OauMapChromeProps) {
  const { isWide } = useIsWideViewport();
  const { place } = useMapLocation();
  const data = useListRows(props.origin, '', props.refreshKey);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  // The list follows the middle of the map once it is panned: named after
  // where it is, not after the city chosen when the map opened.
  const placeName = useListPlaceName(props.origin, props.following, place);
  const where =
    placeName.kind === 'you' ? null : placeName.kind === 'named' ? placeName.label : T.mapMiddle;
  const count = data.places ? data.places.nearby.length + data.places.online.length : 0;

  // How far the open card's place is, measured here on the device: a row
  // knows it already; a pin's is worked out from the same origin.
  const distance = React.useMemo(() => {
    const venue = props.venue;
    if (!venue || !isMapped(venue) || !props.origin) return null;
    return distanceMeters(props.origin, { latitude: venue.lat, longitude: venue.lng });
  }, [props.venue, props.origin]);

  const header = (
    <PlacesHeader
      data={data}
      where={where}
      refreshing={props.refreshing}
      onRefresh={props.onRefresh}
      settingsOpen={settingsOpen}
      onToggleSettings={() => setSettingsOpen((open) => !open)}
    />
  );

  const shell = { data, header, settingsOpen, count, distance, title: T.places(count, where) };
  return isWide ? <WidePanel {...props} {...shell} /> : <NarrowSheet {...props} {...shell} />;
}

type ShellProps = OauMapChromeProps & {
  data: ListData;
  header: React.ReactNode;
  settingsOpen: boolean;
  count: number;
  distance: number | null;
  /** Read out as the sheet's name while it shows the list. */
  title: string;
};

/** The card for the open place, keyed by it so each opens fresh. */
function Card({
  props,
  children,
}: {
  props: ShellProps;
  children: Parameters<typeof OauPlaceCard>[0]['children'];
}) {
  const venue = props.venue;
  if (!venue) return null;
  return (
    <OauPlaceCard
      key={venue.id}
      venue={venue}
      distance={props.distance}
      back={{ label: T.back(props.count), onPress: props.onCloseVenue }}
      onClose={props.onCloseVenue}
      onWriteReview={() => props.onWriteReview(venue)}>
      {children}
    </OauPlaceCard>
  );
}

/**
 * From 768 wide (section 14.14): a 400-wide panel down the leading side, 16
 * from the edges, the search bar at its top, then the list or the open card.
 * The location sticker stays bottom-trailing on the map.
 */
function WidePanel(props: ShellProps) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        className={cn(
          'absolute bottom-4 left-4 top-4 w-[400px] overflow-hidden rounded-[18px] border border-border bg-background',
          SHADOW_WEB
        )}>
        <PaperBackdrop tab="map" />
        {/* The search bar's own z-20 only ranks it inside this view, which
            on the website is a stacking context of its own (every view is
            z-index 0 there): without this one too, the list's header that
            follows paints over the results. */}
        <View className="z-20 px-4 pb-3 pt-4">
          <OauSearchBar
            origin={props.searchOrigin}
            rows={props.data.everyRow}
            measureFrom={props.origin}
            onPick={props.onPickPlace}
            onPickVenue={props.onSelectVenue}
            onClear={props.onClearPlace}
          />
        </View>
        {props.venue ? (
          <Card props={props}>
            {({ header, content }) => (
              <View className="flex-1">
                {header}
                <View className="flex-1">{content}</View>
              </View>
            )}
          </Card>
        ) : (
          <View className="flex-1">
            {props.header}
            <PlacesBody
              data={props.data}
              settingsOpen={props.settingsOpen}
              onSelect={props.onSelectVenue}
              onLocate={props.onLocate}
            />
          </View>
        )}
      </View>
      <RecenterButton
        following={props.following}
        usingLocation={props.usingLocation}
        onPress={props.onRecenter}
      />
    </View>
  );
}

/** Before the header has been measured: the grabber and the title's two lines. */
const PEEK_GUESS = 92;
type Detent = 'peek' | 'half' | 'full';

/**
 * On a phone and the narrow website (sections 14.2 and 14.3): the search bar
 * floating at the top, under Leave now's reserve, and the places as a sheet
 * over the map at three heights - peek, half and full - dragged by its header,
 * the grabber pressed to step through them. Opening a card raises it to half;
 * the map stays usable above it, so nothing dims.
 */
function NarrowSheet(props: ShellProps) {
  const insets = useSafeAreaInsets();
  const leaveNow = useLeaveNowReserve();
  const [available, setAvailable] = React.useState(0);
  // Only the header shows at peek - the list's title or the card's - measured,
  // since a long place name or a large text size makes it taller.
  const [headerHeight, setHeaderHeight] = React.useState(PEEK_GUESS);
  const PEEK = Math.max(64, headerHeight);
  const measureHeader = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0 && next !== headerHeight) setHeaderHeight(next);
  };
  const searchTop = insets.top + leaveNow.top + 12;
  // Full height stops under the search bar.
  const full = Math.max(PEEK, available - (searchTop + 52 + 12));
  const half = Math.min(full, Math.max(PEEK, Math.round(available * 0.55)));
  const heights: Record<Detent, number> = { peek: PEEK, half, full };

  const [detent, setDetent] = React.useState<Detent>('peek');
  const height = useSharedValue(PEEK_GUESS);
  const start = useSharedValue(0);

  const snapTo = setDetent;
  const target = heights[detent];

  // The sheet follows its detent - a drag, the grabber, a card opening - and
  // stays at it when the window changes size.
  React.useEffect(() => {
    if (available === 0) return;
    height.set(withSpring(target, { ...materialSpring('defaultSpatial', true), overshootClamping: true }));
  }, [available, target, height]);

  // A card opens at half; closing it goes back to the list where it was.
  // Worked out while rendering, so the sheet never draws a frame at the old height.
  const venueId = props.venue?.id ?? null;
  const [returnTo, setReturnTo] = React.useState<Detent>('peek');
  const [shownVenue, setShownVenue] = React.useState<string | null>(null);
  if (venueId !== shownVenue) {
    setShownVenue(venueId);
    if (venueId && !shownVenue) {
      setReturnTo(detent);
      if (detent === 'peek') setDetent('half');
    } else if (!venueId) {
      setDetent(returnTo);
    }
  }

  const order: Detent[] = ['peek', 'half', 'full'];
  const stops = [PEEK, half, full];
  const drag = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      start.set(height.get());
    })
    .onUpdate((event) => {
      height.set(Math.min(stops[2], Math.max(stops[0], start.get() - event.translationY)));
    })
    .onEnd((event) => {
      const projected = height.get() - event.velocityY * 0.18;
      let best = 0;
      for (let i = 1; i < stops.length; i++) {
        if (Math.abs(stops[i] - projected) < Math.abs(stops[best] - projected)) best = i;
      }
      height.set(withSpring(stops[best], { ...materialSpring('defaultSpatial', true), overshootClamping: true }));
      runOnJS(setDetent)(order[best]);
    });

  const sheetStyle = useAnimatedStyle(() => ({ height: height.get() }));
  const next: Detent = detent === 'peek' ? 'half' : detent === 'half' ? 'full' : 'peek';

  const grabber = (
    <Pressable
      onPress={() => snapTo(next)}
      accessibilityRole="button"
      accessibilityLabel={detent === 'full' ? T.showLess : T.showMore}
      hitSlop={8}
      className={cn('items-center pb-1.5 pt-2.5', Platform.select({ web: 'cursor-grab' }))}>
      <View className="h-[5px] w-9 rounded-full bg-foreground/25" />
    </Pressable>
  );

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(event: LayoutChangeEvent) => setAvailable(event.nativeEvent.layout.height)}>
      {/* Above the sheet that follows it, or a half-open sheet covers the results. */}
      <View pointerEvents="box-none" className="absolute left-4 right-4 z-20" style={{ top: searchTop }}>
        <OauSearchBar
          origin={props.searchOrigin}
          rows={props.data.everyRow}
          measureFrom={props.origin}
          onPick={props.onPickPlace}
          onPickVenue={props.onSelectVenue}
          onClear={props.onClearPlace}
        />
      </View>

      {detent !== 'full' ? (
        <RecenterButton
          following={props.following}
          usingLocation={props.usingLocation}
          onPress={props.onRecenter}
          bottom={heights[detent] + 16}
        />
      ) : null}

      <Animated.View
        style={sheetStyle}
        role="region"
        aria-label={props.venue ? props.venue.name : props.title}
        className={cn(
          'absolute bottom-0 left-0 right-0 overflow-hidden rounded-t-[28px] border-t border-border bg-background',
          SHADOW_WEB
        )}>
        <PaperBackdrop tab="map" />
        {props.venue ? (
          <Card props={props}>
            {({ header, content }) => (
              <View className="flex-1">
                <GestureDetector gesture={drag}>
                  <View onLayout={measureHeader}>
                    {grabber}
                    {header}
                  </View>
                </GestureDetector>
                <View className="flex-1">{content}</View>
              </View>
            )}
          </Card>
        ) : (
          <View className="flex-1">
            <GestureDetector gesture={drag}>
              <View onLayout={measureHeader}>
                {grabber}
                {props.header}
              </View>
            </GestureDetector>
            <PlacesBody
              data={props.data}
              settingsOpen={props.settingsOpen}
              onSelect={props.onSelectVenue}
              onLocate={(venue) => {
                // Lower the sheet so the pin it goes to can be seen.
                snapTo('peek');
                props.onLocate(venue);
              }}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
}
