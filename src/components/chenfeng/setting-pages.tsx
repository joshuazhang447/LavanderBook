import * as React from 'react';
import { Platform, View } from 'react-native';

import { CityPickerSheet } from '@/components/chenfeng/city-picker-sheet';
import { LargeTitleScreen } from '@/components/chenfeng/large-title-screen';
import { LOCATION_BLOCKED_PHONE, LOCATION_BLOCKED_WEB } from '@/components/location-choice';
import { confirmActionSheet } from '@/components/ui/confirm';
import { List, Row, Section } from '@/components/ui/list';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/auth';
import {
  chooseDeviceLocation,
  openLocationSettings,
  stopUsingDeviceLocation,
  useMapLocation,
} from '@/lib/map-location';
import {
  DATES_CONFIRM_OFF,
  DATES_EXPLAINED,
  DATES_OFF_WARNING,
  datesSummary,
  EXPLANATION_HEADINGS,
  LEAVE_NOW_EXPLAINED,
  LEAVE_NOW_OFF_WARNING,
  leaveNowSummary,
  LOCATION_DENIED,
  LOCATION_EXPLAINED,
  locationSummary,
  namesConfirmOff,
  namesExplained,
  NAMES_OFF_WARNING,
  namesSummary,
  type ConfirmOff,
  type Explained,
} from '@/lib/privacy-text';
import { setLeaveNowButton, useSafety } from '@/lib/safety';
import { chooseSkin, DEFAULT_SKIN, SKINS, useSkinChoice } from '@/lib/skin';

/**
 * Chenfeng's setting pages, one per privacy setting and one for the look,
 * pushed from Account (guideline section 14.6). Each is the way Settings
 * explains a setting: the switch in its row, what it is set to under it - and,
 * on the less private side, the red warning - then the same four questions
 * the other skins' explanation dialogs answer, in the same words
 * (src/lib/privacy-text.ts). What each switch does, and which ask before
 * turning off, is unchanged.
 */

/** The four answers, as plain text sections under the switch. */
function Explanation({ explained }: { explained: Explained }) {
  const points: [string, string][] = [
    [EXPLANATION_HEADINGS.title.whyItMatters, explained.whyItMatters],
    [EXPLANATION_HEADINGS.title.whatItDoes, explained.whatItDoes],
    [EXPLANATION_HEADINGS.title.whatItCantHide, explained.whatItCantHide],
    [EXPLANATION_HEADINGS.title.ifTurnedOff, explained.ifTurnedOff],
  ];
  return (
    <View className="gap-5 px-4 pt-1">
      <Text textStyle="body" className="text-foreground">
        {explained.lead}
      </Text>
      {points.map(([title, body]) => (
        <View key={title} className="gap-1">
          <Text textStyle="headline" role="heading" className="text-foreground">
            {title}
          </Text>
          <Text textStyle="body" className="text-label-secondary">
            {body}
          </Text>
        </View>
      ))}
    </View>
  );
}

type ToggleProps = {
  title: string;
  enabled: boolean;
  summary: string;
  /** In red under the switch while it is off: only where off is less private. */
  offWarning?: string;
  /** Asked before turning off: only where off is less private. */
  confirmOff?: ConfirmOff & { action: string };
  onChange: (next: boolean) => Promise<void>;
  /** More, under the switch's section. */
  extra?: React.ReactNode;
};

