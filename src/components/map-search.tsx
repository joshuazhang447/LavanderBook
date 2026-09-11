import { ArrowLeft, MapPin, Search, X } from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useIsWideViewport } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { PlaceResult } from '@/lib/place-search';
import { searchPlaces } from '@/lib/place-search';
import type { Coords } from '@/lib/use-location';

/** Past this the dropdown covers the map it is meant to be searching. */
const MAX_VISIBLE_RESULTS = 5;

/** Long enough to read as the field growing, short enough not to delay typing. */
const EXPAND_MS = 220;

/**
 * How long a pause in typing counts as "done".
 *
 * Tuned rather than picked: much below this and an average typist fires a
 * search - a billed one - between words. Much above and the results feel like
 * they are lagging behind the keyboard.
 */
const TYPING_PAUSE_MS = 420;

/**
 * Shorter than this and the results are noise, so the call is not worth making.
 * "Ki" matches half of Ottawa; "Kin" is a search.
 */
const MIN_QUERY_CHARS = 3;

/** Matches the `left` the controls row is positioned at, and its margin on the right. */
const ROW_INSET = 12;

/** The icon button and the clear button, which the text field must not overlap. */
const CHROME_WIDTH = 76;

/** Never so narrow that a place name is unreadable, never wider than it needs. */
const MIN_FIELD = 120;
const MAX_FIELD = 300;

/** Below the pill, clearing its 44pt height plus a small gap. */
const DROPDOWN_TOP = 52;
const MAX_DROPDOWN = 320;

/**
 * A bare TextInput, not the reusables Input, and the one place in the app that
 * departs from "always use ui/".
 *
 * The Input ships a border, a drop shadow and a 3px focus ring, all of which
 * draw at or outside the edge of the text box - and this text box lives inside
 * an overflow-hidden container that clips them into stray fragments. Unsetting
 * them one by one did not hold: border-0, shadow-none, focus-visible:ring-0,
 * underlineColorAndroid and an explicit borderWidth:0 each removed a piece and
 * something kept drawing. Starting from nothing is the only version that can
 * be reasoned about, and a search field inside a pill needs none of what the
 * Input provides - the pill is the affordance.
 */
