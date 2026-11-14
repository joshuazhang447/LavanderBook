import { MapPin, Search, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { DIALOG_WIDTH, useDialogMaxHeight } from '@/components/info-dialog';
import { IconSticker, OauCard, OauRow } from '@/components/oau/card';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { PlaceSearchField } from '@/components/venue-list';
import { countryName } from '@/lib/general-area';
import { chooseCity, chooseGeneralArea, useMapLocation, type SavedCity } from '@/lib/map-location';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/** Enough to scan, few enough that every keystroke is instant. */
const MAX_RESULTS = 40;

export type City = SavedCity & {
  /** Name only, folded for matching. */
  nameKey: string;
  /** Name, region and country, folded, so "london ontario" finds the right one. */
  fullKey: string;
};

/** Lower case without accents, so "montreal" finds Montréal. */
function fold(text: string): string {
  try {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  } catch {
    return text.toLowerCase();
  }
}

let citiesPromise: Promise<City[]> | null = null;

/**
 * The bundled GeoNames list - about 12,000 cities, most populous first - loaded
 * the first time a picker opens rather than at startup. Searching it never
 * leaves the device: typing a city name tells nobody where you are.
 */
export function loadCities(): Promise<City[]> {
  citiesPromise ??= import('@/data/geonames/cities.json').then((module) =>
    (module.default as unknown as [string, string, string, number, number][]).map(
      ([name, region, country, latitude, longitude]) => ({
        name,
        region,
        country,
        latitude,
        longitude,
        nameKey: fold(name),
        fullKey: fold(`${name} ${region} ${countryName(country)}`),
      })
    )
  );
  return citiesPromise;
}

export function searchCities(cities: City[], query: string, preferCountry: string | null): City[] {
  const q = fold(query.trim());
  if (!q) {
    // Nothing typed: the biggest cities in the country the phone points at.
    const home = preferCountry ? cities.filter((city) => city.country === preferCountry) : [];
    return (home.length > 0 ? home : cities).slice(0, MAX_RESULTS);
  }
  // Names that start with what was typed first, then anything that contains
  // it; each group stays in population order, which the file already is.
  const starts: City[] = [];
  const contains: City[] = [];
  for (const city of cities) {
    if (city.nameKey.startsWith(q)) starts.push(city);
    else if (city.fullKey.includes(q)) contains.push(city);
    if (starts.length >= MAX_RESULTS) break;
  }
  return [...starts, ...contains].slice(0, MAX_RESULTS);
}

type CityPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a city or the general area was chosen. */
  onChosen?: () => void;
};

/**
 * Pick the city the map opens on. Offline, and stored on this device only.
 *
 * Offers the general area at the top too, so somebody who picked a city can
 * get back to it without knowing where else to look.
 */
/** The picker's state and choices, shared by every skin's look of it. */
function useCityPicker({ open, onOpenChange, onChosen }: CityPickerProps) {
  const { area } = useMapLocation();
  const [cities, setCities] = React.useState<City[] | null>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!open || cities) return;
    let active = true;
    loadCities().then((list) => active && setCities(list));
    return () => {
      active = false;
    };
  }, [open, cities]);

  const results = React.useMemo(
    () => (cities ? searchCities(cities, query, area?.countryCode ?? null) : []),
    [cities, query, area?.countryCode]
  );

  async function pick(action: () => Promise<void>) {
    await action();
    setQuery('');
    onOpenChange(false);
    onChosen?.();
  }

  function pickCity(city: City) {
    void pick(() =>
      chooseCity({
        name: city.name,
        region: city.region,
        country: city.country,
        latitude: city.latitude,
        longitude: city.longitude,
      })
    );
  }

  return { area, cities, query, setQuery, results, pick, pickCity };
}

export function CityPicker(props: CityPickerProps) {
  const { skin } = useSkin();
  // OAU's is a full sheet (oau-style-guide.md, section 14.13); the others keep the window.
  if (skin === 'oau') return props.open ? <OauCityPicker {...props} /> : null;
  return <WindowCityPicker {...props} />;
}

/**
 * OAU's city picker: a tall paper sheet - the search field, the general area
 * under "Suggested", the cities as rows on a card - with the GeoNames credit
 * at its foot, which the licence asks for.
 */
