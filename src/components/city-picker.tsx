import { MapPin, Search } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { DIALOG_WIDTH, useDialogMaxHeight } from '@/components/info-dialog';
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
import { countryName } from '@/lib/general-area';
import { chooseCity, chooseGeneralArea, useMapLocation, type SavedCity } from '@/lib/map-location';
import { cn } from '@/lib/utils';

/** Enough to scan, few enough that every keystroke is instant. */
const MAX_RESULTS = 40;

type City = SavedCity & {
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
function loadCities(): Promise<City[]> {
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

function search(cities: City[], query: string, preferCountry: string | null): City[] {
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
export function CityPicker({ open, onOpenChange, onChosen }: CityPickerProps) {
  const maxHeight = useDialogMaxHeight();
  const { height } = useWindowDimensions();
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
    () => (cities ? search(cities, query, area?.countryCode ?? null) : []),
    [cities, query, area?.countryCode]
  );

  async function pick(action: () => Promise<void>) {
    await action();
    setQuery('');
    onOpenChange(false);
    onChosen?.();
  }

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
                onPress={() =>
                  void pick(() =>
                    chooseCity({
                      name: city.name,
                      region: city.region,
                      country: city.country,
                      latitude: city.latitude,
                      longitude: city.longitude,
                    })
                  )
                }
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
