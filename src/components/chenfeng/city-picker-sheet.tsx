import { CircleX, MapPin, Search } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { loadCities, searchCities, type City } from '@/components/city-picker';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { EmptyState, Row, Section } from '@/components/ui/list';
import { Sheet, SheetCloseButton, SheetScrollView, SheetToolbar, useSheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { countryName } from '@/lib/general-area';
import { chooseCity, chooseGeneralArea, useMapLocation } from '@/lib/map-location';

/**
 * Chenfeng's city picker (guideline section 14.8): a full-height sheet with ✕,
 * its search field at the top of the list - a sheet owns the bottom of the
 * screen - the general area first under "Suggested", then cities, the current
 * one checked. The GeoNames credit stays as the list's footer; the licence
 * asks for it where the data is seen. Offline, and on this device only, like
 * Basic's.
 */
export function CityPickerSheet({ onClose, onChosen }: { onClose: () => void; onChosen?: () => void }) {
  return (
    <Sheet
      name="chenfeng-city-picker"
      detents={['large']}
      accessibilityLabel="Choose a City"
      onClose={onClose}
      toolbar={<SheetToolbar leading={<SheetCloseButton />} title="Choose a City" />}>
      <CityList onChosen={onChosen} />
    </Sheet>
  );
}

function CityList({ onChosen }: { onChosen?: () => void }) {
  const sheet = useSheet();
  const { area, city: current, mode } = useMapLocation();
  const [cities, setCities] = React.useState<City[] | null>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    let active = true;
    loadCities().then((list) => active && setCities(list));
    return () => {
      active = false;
    };
  }, []);

  const results = React.useMemo(
    () => (cities ? searchCities(cities, query, area?.countryCode ?? null) : []),
    [cities, query, area?.countryCode]
  );

  async function pick(action: () => Promise<void>) {
    await action();
    sheet.dismiss();
    onChosen?.();
  }

  const trimmed = query.trim();
  const isCurrent = (city: City) =>
    mode === 'city' &&
    !!current &&
    current.name === city.name &&
    current.region === city.region &&
    current.country === city.country;

  return (
    <View className="flex-1">
      <View className="px-4 pb-3">
        <View className="h-11 flex-row items-center rounded-full bg-fill-tertiary pl-3 pr-1">
          <Icon as={Search} size={17} className="text-label-secondary" />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search Cities"
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            accessibilityLabel="Search cities"
            className="h-11 flex-1 bg-transparent px-2"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
              className={Platform.select({ web: 'cursor-pointer', default: undefined })}>
              <View className="p-1.5">
                <Icon as={CircleX} size={17} className="text-label-tertiary" />
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      <SheetScrollView contentContainerClassName="pb-10">
        {area && !trimmed ? (
          <Section header="Suggested" plain>
            <Row
              icon={MapPin}
              title={area.label}
              subtitle="From your phone's settings"
              accessory={mode === 'area' ? 'checkmark' : 'none'}
              accessibilityState={{ selected: mode === 'area' }}
              onPress={() => void pick(chooseGeneralArea)}
            />
          </Section>
        ) : null}

        {cities === null ? (
          <View className="py-8">
            <ActivityIndicator />
          </View>
        ) : results.length === 0 ? (
          <EmptyState
            icon={Search}
            title={`No Results for “${trimmed}”`}
            description="Check the spelling, or try a bigger city nearby."
          />
        ) : (
          <Section header={area && !trimmed ? 'Cities' : undefined} plain>
            {results.map((city) => {
              const detail = city.region
                ? `${city.region}, ${countryName(city.country)}`
                : countryName(city.country);
              const chosen = isCurrent(city);
              return (
                <Row
                  key={`${city.name}|${city.region}|${city.country}|${city.latitude}`}
                  title={city.name}
                  subtitle={detail}
                  accessory={chosen ? 'checkmark' : 'none'}
                  accessibilityState={{ selected: chosen }}
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
              );
            })}
          </Section>
        )}

        {/* CC BY 4.0 asks for credit where the data is used. See
            src/data/geonames/CREDITS.md. */}
        <Text textStyle="caption2" className="px-4 pt-4 text-center text-label-tertiary">
          City list © GeoNames (geonames.org), CC BY 4.0
        </Text>
      </SheetScrollView>
    </View>
  );
}
