import { MaterialSymbol, type MaterialSymbolName } from '@/components/material/symbol';
import { TextClassContext } from '@/components/ui/text';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';
import { requireOptionalNativeModule } from 'expo';
import type { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  CircleCheck,
  CircleUser,
  CircleX,
  Clock,
  Copy,
  DoorClosed,
  DoorOpen,
  Drama,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Info,
  Languages,
  List,
  ListChecks,
  Locate,
  LocateFixed,
  LocateOff,
  LogOut,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  MessageSquareText,
  MoreHorizontal,
  Navigation,
  NavigationOff,
  Palette,
  Pencil,
  Plus,
  RotateCw,
  Route,
  Search,
  SearchX,
  ShieldAlert,
  SquarePen,
  Star,
  StarHalf,
  Tag,
  Trash2,
  TriangleAlert,
  User,
  Users,
  VenetianMask,
  X,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';

type IconProps = LucideProps & {
  as: LucideIcon;
  /**
   * The symbol's weight where an SF Symbol is drawn instead (Chenfeng on iOS):
   * it follows the text it sits beside - regular beside Body, semibold beside
   * Headline. Lucide ignores it.
   */
  weight?: SymbolWeight;
  /**
   * The SF Symbol's filled variant (a selected tab, a swipe action). Lucide's
   * shapes do not all close - a filled map or bin is a blob - so it ignores
   * this; pass `fill` for a Lucide icon that fills cleanly, such as a star.
   */
  filled?: boolean;
} & React.RefAttributes<LucideIcon>;

function IconImpl({ as: IconComponent, weight: _weight, filled: _filled, ...props }: IconProps) {
  return <IconComponent {...props} />;
}

cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: 'size',
      width: 'size',
    },
  },
});

/**
 * SF Symbols, Chenfeng's icons on iOS: drawn to sit on the text's baseline at
 * its weight, and what every other app on the phone uses. iOS only - their
 * licence is for Apple's platforms, so Android and the web keep Lucide.
 *
 * Every Lucide icon the app draws, beside the symbol that does its job, in this
 * one table - nothing picks a symbol by hand. `fill` is the filled variant,
 * drawn where the Lucide icon is drawn filled (a star) or selected (a tab).
 */
const SF_SYMBOLS = new Map<LucideIcon, { name: string; fill?: string }>([
  [MapIcon, { name: 'map', fill: 'map.fill' }],
  [CircleUser, { name: 'person.crop.circle', fill: 'person.crop.circle.fill' }],
  [Search, { name: 'magnifyingglass' }],
  [SearchX, { name: 'magnifyingglass' }],
  [X, { name: 'xmark' }],
  [CircleX, { name: 'xmark.circle.fill' }],
  [Check, { name: 'checkmark' }],
  [CircleCheck, { name: 'checkmark.circle', fill: 'checkmark.circle.fill' }],
  [ChevronLeft, { name: 'chevron.backward' }],
  [ArrowLeft, { name: 'chevron.backward' }],
  [ChevronRight, { name: 'chevron.forward' }],
  [ArrowRight, { name: 'arrow.forward' }],
  [ChevronDown, { name: 'chevron.down' }],
  [ChevronUp, { name: 'chevron.up' }],
  [ChevronsUpDown, { name: 'chevron.up.chevron.down' }],
  [Navigation, { name: 'location', fill: 'location.fill' }],
  [NavigationOff, { name: 'location.slash' }],
  [Locate, { name: 'location' }],
  [LocateFixed, { name: 'location.fill' }],
  [LocateOff, { name: 'location.slash' }],
  [RotateCw, { name: 'arrow.clockwise' }],
  [List, { name: 'list.bullet' }],
  [ListChecks, { name: 'checklist' }],
  [MapPin, { name: 'mappin' }],
  [MapPinOff, { name: 'mappin.slash' }],
  [
    Route,
    {
      name: 'arrow.triangle.turn.up.right.diamond',
      fill: 'arrow.triangle.turn.up.right.diamond.fill',
    },
  ],
  [ExternalLink, { name: 'arrow.up.forward.square' }],
  [SquarePen, { name: 'square.and.pencil' }],
  [Pencil, { name: 'pencil' }],
  [Trash2, { name: 'trash', fill: 'trash.fill' }],
  [VenetianMask, { name: 'theatermasks', fill: 'theatermasks.fill' }],
  [Drama, { name: 'theatermasks', fill: 'theatermasks.fill' }],
  [Calendar, { name: 'calendar' }],
  [CalendarDays, { name: 'calendar' }],
  [CalendarOff, { name: 'calendar.badge.clock' }],
  [CalendarClock, { name: 'calendar.badge.clock' }],
  [Clock, { name: 'clock', fill: 'clock.fill' }],
  [Eye, { name: 'eye', fill: 'eye.fill' }],
  [EyeOff, { name: 'eye.slash', fill: 'eye.slash.fill' }],
  [Flag, { name: 'flag', fill: 'flag.fill' }],
  [Info, { name: 'info.circle', fill: 'info.circle.fill' }],
  [Palette, { name: 'paintpalette', fill: 'paintpalette.fill' }],
  [ShieldAlert, { name: 'exclamationmark.shield', fill: 'exclamationmark.shield.fill' }],
  [DoorOpen, { name: 'door.left.hand.open' }],
  [DoorClosed, { name: 'door.left.hand.closed' }],
  [Star, { name: 'star', fill: 'star.fill' }],
  [StarHalf, { name: 'star.leadinghalf.filled' }],
  [MoreHorizontal, { name: 'ellipsis' }],
  [Ellipsis, { name: 'ellipsis' }],
  [AlertTriangle, { name: 'exclamationmark.triangle', fill: 'exclamationmark.triangle.fill' }],
  [TriangleAlert, { name: 'exclamationmark.triangle', fill: 'exclamationmark.triangle.fill' }],
  [Plus, { name: 'plus' }],
]);

