import type { LucideIcon } from 'lucide-react-native';
import { Check, ChevronRight, ChevronsUpDown } from 'lucide-react-native';
import * as React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CONTINUOUS } from '@/lib/shape';
import { cn } from '@/lib/utils';

/**
 * iOS's inset grouped list - the grammar of every settings-like screen in
 * Chenfeng: white rounded sections on the grey grouped page, no borders, no
 * shadows, hairline separators that start where the text starts, a header
 * above each section and a footer below it (guideline section 13.5).
 *
 * react-native-reusables has no list, so this is composed by hand out of the
 * app's own Text and Icon, per AGENTS.md. Chenfeng only: Basic and Material
 * keep their cards.
 */

/** iOS 26's section corner (it was 10 before). */
export const SECTION_RADIUS = 26;
/** A row's content inset from the section's edges, and the screen margin. */
export const ROW_INSET = 16;
/** A settings tile's size. */
const TILE = 30;
/** A plain symbol's column, leading. */
const SYMBOL_COLUMN = 24;
/** Between the leading column and the text. */
const LEADING_GAP = 12;

type Position = { first: boolean; plain: boolean };

const RowPosition = React.createContext<Position>({ first: true, plain: false });

/**
 * A column of sections, 20 pt apart, inset from the screen's edges. Not a
 * scroll view: the screen decides how it scrolls.
 */
export function List({
  children,
  className,
  style,
}: React.PropsWithChildren<{ className?: string; style?: StyleProp<ViewStyle> }>) {
  return (
    <View className={cn('gap-5 px-4', className)} style={style}>
      {children}
    </View>
  );
}

type SectionProps = React.PropsWithChildren<{
  /** Headline-sized, secondary label, title case - never upper case. */
  header?: React.ReactNode;
  /** On the header's line, at its trailing end: "Required". */
  headerTrailing?: React.ReactNode;
  /** Footnote, secondary label, sentence case: explanations, warnings, help. */
  footer?: React.ReactNode;
  /** A footer that is a warning or an error. */
  footerTone?: 'default' | 'destructive';
  /**
   * Edge to edge on the plain page instead of an inset rounded section - for
   * search results and the venue list.
   */
  plain?: boolean;
  className?: string;
  /** Classes for the rounded box itself. */
  boxClassName?: string;
}>;

export function Section({
  header,
  headerTrailing,
  footer,
  footerTone = 'default',
  plain = false,
  className,
  boxClassName,
  children,
}: SectionProps) {
  const rows = React.Children.toArray(children).filter(React.isValidElement);

  return (
    <View className={className}>
      {header ? (
        <View className={cn('flex-row items-baseline gap-2 pb-2.5', plain ? 'px-4' : 'px-4')}>
          {typeof header === 'string' ? (
            <Text textStyle="headline" role="heading" className="flex-1 text-label-secondary">
              {header}
            </Text>
          ) : (
            <View className="flex-1">{header}</View>
          )}
          {typeof headerTrailing === 'string' ? (
            <Text textStyle="footnote" className="text-label-secondary">
              {headerTrailing}
            </Text>
          ) : (
            headerTrailing
          )}
        </View>
      ) : null}

      {rows.length > 0 ? (
        <View
          className={cn(plain ? 'bg-background' : 'overflow-hidden bg-card', boxClassName)}
          style={plain ? undefined : [{ borderRadius: SECTION_RADIUS }, CONTINUOUS]}>
          {rows.map((row, index) => (
            <RowPosition.Provider key={row.key ?? index} value={{ first: index === 0, plain }}>
              {row}
            </RowPosition.Provider>
          ))}
        </View>
      ) : null}

      {footer ? (
        <View className="px-4 pt-2">
          {typeof footer === 'string' ? (
            <Text
              textStyle="footnote"
              className={
                footerTone === 'destructive' ? 'text-destructive' : 'text-label-secondary'
              }>
              {footer}
            </Text>
          ) : (
            footer
          )}
        </View>
      ) : null}
    </View>
  );
}

/** The hairline above every row but a section's first, from the text's leading edge. */
function Separator({ left, plain }: { left: number; plain: boolean }) {
  return (
    <View
      pointerEvents="none"
      className="absolute top-0 bg-separator"
      style={{ left, right: plain ? 0 : ROW_INSET, height: StyleSheet.hairlineWidth }}
    />
  );
}

type Accessory = 'chevron' | 'checkmark' | 'menu' | 'none';

export type RowProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Fewer lines for a subtitle in a dense row: Footnote instead of Subheadline. */
  denseSubtitle?: boolean;
  /** A plain symbol at Body size, leading. */
  icon?: LucideIcon;
  /** A settings tile instead: a 30 pt rounded square in a system colour, white symbol. */
  tile?: { icon: LucideIcon; className: string };
  /** Anything else, leading; give its width so the separator lines up. */
  leading?: React.ReactNode;
  leadingWidth?: number;
  /** A value, trailing, in the secondary label colour ("On", "Chenfeng"). */
  detail?: React.ReactNode;
  /** A detail that warns: in red. */
  detailTone?: 'default' | 'destructive';
  /** Chevron, checkmark, menu (chevron up and down), or nothing. */
  accessory?: Accessory;
  /** Anything else, trailing: a switch. */
  trailing?: React.ReactNode;
  /** An action row: a text button filling the row, in the tint or in red. */
  tone?: 'default' | 'tint' | 'destructive';
  /** Centred, for an action alone in its section ("Sign Out"). */
  centered?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Instead of title and subtitle: the row's own body. */
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'link' | 'none' | 'radio' | 'checkbox' | 'header' | 'text';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  className?: string;
};

