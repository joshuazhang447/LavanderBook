import { Languages, ShieldAlert } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BUTTON_LABEL } from '@/components/info-dialog';
import { LeaveNowButton } from '@/components/leave-now';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  acceptSafetyNotice,
  chooseSafetyLanguage,
  leaveNow,
  useIsComputer,
  useOnAdmin,
  usePanicKey,
  useSafety,
  useSafetyCovering,
} from '@/lib/safety';
import { SAFETY_LANGUAGE_ORDER, SAFETY_LANGUAGES } from '@/lib/safety-notice-text';
import { cn } from '@/lib/utils';

/**
 * Right-to-left for Arabic. The web is told with `dir`, and its flex rows and
 * text follow on their own. Native has no such switch for one screen (the
 * app-wide one needs a restart), so rows are reversed and text is aligned and
 * given its writing direction by hand.
 */
function useNoticeDirection() {
  const { rtl } = useSafety();
  const native = Platform.OS !== 'web';
  return {
    row: rtl && native ? 'flex-row-reverse' : 'flex-row',
    align: rtl ? 'text-right' : undefined,
    textStyle: (rtl ? { writingDirection: 'rtl' } : undefined) satisfies TextStyle | undefined,
  };
}

function Paragraph({ children }: { children: string }) {
  const { align, textStyle } = useNoticeDirection();
  return (
    <Text className={cn('text-base leading-6 text-foreground', align)} style={textStyle}>
      {children}
    </Text>
  );
}