/**
 * Material Symbols, Material's icons, on every platform (they are a font:
 * src/components/material/symbol.tsx) - the same one table for every Lucide
 * icon the app draws. Outline only: the font has no filled style, so an icon
 * asked to fill (a star) stays Lucide.
 */
const MATERIAL_ICONS = new Map<LucideIcon, MaterialSymbolName>([
  [MapIcon, 'map'],
  [CircleUser, 'account_circle'],
  [User, 'person'],
  [Users, 'group'],
  [Search, 'search'],
  [SearchX, 'search_off'],
  [X, 'close'],
  [CircleX, 'cancel'],
  [Check, 'check'],
  [CircleCheck, 'check_circle'],
  [ChevronLeft, 'chevron_left'],
  [ArrowLeft, 'arrow_back'],
  [ChevronRight, 'chevron_right'],
  [ArrowRight, 'arrow_forward'],
  [ArrowUp, 'arrow_upward'],
  [ArrowDown, 'arrow_downward'],
  [ChevronDown, 'expand_more'],
  [ChevronUp, 'expand_less'],
  [ChevronsUpDown, 'unfold_more'],
  [Navigation, 'near_me'],
  [NavigationOff, 'near_me_disabled'],
  [Locate, 'location_searching'],
  [LocateFixed, 'my_location'],
  [LocateOff, 'location_disabled'],
  [RotateCw, 'refresh'],
  [List, 'list'],
  [ListChecks, 'checklist'],
  [MapPin, 'location_on'],
  [MapPinOff, 'location_off'],
  [Route, 'directions'],
  [ExternalLink, 'open_in_new'],
  [SquarePen, 'edit_square'],
  [Pencil, 'edit'],
  [Trash2, 'delete'],
  [VenetianMask, 'masks'],
  [Drama, 'theater_comedy'],
  [Calendar, 'calendar_today'],
  [CalendarDays, 'calendar_month'],
  [CalendarOff, 'event_busy'],
  [CalendarClock, 'event_upcoming'],
  [Clock, 'schedule'],
  [Eye, 'visibility'],
  [EyeOff, 'visibility_off'],
  [Flag, 'flag'],
  [Info, 'info'],
  [Palette, 'palette'],
  [ShieldAlert, 'gpp_maybe'],
  [DoorOpen, 'door_open'],
  [DoorClosed, 'door_front'],
  [Star, 'star'],
  [StarHalf, 'star_half'],
  [MoreHorizontal, 'more_horiz'],
  [Ellipsis, 'more_horiz'],
  [AlertTriangle, 'warning'],
  [TriangleAlert, 'warning'],
  [Plus, 'add'],
  [Copy, 'content_copy'],
  [Languages, 'translate'],
  [LogOut, 'logout'],
  [MessageSquareText, 'chat'],
  [Tag, 'sell'],
]);