function OauCityPicker(props: CityPickerProps) {
  const { area, cities, query, setQuery, results, pick, pickCity } = useCityPicker(props);
  const close = () => props.onOpenChange(false);

  return (
    <BottomSheet
      name="oau-city-picker"
      onClose={close}
      accessibilityLabel="Choose a city"
      partial={0.88}
      keyboardAvoiding
      header={
        <View className="gap-3 px-5 pb-3 pt-1">
          <View className="flex-row items-center gap-3">
            <Text oauStyle="title" role="heading" className="flex-1 text-foreground">
              Choose a city
            </Text>
            <IconSticker icon={X} label="Close" onPress={close} />
          </View>
          <Text oauStyle="callout" className="text-muted-foreground">
            The map opens here. Your choice stays on this phone.
          </Text>
          <PlaceSearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search cities"
            accessibilityLabel="Search cities"
          />
        </View>
      }>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 px-5 pb-8 pt-1">
        {area && !query.trim() ? (
          <View className="gap-2">
            <Text oauStyle="overline" className="px-1 text-muted-foreground">
              Suggested
            </Text>
            <OauCard>
              <OauRow
                first
                icon={MapPin}
                iconCircle="bg-positive"
                iconGlyph="text-positive-foreground"
                title={area.label}
                detail="From your phone's settings"
                onPress={() => void pick(chooseGeneralArea)}
              />
            </OauCard>
          </View>
        ) : null}
        {cities === null ? (
          <View className="py-6">
            <ActivityIndicator />
          </View>
        ) : results.length === 0 ? (
          <Text oauStyle="callout" className="py-6 text-center text-muted-foreground">
            No city by that name. Try a bigger city nearby.
          </Text>
        ) : (
          <OauCard>
            {results.map((city, index) => (
              <OauRow
                key={`${city.name}|${city.region}|${city.country}|${city.latitude}`}
                first={index === 0}
                title={city.name}
                detail={city.region ? `${city.region}, ${countryName(city.country)}` : countryName(city.country)}
                onPress={() => pickCity(city)}
              />
            ))}
          </OauCard>
        )}
        {/* CC BY 4.0 asks for credit where the data is used. See
            src/data/geonames/CREDITS.md. */}
        <Text oauStyle="caption" className="text-center text-muted-foreground">
          City list © GeoNames (geonames.org), CC BY 4.0
        </Text>
      </ScrollView>
    </BottomSheet>
  );
}

function WindowCityPicker(props: CityPickerProps) {
  const { open, onOpenChange } = props;
  const maxHeight = useDialogMaxHeight();
  const { height } = useWindowDimensions();
  const { area, cities, query, setQuery, results, pick, pickCity } = useCityPicker(props);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_WIDTH} style={{ maxHeight }}>
        <DialogHeader>
          <DialogTitle>Choose a city</DialogTitle>
          <DialogDescription>
            The map opens here. Your choice stays on this phone.
          </DialogDescription>
        </DialogHeader>

        <View className="flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
          <Icon as={Search} className="size-4 text-muted-foreground" />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search cities"
            autoCorrect={false}
            autoCapitalize="words"
            className="flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
          />
        </View>

        {/* A fixed share of the screen rather than everything left: with the
            keyboard up, a list running to the bottom of a centred dialog would
            sit behind it, while this keeps the first results above it. */}
        <ScrollView
          className="shrink grow-0"
          style={{ maxHeight: Math.round(height * 0.32) }}
          keyboardShouldPersistTaps="handled">
          {area && !query.trim() ? (
            <CityRow
              icon={MapPin}
              title={area.label}
              detail="From your phone's settings"
              onPress={() => void pick(chooseGeneralArea)}
            />
          ) : null}
          {cities === null ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : results.length === 0 ? (
            <Text className="py-6 text-center text-sm text-muted-foreground">
              No city by that name. Try a bigger city nearby.
            </Text>
          ) : (
            results.map((city) => (
              <CityRow
                key={`${city.name}|${city.region}|${city.country}|${city.latitude}`}
                title={city.name}
                detail={city.region ? `${city.region}, ${countryName(city.country)}` : countryName(city.country)}
                onPress={() => pickCity(city)}
              />
            ))
          )}
        </ScrollView>

        {/* CC BY 4.0 asks for credit where the data is used. See
            src/data/geonames/CREDITS.md. */}
        <Text className="text-center text-[11px] text-muted-foreground">
          City list © GeoNames (geonames.org), CC BY 4.0
        </Text>
      </DialogContent>
    </Dialog>
  );
}

type CityRowProps = {
  icon?: typeof MapPin;
  title: string;
  detail: string;
  onPress: () => void;
};

function CityRow({ icon, title, detail, onPress }: CityRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
      className={cn(
        'flex-row items-center gap-3 rounded-md px-2 py-2.5 active:bg-accent',
        Platform.select({ web: 'cursor-pointer hover:bg-accent/50' })
      )}>
      {icon ? <Icon as={icon} className="size-4 text-muted-foreground" /> : null}
      <View className="flex-1">
        <Text numberOfLines={1} className="text-sm font-medium text-foreground">
          {title}
        </Text>
        <Text numberOfLines={1} className="text-xs text-muted-foreground">
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}
