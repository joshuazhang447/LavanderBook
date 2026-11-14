import { router } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LargeTitleScreen } from '@/components/chenfeng/large-title-screen';
import { useLeaveNowReserve } from '@/components/leave-now';
import { LinkedText } from '@/components/linked-text';
import { OauCard } from '@/components/oau/card';
import { NoteCheck } from '@/components/oau/note';
import { PaperBackdrop } from '@/components/oau/paper';
import { useIsWideViewport, useTabBarOverlap } from '@/components/tab-bar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { List, Row, Section } from '@/components/ui/list';
import { Text } from '@/components/ui/text';
import { PRIVACY_POLICY, type PolicyBlock } from '@/lib/privacy-policy';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

/**
 * LavenderBook's privacy policy, at /account/privacy - a page of its own, with
 * an address Google's sign-in screen and anyone else can link to, opened from
 * the Account tab under the safety notice.
 *
 * The words are docs/privacy-policy.md, built into src/lib/privacy-policy.ts
 * by scripts/build-privacy-policy.mjs: one text, which moves to the main site
 * later. Each skin draws it in its own type: Chenfeng as its setting pages
 * explain things, Basic and Material as a readable column.
 */
export function PrivacyPolicyPage() {
  const { skin } = useSkin();
  if (skin === 'chenfeng') return <ChenfengPolicy />;
  if (skin === 'oau') return <OauPolicy />;
  return <ColumnPolicy material={skin === 'material'} />;
}

const SHORT_VERSION = PRIVACY_POLICY.intro.find(
  (block): block is Extract<PolicyBlock, { kind: 'list' }> => block.kind === 'list'
);
const OPENING = PRIVACY_POLICY.intro.filter(
  (block): block is Extract<PolicyBlock, { kind: 'p' }> => block.kind === 'p'
);

/** Back to the Account tab: the screen before, or the tab itself when this page was opened from a link. */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/account');
}

/**
 * A line of the policy: **bold** as bold, and every email address and website
 * in it tappable. Renders nested text only, inside a Text that carries the style.
 */
function Inline({ text, linkClassName }: { text: string; linkClassName?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={index} className="font-semibold">
        <LinkedText text={part.slice(2, -2)} linkClassName={linkClassName} />
      </Text>
    ) : (
      <React.Fragment key={index}>
        <LinkedText text={part} linkClassName={linkClassName} />
      </React.Fragment>
    )
  );
}

// ---------------------------------------------------------------------------
// Chenfeng
// ---------------------------------------------------------------------------

function ChenfengBlocks({ blocks }: { blocks: PolicyBlock[] }) {
  return blocks.map((block, index) =>
    block.kind === 'p' ? (
      <Text key={index} textStyle="body" className="text-label-secondary">
        <Inline text={block.text} linkClassName="text-primary" />
      </Text>
    ) : (
      <View key={index} className="gap-1.5">
        {block.items.map((item, itemIndex) => (
          <View key={itemIndex} className="flex-row gap-2">
            <Text textStyle="body" className="text-label-secondary">
              {'•'}
            </Text>
            <Text textStyle="body" className="flex-1 text-label-secondary">
              <Inline text={item} linkClassName="text-primary" />
            </Text>
          </View>
        ))}
      </View>
    )
  );
}

function ChenfengPolicy() {
  return (
    <LargeTitleScreen title="Privacy Policy" grouped back>
      <List>
        <View className="gap-3 px-4 pt-1">
          <Text textStyle="footnote" className="text-label-secondary">
            Last updated {PRIVACY_POLICY.updated}
          </Text>
          {OPENING.map((block, index) => (
            <Text key={index} textStyle="body" className="text-foreground">
              <Inline text={block.text} linkClassName="text-primary" />
            </Text>
          ))}
        </View>

        {/* The short version as a card of its own, each point a row with a
            tick: what most people will read, and what has to be true. */}
        {SHORT_VERSION ? (
          <Section header="The Short Version">
            {SHORT_VERSION.items.map((item, index) => (
              <Row
                key={index}
                leading={<Icon as={Check} size={17} className="text-primary" />}
                leadingWidth={22}
                title={
                  <Text textStyle="body" className="text-foreground">
                    <Inline text={item} linkClassName="text-primary" />
                  </Text>
                }
              />
            ))}
          </Section>
        ) : null}

        <View className="gap-6 px-4 pb-4">
          {PRIVACY_POLICY.sections.map((section) => (
            <View key={section.title} className="gap-2">
              <Text textStyle="headline" role="heading" className="text-foreground">
                {section.title}
              </Text>
              <ChenfengBlocks blocks={section.blocks} />
            </View>
          ))}
        </View>
      </List>
    </LargeTitleScreen>
  );
}

