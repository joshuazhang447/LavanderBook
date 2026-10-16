import { MapPin, Navigation, Search } from 'lucide-react-native';
import * as React from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { CityPickerSheet } from '@/components/chenfeng/city-picker-sheet';
import { useLeaveNowReserve } from '@/components/leave-now';
import { LOCATION_BLOCKED_PHONE, LOCATION_BLOCKED_WEB } from '@/components/location-choice';
import { useChenfengTopInset, useTabBarOverlap } from '@/components/tab-bar';
import { Icon } from '@/components/ui/icon';
import { List, Row, Section } from '@/components/ui/list';
import { Sheet, SheetCloseButton, SheetScrollView, SheetToolbar, useSheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { errorTick } from '@/lib/haptics';
import {
  chooseDeviceLocation,
  chooseGeneralArea,
  openLocationSettings,
  useMapLocation,
} from '@/lib/map-location';

/**
 * Chenfeng's choice of where the map starts (guideline section 14.7): near me,
 * a city, or the general area, as rows of one section. Only "Near Me" asks the
 * OS for permission - and its title keeps clear of the word "Allow", which is
 * the system's to say.
 */
function Choices({ onDone }: { onDone?: () => void }) {
  const { area } = useMapLocation();
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<'denied' | 'blocked' | null>(null);
  const [picking, setPicking] = React.useState(false);
  const web = Platform.OS === 'web';

  async function nearMe() {
    setBusy(true);
    setOutcome(null);
    const result = await chooseDeviceLocation();
    setBusy(false);
    if (result === 'granted') onDone?.();
    else {
      errorTick();
      setOutcome(result);
    }
  }

  const footer =
    outcome === 'denied'
      ? "Location wasn't allowed. Try again, or pick a place below."
      : outcome === 'blocked'
        ? web
          ? LOCATION_BLOCKED_WEB
          : LOCATION_BLOCKED_PHONE
        : 'You can change this any time in Account.';

  return (
    <>
      <Section footer={footer} footerTone={outcome ? 'destructive' : 'default'}>
        <Row
          tile={{ icon: Navigation, className: 'bg-primary' }}
          disabled={busy}
          accessibilityLabel="Near Me. Follows you as you move. Your exact location stays on your phone."
          onPress={() => void nearMe()}>
          <Text textStyle="headline" className="text-foreground">
            Near Me
          </Text>
          <Text textStyle="subheadline" className="text-label-secondary">
            Follows you as you move. Your exact location stays on your phone.
          </Text>
        </Row>
        {outcome === 'blocked' && !web ? (
          <Row title="Open Settings" tone="tint" onPress={() => void openLocationSettings()} />
        ) : null}
        <Row
          tile={{ icon: Search, className: 'bg-system-gray' }}
          accessory="chevron"
          disabled={busy}
          accessibilityLabel="Choose a City. Pick any city by name."
          onPress={() => setPicking(true)}>
          <Text textStyle="headline" className="text-foreground">
            Choose a City…
          </Text>
          <Text textStyle="subheadline" className="text-label-secondary">
            Pick any city by name.
          </Text>
        </Row>
        {area ? (
          <Row
            tile={{ icon: MapPin, className: 'bg-destructive' }}
            disabled={busy}
            accessibilityLabel={`${area.label}. Based on your phone's settings. Nothing is shared.`}
            onPress={async () => {
              await chooseGeneralArea();
              onDone?.();
            }}>
            <Text textStyle="headline" className="text-foreground">
              {area.label}
            </Text>
            <Text textStyle="subheadline" className="text-label-secondary">
              {area.source === 'time-zone'
                ? "Based on your phone's time zone. Nothing is shared."
                : "Based on your phone's region setting. Nothing is shared."}
            </Text>
          </Row>
        ) : null}
      </Section>
      {picking ? <CityPickerSheet onClose={() => setPicking(false)} onChosen={onDone} /> : null}
    </>
  );
}

/** The Map tab's first screen, until a choice has been made once: an onboarding page. */
export function ChenfengLocationChoiceScreen() {
  const topInset = useChenfengTopInset();
  const leaveNow = useLeaveNowReserve();
  const tabBarOverlap = useTabBarOverlap();

  return (
    <ScrollView
      className="flex-1 bg-grouped"
      contentContainerClassName="grow justify-center"
      contentContainerStyle={{
        paddingTop: topInset + leaveNow.top + 24,
        paddingBottom: tabBarOverlap + 24,
      }}>
      <View className="w-full max-w-[560px] self-center">
        <View className="items-center gap-3 px-8 pb-8">
          <Icon as={Navigation} size={56} strokeWidth={1.5} className="text-primary" />
          <Text textStyle="title1" emphasized role="heading" className="text-center text-foreground">
            Where Should the Map Start?
          </Text>
          <Text textStyle="body" className="text-center text-label-secondary">
            Everything works either way, including posting reviews.
          </Text>
        </View>
        <List>
          <Choices />
        </List>
      </View>
    </ScrollView>
  );
}

/** The same choice from the location button, while the map is not following. */
export function ChenfengLocationSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      name="chenfeng-map-location"
      detents={['medium', 'large']}
      grouped
      accessibilityLabel="Map Location"
      onClose={onClose}
      toolbar={<SheetToolbar belowGrabber leading={<SheetCloseButton />} title="Map Location" />}>
      <SheetChoices />
    </Sheet>
  );
}

function SheetChoices() {
  const sheet = useSheet();
  return (
    <SheetScrollView contentContainerClassName="pb-8 pt-2">
      <View className="px-8 pb-4">
        <Text textStyle="subheadline" className="text-center text-label-secondary">
          Everything works either way, including posting reviews.
        </Text>
      </View>
      <List>
        <Choices onDone={sheet.dismiss} />
      </List>
    </SheetScrollView>
  );
}
