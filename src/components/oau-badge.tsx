import { Linking, Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { LogoImage } from '@/components/logo-image';
import { Text } from '@/components/ui/text';
import { OAU_LEAVES } from '@/lib/logos';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

const OAU_URL = 'https://oneamongus.ca/';
const CREDIT = 'Created by OAU';
const CREDIT_LABEL = `${CREDIT}. Opens oneamongus.ca.`;

function openOau() {
  if (Platform.OS === 'web') {
    // A new tab, and no referrer: the site is told nothing about where the
    // visitor came from.
    window.open(OAU_URL, '_blank', 'noopener,noreferrer');
    return;
  }
  // Nothing useful to do if the phone refuses the link.
  Linking.openURL(OAU_URL).catch(() => {});
}

/**
 * OAU made LavenderBook: the logo and a line saying so, at the foot of the
 * Account tab, on the website and in the phone app, in every skin. Tapping it
 * opens oneamongus.ca in the browser. Small on purpose - it is a credit, not a
 * call to action.
 */
export function OauBadge({ className }: { className?: string }) {
  const chenfeng = useSkin().skin === 'chenfeng';

  return (
    <Pressable
      onPress={openOau}
      accessibilityRole="link"
      accessibilityLabel={CREDIT_LABEL}
      hitSlop={6}
      className={cn(
        'flex-row items-center gap-2 self-center rounded-full px-3 py-2',
        chenfeng ? 'active:opacity-30' : 'active:opacity-60',
        Platform.select({ web: 'cursor-pointer hover:opacity-80' }),
        className
      )}>
      <LogoImage logo={OAU_LEAVES} />
      <Text
        textStyle={chenfeng ? 'footnote' : undefined}
        className={chenfeng ? 'text-label-secondary' : 'text-xs text-muted-foreground'}>
        {CREDIT}
      </Text>
    </Pressable>
  );
}

/**
 * The same credit in the website's header, beside "LavenderBook" - Basic and
 * Material only, since Chenfeng's floating bar has no app name to sit beside.
 * It comes after the name, past a hairline, so the leaves read as OAU's and not
 * as LavenderBook's own logo.
 *
 * The header starts at 768 wide, where the words would run into the tabs: until
 * there is room, the leaves alone, still read out in full.
 */
export function OauHeaderCredit() {
  const roomy = useWindowDimensions().width >= 900;
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-5 w-px bg-border" />
      <Pressable
        onPress={openOau}
        accessibilityRole="link"
        accessibilityLabel={CREDIT_LABEL}
        hitSlop={6}
        className={cn(
          'flex-row items-center gap-1.5 rounded-full active:opacity-60',
          Platform.select({ web: 'cursor-pointer hover:opacity-80' })
        )}>
        <LogoImage logo={OAU_LEAVES} />
        {roomy ? <Text className="text-sm text-muted-foreground">{CREDIT}</Text> : null}
      </Pressable>
    </View>
  );
}