// ---------------------------------------------------------------------------
// OAU
// ---------------------------------------------------------------------------

/**
 * OAU's reading page (LavenderBookStyle/oau-style-guide.md, section 14.12): a
 * column on My Account's pink paper, the short version on a card with sage
 * checks, each heading with a pink rule under it, links pink and underlined.
 * Typography only: the words are the same text as every skin's.
 */
function OauPolicy() {
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  const { top: leaveNow } = useLeaveNowReserve();
  const tabBarOverlap = useTabBarOverlap();
  const topInset = (isWide ? 0 : insets.top) + leaveNow;
  const link = 'text-primary underline';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      <PaperBackdrop tab="account" washHeight={220} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        contentContainerStyle={tabBarOverlap ? { paddingBottom: 48 + tabBarOverlap } : undefined}>
        <View className="w-full max-w-[640px] gap-7 self-center px-5 pt-5">
          <View className="items-start">
            <Button variant="secondary" size="sm" onPress={goBack} accessibilityLabel="Back to My Account">
              <Icon as={ChevronLeft} className="size-4 text-foreground" />
              <Text>My Account</Text>
            </Button>
          </View>

          <View className="gap-1.5">
            <Text oauStyle="display" role="heading" aria-level={1} className="text-foreground">
              Privacy policy
            </Text>
            <Text oauStyle="caption" className="text-muted-foreground">
              LavenderBook · Last updated {PRIVACY_POLICY.updated}
            </Text>
          </View>

          <View className="gap-3">
            {OPENING.map((block, index) => (
              <Text key={index} oauStyle="body" className="text-foreground">
                <Inline text={block.text} linkClassName={link} />
              </Text>
            ))}
          </View>

          {SHORT_VERSION ? (
            <OauCard className="gap-3 p-5">
              <Text oauStyle="heading" role="heading" className="text-foreground">
                The short version
              </Text>
              <View className="gap-2.5">
                {SHORT_VERSION.items.map((item, index) => (
                  <NoteCheck key={index}>
                    <Inline text={item} linkClassName={link} />
                  </NoteCheck>
                ))}
              </View>
            </OauCard>
          ) : null}

          {PRIVACY_POLICY.sections.map((section) => (
            <View key={section.title} className="gap-3">
              <View className="border-b border-note-rule pb-1.5">
                <Text oauStyle="heading" role="heading" aria-level={2} className="text-foreground">
                  {section.title}
                </Text>
              </View>
              {section.blocks.map((block, index) =>
                block.kind === 'p' ? (
                  <Text key={index} oauStyle="body" className="text-muted-foreground">
                    <Inline text={block.text} linkClassName={link} />
                  </Text>
                ) : (
                  <View key={index} className="gap-2">
                    {block.items.map((item, itemIndex) => (
                      <View key={itemIndex} className="flex-row gap-2.5">
                        <Text oauStyle="body" className="text-muted-foreground">
                          {'•'}
                        </Text>
                        <Text oauStyle="body" className="flex-1 text-muted-foreground">
                          <Inline text={item} linkClassName={link} />
                        </Text>
                      </View>
                    ))}
                  </View>
                )
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Basic and Material
// ---------------------------------------------------------------------------

/** The two skins' type for each part of the page, spelled out so Tailwind finds every class. */
function useColumnType(material: boolean) {
  return material
    ? {
        title: { type: 'headline-medium' as const, className: 'text-foreground' },
        meta: { type: 'body-medium' as const, className: 'text-on-surface-variant' },
        heading: { type: 'title-large' as const, className: 'text-foreground' },
        body: { type: 'body-large' as const, className: 'text-foreground' },
        quiet: { type: 'body-large' as const, className: 'text-on-surface-variant' },
        card: 'rounded-3xl bg-surface-container px-5 py-4',
        cardTitle: { type: 'title-medium' as const, className: 'text-foreground' },
      }
    : {
        title: { className: 'text-3xl font-semibold tracking-tight text-foreground' },
        meta: { className: 'text-sm text-muted-foreground' },
        heading: { className: 'text-lg font-semibold text-foreground' },
        body: { className: 'text-[15px] leading-6 text-foreground' },
        quiet: { className: 'text-[15px] leading-6 text-muted-foreground' },
        card: 'rounded-xl border border-border bg-card px-5 py-4',
        cardTitle: { className: 'text-base font-semibold text-foreground' },
      };
}

function ColumnBlocks({ blocks, material }: { blocks: PolicyBlock[]; material: boolean }) {
  const type = useColumnType(material);
  return blocks.map((block, index) =>
    block.kind === 'p' ? (
      <Text key={index} {...type.quiet}>
        <Inline text={block.text} linkClassName="text-primary underline" />
      </Text>
    ) : (
      <View key={index} className="gap-2">
        {block.items.map((item, itemIndex) => (
          <View key={itemIndex} className="flex-row gap-2.5">
            <Text {...type.quiet}>{'•'}</Text>
            <Text {...type.quiet} className={cn(type.quiet.className, 'flex-1')}>
              <Inline text={item} linkClassName="text-primary underline" />
            </Text>
          </View>
        ))}
      </View>
    )
  );
}

function ColumnPolicy({ material }: { material: boolean }) {
  const type = useColumnType(material);
  const insets = useSafeAreaInsets();
  const { isWide } = useIsWideViewport();
  const { top: leaveNow } = useLeaveNowReserve();
  const tabBarOverlap = useTabBarOverlap();
  // As the Account tab: the status bar on a phone, and the website's Leave
  // now button on a narrow screen, are cleared here; the header row on a wide
  // one already clears the status bar.
  const topInset = (isWide ? 0 : insets.top) + leaveNow;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: topInset }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12"
        contentContainerStyle={tabBarOverlap ? { paddingBottom: 48 + tabBarOverlap } : undefined}>
        <View className="w-full max-w-2xl gap-7 self-center px-6 pt-4">
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Account"
            className={cn(
              '-ml-2 flex-row items-center gap-0.5 self-start rounded-full py-1.5 pl-1 pr-3 active:bg-accent',
              Platform.select({ web: 'cursor-pointer hover:bg-accent' })
            )}>
            <Icon as={ChevronLeft} className="size-5 text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">Account</Text>
          </Pressable>

          <View className="gap-1.5">
            <Text role="heading" aria-level={1} {...type.title}>
              Privacy policy
            </Text>
            <Text {...type.meta}>LavenderBook · Last updated {PRIVACY_POLICY.updated}</Text>
          </View>

          <View className="gap-3">
            {OPENING.map((block, index) => (
              <Text key={index} {...type.body}>
                <Inline text={block.text} linkClassName="text-primary underline" />
              </Text>
            ))}
          </View>

          {SHORT_VERSION ? (
            <View className={type.card}>
              <Text role="heading" {...type.cardTitle} className={cn(type.cardTitle.className, 'mb-3')}>
                The short version
              </Text>
              <View className="gap-2.5">
                {SHORT_VERSION.items.map((item, index) => (
                  <View key={index} className="flex-row gap-3">
                    <Icon as={Check} className="mt-1 size-4 text-primary" />
                    <Text {...type.body} className={cn(type.body.className, 'flex-1')}>
                      <Inline text={item} linkClassName="text-primary underline" />
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {PRIVACY_POLICY.sections.map((section) => (
            <View key={section.title} className="gap-2.5">
              <Text role="heading" aria-level={2} {...type.heading}>
                {section.title}
              </Text>
              <ColumnBlocks blocks={section.blocks} material={material} />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