/** A setting's switch section. */
function ToggleSection({ title, enabled, summary, offWarning, confirmOff, onChange, extra }: ToggleProps) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function apply(next: boolean) {
    setError(null);
    setBusy(true);
    try {
      await onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change this setting.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(next: boolean) {
    if (next || !confirmOff) {
      await apply(next);
      return;
    }
    // Off here exposes something turning it back on cannot take back: ask,
    // with the action named in red, as iOS's own action sheets do.
    const choice = await confirmActionSheet({
      message: confirmOff.body,
      actions: [{ label: confirmOff.action, style: 'destructive' }],
    });
    if (choice === 0) await apply(false);
  }

  const warning = !enabled && offWarning ? offWarning : null;

  return (
    <>
      <Section
        footer={
          <View className="gap-1.5">
            <Text textStyle="footnote" className="text-label-secondary">
              {summary}
            </Text>
            {warning ? (
              <Text textStyle="footnote" className="text-destructive">
                {warning}
              </Text>
            ) : null}
            {error ? (
              <Text textStyle="footnote" role="alert" className="text-destructive">
                {error}
              </Text>
            ) : null}
          </View>
        }>
        <Row
          title={title}
          trailing={
            <Switch
              checked={enabled}
              disabled={busy}
              accessibilityLabel={title}
              onCheckedChange={(next) => void toggle(next)}
            />
          }
        />
      </Section>
      {extra}
    </>
  );
}

export function LocationSettingPage() {
  const { usingDevice, place } = useMapLocation();
  const [blocked, setBlocked] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const web = Platform.OS === 'web';

  return (
    <LargeTitleScreen title="Use My Location" grouped back>
      <List>
        <ToggleSection
          title="Use My Location"
          enabled={usingDevice}
          summary={locationSummary(usingDevice, place?.label)}
          onChange={async (next) => {
            if (!next) {
              setBlocked(false);
              await stopUsingDeviceLocation();
              return;
            }
            const result = await chooseDeviceLocation();
            setBlocked(result === 'blocked');
            if (result === 'denied') throw new Error(LOCATION_DENIED);
          }}
          extra={
            <>
              {blocked && !usingDevice ? (
                <Section footer={web ? LOCATION_BLOCKED_WEB : LOCATION_BLOCKED_PHONE} footerTone="destructive">
                  {web ? null : (
                    <Row
                      title="Open Settings"
                      tone="tint"
                      onPress={async () => {
                        await openLocationSettings();
                      }}
                    />
                  )}
                </Section>
              ) : null}
              {!usingDevice ? (
                <Section>
                  <Row
                    title="Map Opens At"
                    detail={place?.label ?? 'Choose a City'}
                    accessory="chevron"
                    accessibilityHint="Choose where the map opens."
                    onPress={() => setPicking(true)}
                  />
                </Section>
              ) : null}
            </>
          }
        />
        <Explanation explained={LOCATION_EXPLAINED} />
      </List>
      {picking ? <CityPickerSheet onClose={() => setPicking(false)} /> : null}
    </LargeTitleScreen>
  );
}

export function LeaveNowSettingPage() {
  const { leaveButton } = useSafety();
  return (
    <LargeTitleScreen title="Leave Now Button" grouped back>
      <List>
        <ToggleSection
          title="Leave Now Button"
          enabled={leaveButton}
          summary={leaveNowSummary(leaveButton)}
          offWarning={LEAVE_NOW_OFF_WARNING}
          onChange={setLeaveNowButton}
        />
        <Explanation explained={LEAVE_NOW_EXPLAINED} />
      </List>
    </LargeTitleScreen>
  );
}

export function NamesSettingPage() {
  const { profile, setPerPlaceNames } = useAuth();
  return (
    <LargeTitleScreen title="Per-Place Names" grouped back>
      {profile ? (
        <List>
          <ToggleSection
            title="Per-Place Names"
            enabled={profile.per_place_names}
            summary={namesSummary(profile.per_place_names, profile.display_name)}
            offWarning={NAMES_OFF_WARNING}
            confirmOff={{ ...namesConfirmOff(profile.display_name), action: 'Turn Off Per-Place Names' }}
            onChange={setPerPlaceNames}
          />
          <Explanation explained={namesExplained(profile.display_name)} />
        </List>
      ) : (
        <SignedOutNote />
      )}
    </LargeTitleScreen>
  );
}

export function DatesSettingPage() {
  const { profile, setHideDates } = useAuth();
  return (
    <LargeTitleScreen title="Hide Exact Dates" grouped back>
      {profile ? (
        <List>
          <ToggleSection
            title="Hide Exact Dates"
            enabled={profile.hide_dates}
            summary={datesSummary(profile.hide_dates)}
            offWarning={DATES_OFF_WARNING}
            confirmOff={{ ...DATES_CONFIRM_OFF, action: 'Show Dates' }}
            // Never changes a review already posted; see privacy-settings.tsx.
            onChange={setHideDates}
          />
          <Explanation explained={DATES_EXPLAINED} />
        </List>
      ) : (
        <SignedOutNote />
      )}
    </LargeTitleScreen>
  );
}

/** A page of an account's setting, reached without one (an old link). */
function SignedOutNote() {
  return (
    <List>
      <Section footer="Sign in from Account to change this." />
    </List>
  );
}

export function AppearanceSettingPage() {
  const { skin } = useSkinChoice();
  return (
    <LargeTitleScreen title="Appearance" grouped back>
      <List>
        <Section footer="How buttons, switches and the tab bar look on this device.">
          {SKINS.map((option) => (
            <Row
              key={option.id}
              title={option.id === DEFAULT_SKIN ? `${option.label} (Default)` : option.label}
              accessory={skin === option.id ? 'checkmark' : 'none'}
              accessibilityRole="radio"
              accessibilityState={{ selected: skin === option.id }}
              onPress={() => void chooseSkin(option.id)}
            />
          ))}
        </Section>
      </List>
    </LargeTitleScreen>
  );
}