const fieldStyles = StyleSheet.create({
  field: {
    height: 36,
    flex: 1,
    margin: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});

type MapSearchProps = {
  /** Biases the ordering. Null while the first fix is still coming in. */
  origin: Coords | null;
  onPick: (place: PlaceResult) => void;
  /** Clearing the box also takes the pin off the map. */
  onClear: () => void;
  /**
   * Controlled, because the rest of the controls row has to know: on a phone
   * those buttons stand down while this is open so the field gets the width.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Search for any place, reviewed or not - a button in the controls row that
 * expands into a text field.
 *
 * Collapsed by default, and collapsed is the same size and shape as the refresh
 * button beside it: the map is the point of this tab, and a permanent bar
 * across the top is a permanent cost paid by everyone who never searches.
 *
 * Searches on a pause in typing. Each one is a billed Places call, so the
 * guards below matter more than they would over a local index: nothing under
 * MIN_QUERY_CHARS, never the same string twice, and the edge function caches
 * repeats on top of that.
 *
 * This is the opposite bargain from the List tab, which searches reviewed
 * venues only and is free because it never leaves Postgres. Both exist on
 * purpose: the list answers "where that people rated", this answers "where is".
 */
export function MapSearch({ origin, onPick, onClear, open, onOpenChange }: MapSearchProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<PlaceResult[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  // Where the pill sits in the controls row, so the field can expand into
  // exactly the space left on screen rather than a guessed width.
  const [pillX, setPillX] = React.useState(0);

  // Bumped on every search so a response that arrives after a newer one, or
  // after the box was closed, is dropped rather than replacing what is shown.
  const requestId = React.useRef(0);
  // The last string actually sent. Stops a re-render, or the map drifting
  // under a stationary user, from paying for the same search twice.
  const lastSearched = React.useRef<string | null>(null);

  // Read inside the debounce rather than closed over, so the map moving does
  // not restart the timer and delay the search the user is waiting for.
  const originRef = React.useRef(origin);
  React.useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  const trimmed = query.trim();

  /**
   * On a phone the rest of the controls row collapses while this is open, which
   * slides the pill to the left margin. Target where it will END UP, not where
   * it is: both animations run over the same duration, so reading the live
   * position would retarget the field's width on every frame of the collapse.
   */
  const { isWide } = useIsWideViewport();
  const yielded = open && !isWide;
  const anchorX = yielded ? 0 : pillX;

  const available = windowWidth - (ROW_INSET + anchorX) - ROW_INSET - CHROME_WIDTH;
  const fieldWidth = Math.max(MIN_FIELD, Math.min(MAX_FIELD, available));
  const dropdownWidth = Math.min(MAX_DROPDOWN, windowWidth - ROW_INSET * 2);

  const width = useSharedValue(0);
  React.useEffect(() => {
    width.set(
      withTiming(open ? fieldWidth : 0, {
        duration: EXPAND_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [open, fieldWidth, width]);

  const fieldStyle = useAnimatedStyle(() => ({ width: width.get() }));

  const run = React.useCallback(async (q: string) => {
    const id = ++requestId.current;
    lastSearched.current = q;
    setBusy(true);
    setError(null);

    const outcome = await searchPlaces(q, originRef.current);
    if (id !== requestId.current) return;

    if (outcome.ok) {
      setResults(outcome.results);
    } else {
      setResults(null);
      setError(outcome.message);
    }
    setBusy(false);
  }, []);

  // Search when typing stops. The cleanup is what makes it a debounce: every
  // keystroke tears down the pending timer before setting a new one.
  React.useEffect(() => {
    if (!open) return;
    if (trimmed.length < MIN_QUERY_CHARS) return;
    if (trimmed === lastSearched.current) return;

    const timer = setTimeout(() => void run(trimmed), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [open, trimmed, run]);

  function reset() {
    // Invalidate anything in flight, or its results would repopulate the list
    // moments after the user emptied it.
    requestId.current++;
    lastSearched.current = null;
    setQuery('');
    setResults(null);
    setError(null);
    setBusy(false);
  }

  function toggle() {
    if (open) reset();
    onOpenChange(!open);
  }

  function change(next: string) {
    setQuery(next);
    // Emptying the box should empty the dropdown with it, rather than leaving
    // the last search hanging over a map the user is now looking at.
    if (next.trim().length < MIN_QUERY_CHARS) {
      requestId.current++;
      lastSearched.current = null;
      setResults(null);
      setError(null);
      setBusy(false);
    }
  }

  function pick(place: PlaceResult) {
    // Collapse the dropdown but keep the field open with its text: the map has
    // moved, and the query is the label for why it moved.
    setResults(null);
    onPick(place);
  }

  return (
    <View
      onLayout={(event) => {
        // Only while the row is settled. Measuring through the collapse would
        // feed a moving number into the width above.
        if (!yielded) setPillX(event.nativeEvent.layout.x);
      }}>
      <View className="flex-row items-center rounded-full bg-background p-1 shadow-md">
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close search' : 'Search for a place'}
          accessibilityState={{ expanded: open }}
          className="rounded-full px-3 py-2 active:opacity-70">
          {/* A back arrow while open: in that state the button's job is to undo
              the thing it just did, and a magnifying glass would read as
              "search now" next to a field that already searches on its own. */}
          <Icon as={open ? ArrowLeft : Search} className="size-5 text-foreground" />
        </Pressable>

        {/* The pill grows because this does: the icon stays put and the field
            unrolls to the right of it. overflow-hidden is what clips the text
            field while it is narrower than its contents. */}
        <Animated.View style={fieldStyle} className="overflow-hidden">
          {open ? (
            // Fixed width inside the animated clip, so the field does not
            // reflow - and the text jump around - on every frame of the expand.
            <View style={{ width: fieldWidth }} className="flex-row items-center">
              <TextInput
                value={query}
                onChangeText={change}
                onSubmitEditing={() => {
                  // Enter is an override, not the only way in: it searches at
                  // once rather than waiting out the pause.
                  if (trimmed.length > 0 && trimmed !== lastSearched.current) void run(trimmed);
                }}
                placeholder="Search any place"
                returnKeyType="search"
                autoCorrect={false}
                // Opened by a deliberate press, so the keyboard should already
                // be on its way up - one press to search rather than two.
                autoFocus
                blurOnSubmit={trimmed.length > 0}
                // Android gives an EditText a background drawable of its own,
                // drawn by the platform behind the view where no style reaches.
                underlineColorAndroid="transparent"
                style={fieldStyles.field}
                // Colour only. outline-none is the web half of the same job the
                // style above does natively: react-native-web would otherwise
                // draw the browser's focus outline around the field.
                className="text-foreground placeholder:text-muted-foreground outline-none"
              />
              {busy ? (
                <ActivityIndicator size="small" className="mr-2" />
              ) : query.length > 0 ? (
                <Pressable
                  onPress={() => {
                    reset();
                    onClear();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  className="mr-1 p-1 active:opacity-60">
                  <Icon as={X} className="size-4 text-muted-foreground" />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </View>

      {/* Anchored to the pill's right edge rather than its left: the pill ends
          near the screen edge when open, so a dropdown wider than the field
          still lands on screen. */}
      {open && (error || results !== null) ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          style={{ top: DROPDOWN_TOP, right: 0, width: dropdownWidth }}
          className="absolute overflow-hidden rounded-xl border border-border bg-card shadow-md">
          {error ? (
            <View className="px-4 py-3">
              <Text className="text-sm text-muted-foreground">{error}</Text>
            </View>
          ) : results && results.length === 0 ? (
            <View className="px-4 py-3">
              <Text className="text-sm text-muted-foreground">Nothing found for “{trimmed}”.</Text>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              {(results ?? []).slice(0, MAX_VISIBLE_RESULTS).map((place, index) => (
                <Animated.View
                  key={place.placeId}
                  entering={FadeInDown.duration(180).delay(index * 30)}>
                  <Pressable
                    onPress={() => pick(place)}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${place.name} on the map`}
                    className={`flex-row items-center gap-3 px-4 py-3 active:bg-accent ${
                      index > 0 ? 'border-t border-border' : ''
                    }`}>
                    <Icon as={MapPin} className="size-4 shrink-0 text-muted-foreground" />
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text numberOfLines={1} className="flex-1 font-medium text-foreground">
                          {place.name}
                        </Text>
                        {/* Says why picking this will move the map and stop
                            there, rather than leaving the missing rate pin
                            looking like a bug. */}
                        {place.reviewable === false ? (
                          <Text className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            Area
                          </Text>
                        ) : null}
                      </View>
                      {place.address ? (
                        <Text numberOfLines={1} className="text-xs text-muted-foreground">
                          {place.address}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}
