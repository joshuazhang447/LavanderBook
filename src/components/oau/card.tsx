import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * OAU's cards, rows, headings and round icon stickers
 * (LavenderBookStyle/oau-style-guide.md, sections 13.1 and 13.14): cream cards
 * on the paper, rows at least 56 tall with a tinted circle, a hairline between
 * them. Shared by every OAU screen, so they all draw alike.
 */

/** A card's level-1 shadow: on the website only, where it is a class. */
const CARD_SHADOW = Platform.select({ web: 'shadow-[0_1px_3px_rgba(69,49,30,0.08)]' });

export function OauCard({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <View
      className={cn(
        'overflow-hidden rounded-[18px] border border-border bg-card',
        CARD_SHADOW,
        className
      )}>
      {children}
    </View>
  );
}

/** A section's heading on the paper, with an optional line under it. */
export function OauHeading({
  title,
  line,
  trailing,
  className,
}: {
  title: string;
  line?: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('gap-0.5', className)}>
      <View className="flex-row items-end gap-2">
        <Text oauStyle="heading" role="heading" className="flex-1 text-foreground">
          {title}
        </Text>
        {trailing}
      </View>
      {line ? (
        <Text oauStyle="caption" className="text-muted-foreground">
          {line}
        </Text>
      ) : null}
    </View>
  );
}

/** The tinted circle a row or tile leads with. */
export function OauIconCircle({
  icon,
  className,
  iconClassName,
  size = 36,
}: {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
  size?: 36 | 56;
}) {
  return (
    <View
      className={cn(
        'items-center justify-center rounded-full bg-wash',
        size === 56 ? 'size-14' : 'size-9',
        className
      )}>
      <Icon
        as={icon}
        className={cn(size === 56 ? 'size-7' : 'size-[18px]', 'text-primary', iconClassName)}
      />
    </View>
  );
}

type OauRowProps = {
  icon?: LucideIcon;
  /** The circle's and glyph's classes, when not the tab's own. */
  iconCircle?: string;
  iconGlyph?: string;
  title: string;
  detail?: string | null;
  /** Red, with the warning glyph's colour: a setting left on its less private side. */
  detailTone?: 'muted' | 'destructive';
  /** First in its card: no hairline above it. */
  first?: boolean;
  /** A chevron at the end: the row opens something. */
  chevron?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** A row in a card: tinted circle, title, a line under it, and what it opens. */
export function OauRow({
  icon,
  iconCircle,
  iconGlyph,
  title,
  detail,
  detailTone = 'muted',
  first,
  chevron,
  trailing,
  onPress,
  accessibilityLabel,
}: OauRowProps) {
  const body = (
    <>
      {icon ? <OauIconCircle icon={icon} className={iconCircle} iconClassName={iconGlyph} /> : null}
      <View className="flex-1 gap-0.5">
        <Text oauStyle="subheading" className="text-foreground">
          {title}
        </Text>
        {detail ? (
          <Text
            oauStyle="callout"
            className={detailTone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon as={ChevronRight} className="size-[18px] text-muted-foreground" /> : null}
    </>
  );
  const className = cn(
    'min-h-14 flex-row items-center gap-3 px-4 py-3',
    !first && 'border-t border-border'
  );

  if (!onPress) return <View className={className}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={cn(
        className,
        'active:bg-muted',
        Platform.select({ web: 'cursor-pointer transition-colors hover:bg-muted/60' })
      )}>
      {body}
    </Pressable>
  );
}

/**
 * A round icon sticker (section 13.1): cream band, ink outline, the glyph in
 * ink. 32 in cards, 40 in sheets, 48 over the map. Always has a spoken label.
 */
export function IconSticker({
  icon,
  label,
  onPress,
  size = 32,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  size?: 32 | 40 | 48;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={size === 32 ? 6 : 2}
      className={cn(
        'items-center justify-center rounded-full border-[1.5px] border-outline-ink bg-band active:scale-95',
        size === 48 ? 'size-12' : size === 40 ? 'size-10' : 'size-8',
        Platform.select({
          web: 'cursor-pointer shadow-[0_2px_5px_rgba(166,134,89,0.32)] transition-transform',
        }),
        className
      )}>
      <Icon
        as={icon}
        className={cn(size === 48 ? 'size-[22px]' : size === 40 ? 'size-5' : 'size-4', 'text-foreground')}
      />
    </Pressable>
  );
}