/**
 * An icon's size from its classes, where it is set there (size-5) rather than
 * by `size`: a glyph needs it as a font size, which no class gives it.
 */
function sizeFromClass(className: string): number | undefined {
  let size: number | undefined;
  for (const match of className.matchAll(/(?:^|\s)size-(?:(\d+(?:\.\d+)?)|\[(\d+(?:\.\d+)?)px\])(?=\s|$)/g)) {
    size = match[1] !== undefined ? Number(match[1]) * 4 : Number(match[2]);
  }
  return size;
}

/**
 * expo-symbols' view, where this build has it. A build made before the module
 * was in it would throw on the first symbol, so ask first and keep Lucide.
 */
const SymbolView: React.ComponentType<SymbolViewProps> | null = (() => {
  if (Platform.OS !== 'ios') return null;
  try {
    if (!requireOptionalNativeModule('SymbolModule')) return null;
    // Required here, not imported: importing it is what would throw.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-symbols').SymbolView as React.ComponentType<SymbolViewProps>;
  } catch {
    return null;
  }
})();

function SymbolImpl(props: SymbolViewProps) {
  return SymbolView ? <SymbolView {...props} /> : null;
}

cssInterop(SymbolImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: 'size',
      width: 'size',
      color: 'tintColor',
    },
  },
});

/**
 * A wrapper component for Lucide icons with Nativewind `className` support via `cssInterop`.
 *
 * This component allows you to render any Lucide icon while applying utility classes
 * using `nativewind`. It avoids the need to wrap or configure each icon individually.
 *
 * In Chenfeng on iOS it draws the icon's SF Symbol instead (the table above),
 * in the same size and colour.
 *
 * @component
 * @example
 * ```tsx
 * import { ArrowRight } from 'lucide-react-native';
 * import { Icon } from '@/registry/components/ui/icon';
 *
 * <Icon as={ArrowRight} className="text-red-500" size={16} />
 * ```
 *
 * @param {LucideIcon} as - The Lucide icon component to render.
 * @param {string} className - Utility classes to style the icon using Nativewind.
 * @param {number} size - Icon size (defaults to 14).
 * @param {...LucideProps} ...props - Additional Lucide icon props passed to the "as" icon.
 */
function Icon({ as: IconComponent, className, size = 14, weight, filled, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  const { skin, fontsReady } = useSkin();
  const symbol = skin === 'chenfeng' && SymbolView ? SF_SYMBOLS.get(IconComponent) : undefined;
  const material =
    skin === 'material' && fontsReady && !filled && (props.fill === undefined || props.fill === 'none')
      ? MATERIAL_ICONS.get(IconComponent)
      : undefined;

  if (material) {
    const classes = cn('text-foreground', textClass, className);
    return (
      <MaterialSymbol
        name={material}
        size={sizeFromClass(classes) ?? Number(size)}
        className={classes}
        // An explicit colour (a tag's own) beats the class's, as Lucide's does.
        style={props.color ? { color: props.color } : undefined}
        accessibilityLabel={props.accessibilityLabel}
      />
    );
  }

  if (symbol) {
    const fill = filled || (props.fill !== undefined && props.fill !== 'none');
    return (
      <SymbolImpl
        name={(fill ? (symbol.fill ?? symbol.name) : symbol.name) as SymbolViewProps['name']}
        className={cn('text-foreground', textClass, className)}
        size={Number(size)}
        weight={weight ?? 'regular'}
        // An explicit colour (a tag's own) beats the class's, as Lucide's does.
        style={[props.style, props.color ? { color: props.color } : null] as SymbolViewProps['style']}
        accessibilityLabel={props.accessibilityLabel}
      />
    );
  }

  return (
    <IconImpl
      as={IconComponent}
      className={cn('text-foreground', textClass, className)}
      size={size}
      {...props}
    />
  );
}

export { Icon };
