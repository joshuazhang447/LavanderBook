import { useFocusEffect } from 'expo-router';
import { CircleX, MapPin, Navigation, NavigationOff, RotateCw, Search, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  View,
  type TextInput,
} from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, GlassButton, GlassGroup } from '@/components/glass';
import { useLeaveNowReserve } from '@/components/leave-now';
import type { MapViewMode } from '@/components/map-controls';
import { usePlaceSearch } from '@/components/map-search';
import { useChenfengTopInset, useTabBarOverlap } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { EmptyState, Row, Section } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { useDisplaySettings } from '@/lib/accessibility';
import { closeMapSearch, useMapSearchOpen } from '@/lib/map-search-state';
import type { PlaceResult } from '@/lib/place-search';
import { cn } from '@/lib/utils';
import type { Coords } from '@/lib/use-location';

/** From the top safe area and the screen's sides. */
const EDGE = 16;
/** Map's controls, one row tall. */
const CONTROL = 44;

/**
 * How far down the list starts, under the controls - for Chenfeng's list,
 * which runs under them on its own scroll edge.
 */
export function useChenfengControlsBottom(): number {
  const topInset = useChenfengTopInset();
  const leaveNow = useLeaveNowReserve();
  return topInset + leaveNow.top + EDGE + CONTROL;
}

const VIEW_SEGMENTS = [
  { value: 'map', label: 'Map' },
  { value: 'list', label: 'List' },
] as const;