function Section({ heading, children }: React.PropsWithChildren<{ heading: string }>) {
  const { align, textStyle } = useNoticeDirection();
  return (
    <View className="gap-3">
      <Text
        role="heading"
        className={cn('text-lg font-semibold text-foreground', align)}
        style={textStyle}>
        {heading}
      </Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  const { row, align, textStyle } = useNoticeDirection();
  return (
    <View className="gap-3">
      {items.map((item) => (
        <View key={item} className={cn(row, 'gap-2.5')}>
          <Text className="text-base leading-6 text-muted-foreground">•</Text>
          <Text
            className={cn('flex-1 text-base leading-6 text-foreground', align)}
            style={textStyle}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Each language in its own script, so someone who reads no English still finds
 * theirs - which is why this is a row of names and not a menu behind a label.
 */
function LanguageSwitch() {
  const { language, text } = useSafety();
  const { row, align, textStyle } = useNoticeDirection();

  return (
    <View className="gap-2">
      <View className={cn(row, 'items-center gap-1.5')}>
        <Icon as={Languages} className="size-4 text-muted-foreground" />
        <Text className={cn('text-sm text-muted-foreground', align)} style={textStyle}>
          {text.language}
        </Text>
      </View>
      <View className={cn(row, 'flex-wrap gap-2')} accessibilityRole="radiogroup">
        {SAFETY_LANGUAGE_ORDER.map((code) => {
          const option = SAFETY_LANGUAGES[code];
          const selected = code === language;
          return (
            <Pressable
              key={code}
              onPress={() => void chooseSafetyLanguage(code)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.name}
              className={cn(
                'rounded-full border px-3.5 py-1.5',
                selected ? 'border-primary bg-primary' : 'border-border bg-background active:bg-accent',
                Platform.select({ web: cn('cursor-pointer', !selected && 'hover:bg-accent') })
              )}
              {...(Platform.OS === 'web' ? { lang: option.tag } : {})}>
              <Text
                className={cn(
                  'text-sm font-medium',
                  selected ? 'text-primary-foreground' : 'text-foreground'
                )}>
                {option.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The notice: the first thing anyone sees, on the phone and on the website,
 * until they accept it - and again whenever they open it from My Account.
 *
 * Drawn over the whole app rather than routed to, so that a link into any
 * screen still lands here first, and so the router never has a page whose
 * address says what it is.
 */
function SafetyNotice() {
  const { ready, accepted, language, text, rtl, leaveButton } = useSafety();
  const covering = useSafetyCovering();
  const computer = useIsComputer();
  const insets = useSafeAreaInsets();
  const { align, textStyle, row } = useNoticeDirection();

  if (!covering) return null;
  // Not read yet: blank, rather than a glimpse of the map before the notice.
  if (!ready) return <View className="absolute inset-0 bg-background" />;

  const web = Platform.OS === 'web';
  const info = SAFETY_LANGUAGES[language];
  const bullets = [text.vpn, text.location, text.neverWrite, text.lockScreen, text.sharedDevice];
  // Only while it is true: the button can be hidden on the website, and the
  // phone app has none outside this notice.
  if (web && leaveButton) bullets.push(text.everyScreen);
  if (computer) bullets.push(text.shiftNotice);

  return (
    <View
      role="dialog"
      aria-modal
      accessibilityViewIsModal
      className="absolute inset-0 bg-background"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      {...(web ? { lang: info.tag, dir: rtl ? 'rtl' : 'ltr' } : {})}>
      <ScrollView className="flex-1" contentContainerClassName="items-center px-6 py-8">
        <View className="w-full max-w-xl gap-7">
          <LanguageSwitch />

          <View className="gap-3">
            <View className={cn(row, 'items-center gap-3')}>
              <View className="size-10 items-center justify-center rounded-full bg-destructive/10">
                <Icon as={ShieldAlert} className="size-6 text-destructive" />
              </View>
              <Text
                role="heading"
                className={cn('flex-1 text-2xl font-bold text-foreground', align)}
                style={textStyle}>
                {text.title}
              </Text>
            </View>
            <Paragraph>{text.intro}</Paragraph>
          </View>

          <Section heading={text.risksHeading}>
            <Paragraph>{text.risks}</Paragraph>
          </Section>

          <Section heading={text.protectHeading}>
            <Bullets items={bullets} />
          </Section>

          <Section heading={text.tracesHeading}>
            <Paragraph>{web ? text.tracesWeb : text.tracesApp}</Paragraph>
          </Section>
        </View>
      </ScrollView>

      {/* Outside the scroll, so "Leave now" is never more than a tap away. */}
      <View className="items-center border-t border-border px-6 py-4">
        {/* Stacked on a phone with "I understand" on top - the one most people
            want, where a thumb lands first. Side by side when there is room. */}
        <View className="w-full max-w-xl flex-col-reverse gap-4 sm:flex-row">
          <View className="gap-1.5 sm:flex-1">
            <Button variant="destructive" onPress={leaveNow}>
              <Text className={BUTTON_LABEL}>{text.leaveNow}</Text>
            </Button>
            <Text className="text-center text-xs text-muted-foreground" style={textStyle}>
              {text.leaveNowDetail}
            </Text>
          </View>
          <View className="gap-1.5 sm:flex-1">
            <Button onPress={() => void acceptSafetyNotice()}>
              <Text className={BUTTON_LABEL}>{text.understand}</Text>
            </Button>
            {/* Opened again from My Account, it was already not going to come back. */}
            {!accepted ? (
              <Text className="text-center text-xs text-muted-foreground" style={textStyle}>
                {text.notShownAgain}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * The app, hidden from screen readers and - on the web - from the keyboard
 * while the notice covers it. Without this, Tab walks straight out of the
 * notice into the map behind it.
 */
export function BehindSafetyNotice({ children }: React.PropsWithChildren) {
  const covering = useSafetyCovering();
  const ref = React.useRef<View>(null);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    // react-native-web's host components are DOM elements.
    const node = ref.current as unknown as HTMLElement | null;
    if (node) node.inert = covering;
  }, [covering]);

  return (
    <View ref={ref} className="flex-1" aria-hidden={covering}>
      {children}
    </View>
  );
}

/**
 * Everything that sits over the app: the website's "Leave now" button, the
 * Shift key, and the notice above both. After the portal host in the root
 * layout, so no sheet or dialog can cover any of it.
 */
export function SafetyLayer() {
  const { ready } = useSafety();
  const onAdmin = useOnAdmin();
  usePanicKey(ready && !onAdmin);

  return (
    <>
      <LeaveNowButton />
      <SafetyNotice />
    </>
  );
}