function Trailing({ accessory }: { accessory: Accessory }) {
  switch (accessory) {
    case 'chevron':
      // 13 pt, semibold, tertiary label: iOS's disclosure indicator.
      return (
        <Icon
          as={ChevronRight}
          size={13}
          weight="semibold"
          strokeWidth={2.75}
          className="text-label-tertiary"
        />
      );
    case 'checkmark':
      return (
        <Icon as={Check} size={17} weight="semibold" strokeWidth={2.5} className="text-primary" />
      );
    case 'menu':
      return (
        <Icon
          as={ChevronsUpDown}
          size={13}
          weight="semibold"
          strokeWidth={2.5}
          className="text-label-tertiary"
        />
      );
    default:
      return null;
  }
}

function plainText(node: React.ReactNode): string | null {
  return typeof node === 'string' || typeof node === 'number' ? String(node) : null;
}

/**
 * One row of a section: at least 52 pt for a single line, 16 pt in from both
 * edges, its content Body. Pressable rows highlight grey at touch-down -
 * after a moment inside a scroll view, so a scroll does not flash them.
 */
export function Row({
  title,
  subtitle,
  denseSubtitle,
  icon,
  tile,
  leading,
  leadingWidth,
  detail,
  detailTone = 'default',
  accessory = 'none',
  trailing,
  tone = 'default',
  centered,
  onPress,
  onLongPress,
  disabled,
  children,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  accessibilityActions,
  onAccessibilityAction,
  className,
}: RowProps) {
  const { first, plain } = React.useContext(RowPosition);
  const lead = tile ? TILE : icon ? SYMBOL_COLUMN : leading ? (leadingWidth ?? 0) : 0;
  const separatorLeft = ROW_INSET + (lead > 0 ? lead + LEADING_GAP : 0);

  const titleClass = cn(
    disabled
      ? 'text-label-tertiary'
      : tone === 'tint'
        ? 'text-primary'
        : tone === 'destructive'
          ? 'text-destructive'
          : 'text-foreground',
    centered && 'text-center'
  );

  const body = (
    <>
      {!first ? <Separator left={separatorLeft} plain={plain} /> : null}
      {tile ? (
        <View
          className={cn('items-center justify-center', tile.className)}
          style={[{ width: TILE, height: TILE, borderRadius: 8 }, CONTINUOUS]}>
          <Icon as={tile.icon} size={18} weight="medium" className="text-white" />
        </View>
      ) : icon ? (
        <View style={{ width: SYMBOL_COLUMN }} className="items-center">
          <Icon
            as={icon}
            size={17}
            className={disabled ? 'text-label-tertiary' : 'text-foreground'}
          />
        </View>
      ) : (
        leading
      )}

      {children ? (
        <View className="flex-1">{children}</View>
      ) : (
        <View className="flex-1 gap-0.5">
          {typeof title === 'string' ? (
            <Text textStyle="body" className={titleClass}>
              {title}
            </Text>
          ) : (
            title
          )}
          {typeof subtitle === 'string' ? (
            <Text
              textStyle={denseSubtitle ? 'footnote' : 'subheadline'}
              className="text-label-secondary">
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
        </View>
      )}

      {detail !== undefined && detail !== null ? (
        typeof detail === 'string' ? (
          <Text
            textStyle="body"
            numberOfLines={1}
            className={cn(
              'max-w-[55%] text-right',
              detailTone === 'destructive' ? 'text-destructive' : 'text-label-secondary'
            )}>
            {detail}
          </Text>
        ) : (
          detail
        )
      ) : null}
      {trailing}
      <Trailing accessory={accessory} />
    </>
  );

  const layout = cn(
    'min-h-[52px] flex-row items-center gap-3 px-4 py-[11px]',
    lead > 0 && 'gap-3',
    className
  );

  const label =
    accessibilityLabel ??
    ([plainText(title), plainText(detail), plainText(subtitle)].filter(Boolean).join(', ') ||
      undefined);

  if (!onPress && !onLongPress) {
    return (
      <View
        className={layout}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      // Long enough that a finger starting a scroll does not flash the row.
      unstable_pressDelay={Platform.OS === 'web' ? undefined : 90}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      className={cn(
        layout,
        !disabled && 'active:bg-accent',
        Platform.select({
          web: cn(
            'select-none outline-none focus-visible:bg-fill-quaternary',
            !disabled &&
              'cursor-pointer transition-colors duration-300 hover:bg-fill-quaternary active:duration-0'
          ),
        })
      )}>
      {body}
    </Pressable>
  );
}

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** A whole screen: Title 2 Bold rather than Title 3 Semibold. */
  large?: boolean;
  className?: string;
};

/**
 * ContentUnavailableView's anatomy, centred in the space it fills: a symbol, a
 * title, a line saying what to do next, and at most one action.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  large,
  className,
}: EmptyStateProps) {
  return (
    <View className={cn('items-center gap-2 px-8 py-10', className)}>
      {icon ? (
        <Icon as={icon} size={48} strokeWidth={1.5} className="mb-2 text-label-secondary" />
      ) : null}
      <Text
        textStyle={large ? 'title2' : 'title3'}
        emphasized
        role="heading"
        className="text-center text-foreground">
        {title}
      </Text>
      {description ? (
        <Text textStyle="body" className="text-center text-label-secondary">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}