/** Spins once per press - the press, not the network: see REFRESH_SPIN_MS. */
function RefreshSymbol({ refreshing }: { refreshing: boolean }) {
  const { reduceMotion } = useDisplaySettings();
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (!refreshing || reduceMotion) return;
    cancelAnimation(rotation);
    rotation.set(0);
    rotation.set(withTiming(360, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
  }, [refreshing, rotation, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <Animated.View style={style}>
      <Icon as={RotateCw} size={19} weight="medium" strokeWidth={2.25} className="text-foreground" />
    </Animated.View>
  );
}

type ControlsProps = {
  mode: MapViewMode;
  onChangeMode: (mode: MapViewMode) => void;
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * The top of the Map tab: the Map | List switch centred where a toolbar's
 * principal item sits, and refresh at the trailing corner - both glass, both
 * monochrome over the colourful map. On a phone's browser they move down a
 * row, clear of "Leave now".
 */
export function ChenfengMapControls({ mode, onChangeMode, refreshing, onRefresh }: ControlsProps) {
  const insets = useSafeAreaInsets();
  const topInset = useChenfengTopInset();
  const leaveNow = useLeaveNowReserve();
  const top = topInset + leaveNow.top + EDGE - 4;

  return (
    <View
      pointerEvents="box-none"
      style={{ top, left: insets.left + EDGE, right: insets.right + EDGE, height: CONTROL }}
      className="absolute flex-row items-center justify-center">
      <GlassGroup className="flex-row items-center">
        <Glass radius={CONTROL / 2} overMap style={{ height: CONTROL, width: 210, padding: 4 }}>
          <Segmented
            segments={VIEW_SEGMENTS}
            value={mode}
            onChange={onChangeMode}
            accessibilityLabel="View"
            drawn
            onGlass
            large
          />
        </Glass>
      </GlassGroup>
      <View className="absolute right-0" pointerEvents="box-none">
        <GlassButton
          overMap
          onPress={onRefresh}
          accessibilityLabel={refreshing ? 'Refreshing' : 'Refresh'}>
          <RefreshSymbol refreshing={refreshing} />
        </GlassButton>
      </View>
    </View>
  );
}

type LocateProps = {
  following: boolean;
  usingLocation: boolean;
  onPress: () => void;
};

/**
 * Where iOS puts it: a glass circle at the bottom trailing corner, 16 above the
 * tab bar. location.fill in the tint while following, location while not, and
 * location.slash when the map is not on the device's position at all - then
 * pressing it offers the choice instead of recentring.
 */
export function ChenfengLocateButton({ following, usingLocation, onPress }: LocateProps) {
  const insets = useSafeAreaInsets();
  const tabBarOverlap = useTabBarOverlap();
  return (
    <View
      pointerEvents="box-none"
      className="absolute"
      style={{ right: insets.right + EDGE, bottom: (tabBarOverlap || insets.bottom) + EDGE }}>
      <GlassButton
        overMap
        onPress={onPress}
        accessibilityLabel={
          !usingLocation
            ? 'Use your location, or choose where the map is'
            : following
              ? 'Following your location'
              : 'Recentre on your location'
        }
        accessibilityState={{ selected: following }}>
        <Icon
          as={usingLocation ? Navigation : NavigationOff}
          size={19}
          weight="medium"
          filled={following}
          strokeWidth={2.25}
          className={following ? 'text-primary' : 'text-foreground'}
        />
      </GlassButton>
    </View>
  );
}

/** The typed part in semibold, the rest regular - as Maps' results show it. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) {
    return (
      <Text textStyle="body" numberOfLines={1} className="shrink text-foreground">
        {text}
      </Text>
    );
  }
  return (
    <Text textStyle="body" numberOfLines={1} className="shrink text-foreground">
      {text.slice(0, at)}
      <Text textStyle="body" className="font-semibold text-foreground">
        {text.slice(at, at + query.length)}
      </Text>
      {text.slice(at + query.length)}
    </Text>
  );
}

type SearchProps = {
  mode: MapViewMode;
  origin: Coords | null;
  onPickPlace: (place: PlaceResult) => void;
  /** Emptying the field takes the searched place's pin off the map. */
  onClearPlace: () => void;
  /** The List mode's filter. */
  listQuery: string;
  onListQuery: (query: string) => void;
};

/**
 * Chenfeng's search (guideline section 13.10): the tab bar's search button
 * opens it, and the field takes the bar's place at the bottom of the screen,
 * rising with the keyboard, with a separate glass ✕ beside it to close. It
 * says what it searches: places anywhere on the map, or - while the list is
 * showing - the reviewed places in it, which it filters in place.
 *
 * Searching places is the same billed search the other skins' pill makes
 * (usePlaceSearch, with its guards). The last search stays in the field when
 * it closes, as the reason the map moved; emptying it removes the pin.
 */
export function ChenfengSearch({ mode, origin, onPickPlace, onClearPlace, listQuery, onListQuery }: SearchProps) {
  const open = useMapSearchOpen();
  const places = usePlaceSearch(origin, open && mode === 'map');

  // Leaving the tab closes it: the tab bar stands aside while it is open.
  useFocusEffect(React.useCallback(() => () => closeMapSearch(), []));

  if (!open) return null;

  if (mode === 'list') {
    return (
      <SearchField
        value={listQuery}
        onChangeText={onListQuery}
        placeholder="Search Reviewed Places"
        onClear={() => onListQuery('')}
      />
    );
  }

  return (
    <>
      <PlaceResults
        query={places.trimmed}
        results={places.results}
        error={places.error}
        onPick={(place) => {
          places.setResults(null);
          closeMapSearch();
          onPickPlace(place);
        }}
      />
      <SearchField
        value={places.query}
        onChangeText={places.change}
        placeholder="Search Places"
        busy={places.busy}
        onSubmit={places.submit}
        onClear={() => {
          places.reset();
          onClearPlace();
        }}
      />
    </>
  );
}

function SearchField({
  value,
  onChangeText,
  placeholder,
  busy,
  onSubmit,
  onClear,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  busy?: boolean;
  onSubmit?: () => void;
  onClear: () => void;
}) {
  const insets = useSafeAreaInsets();
  const tabBarOverlap = useTabBarOverlap();
  const keyboard = useReanimatedKeyboardAnimation();
  const fieldRef = React.useRef<TextInput>(null);
  // Where the tab bar's middle was: the field takes its place.
  const rest = tabBarOverlap > 0 ? tabBarOverlap - 62 + 9 : insets.bottom + 24;

  const lift = useAnimatedStyle(() => {
    const above = -keyboard.height.get() + 8;
    return { transform: [{ translateY: -Math.max(0, above - rest) }] };
  });

  return (
    <Animated.View
      style={[{ left: insets.left + EDGE, right: insets.right + EDGE, bottom: rest }, lift]}
      className="absolute max-w-[600px] flex-row items-center gap-2 self-center">
      <Glass radius={22} overMap className="flex-1" style={{ height: 44 }}>
        <View className="h-full flex-row items-center pl-3 pr-1.5">
          <Icon as={Search} size={17} className="text-label-secondary" />
          <Input
            ref={fieldRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            accessibilityLabel={placeholder}
            returnKeyType="search"
            autoCorrect={false}
            // Opened by a deliberate press: the keyboard should be on its way.
            autoFocus
            onSubmitEditing={onSubmit}
            className="h-11 flex-1 bg-transparent px-2"
          />
          {busy ? (
            <ActivityIndicator size="small" className="mr-1.5" />
          ) : value.length > 0 ? (
            <Pressable
              onPress={() => {
                onClear();
                // Ready for the next search, as on the phone. There the emptied
                // field remounts and its autoFocus brings the keyboard back; on
                // the website it stays mounted, and the click had taken focus.
                // A frame later, so a phone focuses the remounted field.
                requestAnimationFrame(() => fieldRef.current?.focus());
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              className={cn('p-1.5 active:opacity-60', Platform.select({ web: 'cursor-pointer' }))}>
              <Icon as={CircleX} size={17} className="text-label-tertiary" />
            </Pressable>
          ) : null}
        </View>
      </Glass>
      <GlassButton overMap onPress={closeMapSearch} accessibilityLabel="Close search">
        <Icon as={X} size={19} weight="medium" strokeWidth={2.25} className="text-foreground" />
      </GlassButton>
    </Animated.View>
  );
}

function PlaceResults({
  query,
  results,
  error,
  onPick,
}: {
  query: string;
  results: PlaceResult[] | null;
  error: string | null;
  onPick: (place: PlaceResult) => void;
}) {
  const topInset = useChenfengTopInset();
  const leaveNow = useLeaveNowReserve();
  const tabBarOverlap = useTabBarOverlap();
  const keyboard = useReanimatedKeyboardAnimation();
  const room = useAnimatedStyle(() => ({
    paddingBottom: Math.max(tabBarOverlap, -keyboard.height.get()) + 76,
  }));

  return (
    <Animated.View
      className="absolute inset-0 bg-background"
      style={[{ paddingTop: topInset + leaveNow.top + 8 }, room]}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {error ? (
          <EmptyState icon={Search} title="Search Isn't Working" description={error} />
        ) : results && results.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No Results for “${query}”`}
            description="Check the spelling or try a new search."
          />
        ) : results ? (
          <Section plain>
            {results.map((place) => (
              <Row
                key={place.placeId}
                leading={
                  <View className="size-[30px] items-center justify-center rounded-full bg-primary">
                    <Icon as={MapPin} size={16} weight="semibold" className="text-white" />
                  </View>
                }
                leadingWidth={30}
                accessibilityLabel={`Show ${place.name} on the map`}
                onPress={() => onPick(place)}>
                <View className="flex-row items-center gap-2">
                  <Highlighted text={place.name} query={query} />
                  {/* Why picking this moves the map and stops there, rather
                      than leaving the missing pin looking like a bug. */}
                  {place.reviewable === false ? (
                    <View className="rounded-full bg-fill-tertiary px-2 py-0.5">
                      <Text textStyle="caption1" className="text-label-secondary">
                        Area
                      </Text>
                    </View>
                  ) : null}
                </View>
                {place.address ? (
                  <Text textStyle="subheadline" numberOfLines={1} className="text-label-secondary">
                    {place.address}
                  </Text>
                ) : null}
              </Row>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}
