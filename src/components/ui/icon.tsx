import { MaterialSymbol, type MaterialSymbolName } from '@/components/material/symbol';
import { TextClassContext } from '@/components/ui/text';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';
import { requireOptionalNativeModule } from 'expo';
import type { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import {
  Accessibility,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Baby,
  Backpack,
  Bandage,
  BedDouble,
  Beer,
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  Brush,
  Building2,
  Bus,
  CakeSlice,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Camera,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  CircleCheck,
  CircleUser,
  CircleX,
  Clapperboard,
  Clock,
  Coffee,
  Coins,
  CookingPot,
  Copy,
  Crown,
  Dices,
  Disc3,
  DoorClosed,
  DoorOpen,
  Drama,
  Dumbbell,
  Ear,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Flower2,
  Footprints,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  HeartHandshake,
  HeartPulse,
  Hospital,
  House,
  IdCard,
  Info,
  KeyRound,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Library,
  LifeBuoy,
  Lightbulb,
  Link as LinkIcon,
  List,
  ListChecks,
  Locate,
  LocateFixed,
  LocateOff,
  Lock,
  LogOut,
  Luggage,
  Mail,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  Martini,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Mic,
  Moon,
  MoreHorizontal,
  Mountain,
  Music,
  Navigation,
  NavigationOff,
  Newspaper,
  Package,
  Palette,
  PartyPopper,
  PawPrint,
  Pencil,
  Phone,
  Pill,
  Plus,
  Puzzle,
  Rainbow,
  RotateCw,
  Route,
  Scale,
  Scissors,
  Search,
  SearchX,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShowerHead,
  Siren,
  Sparkles,
  Speech,
  Sprout,
  SquarePen,
  Star,
  StarHalf,
  Stethoscope,
  Store,
  Syringe,
  Tag,
  Tent,
  TestTube,
  Transgender,
  Trash2,
  Trees,
  TriangleAlert,
  Trophy,
  User,
  Users,
  Utensils,
  VenetianMask,
  Video,
  Volleyball,
  Wallet,
  WashingMachine,
  Waves,
  Wine,
  Wrench,
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
  [BookOpen, { name: 'book', fill: 'book.fill' }],
  [Globe, { name: 'globe' }],
  [Mail, { name: 'envelope', fill: 'envelope.fill' }],
  [Phone, { name: 'phone', fill: 'phone.fill' }],
  [MessageSquareText, { name: 'message', fill: 'message.fill' }],
  [LinkIcon, { name: 'link' }],
  [LifeBuoy, { name: 'lifepreserver', fill: 'lifepreserver.fill' }],
  [BedDouble, { name: 'bed.double', fill: 'bed.double.fill' }],
  [ShoppingBasket, { name: 'basket', fill: 'basket.fill' }],
  [Stethoscope, { name: 'stethoscope' }],
  [HeartPulse, { name: 'heart.text.square', fill: 'heart.text.square.fill' }],
  [Brain, { name: 'brain.head.profile' }],
  [Sprout, { name: 'leaf', fill: 'leaf.fill' }],
  [Scale, { name: 'building.columns', fill: 'building.columns.fill' }],
  [MessagesSquare, { name: 'bubble.left.and.bubble.right', fill: 'bubble.left.and.bubble.right.fill' }],
  [Martini, { name: 'wineglass', fill: 'wineglass.fill' }],
  [Store, { name: 'storefront', fill: 'storefront.fill' }],
  [ShieldPlus, { name: 'cross.case', fill: 'cross.case.fill' }],
  // The kinds of place (src/lib/kind-icons.ts).
  [Users, { name: 'person.2', fill: 'person.2.fill' }],
  [Speech, { name: 'person.wave.2', fill: 'person.wave.2.fill' }],
  [HeartHandshake, { name: 'heart.circle', fill: 'heart.circle.fill' }],
  [Heart, { name: 'heart', fill: 'heart.fill' }],
  [Megaphone, { name: 'megaphone', fill: 'megaphone.fill' }],
  [PartyPopper, { name: 'party.popper', fill: 'party.popper.fill' }],
  [Hospital, { name: 'cross.case', fill: 'cross.case.fill' }],
  [TestTube, { name: 'testtube.2' }],
  [Pill, { name: 'pills', fill: 'pills.fill' }],
  [Syringe, { name: 'syringe', fill: 'syringe.fill' }],
  [Bandage, { name: 'bandage', fill: 'bandage.fill' }],
  [Accessibility, { name: 'figure.roll' }],
  [Ear, { name: 'ear', fill: 'ear.fill' }],
  [Flower2, { name: 'camera.macro' }],
  [Leaf, { name: 'leaf', fill: 'leaf.fill' }],
  [House, { name: 'house', fill: 'house.fill' }],
  [Building2, { name: 'building.2', fill: 'building.2.fill' }],
  [KeyRound, { name: 'key', fill: 'key.fill' }],
  [Tent, { name: 'tent', fill: 'tent.fill' }],
  [Shirt, { name: 'tshirt', fill: 'tshirt.fill' }],
  [WashingMachine, { name: 'washer', fill: 'washer.fill' }],
  [ShowerHead, { name: 'shower', fill: 'shower.fill' }],
  [Package, { name: 'shippingbox', fill: 'shippingbox.fill' }],
  [Gift, { name: 'gift', fill: 'gift.fill' }],
  [Scissors, { name: 'scissors' }],
  [Utensils, { name: 'fork.knife' }],
  [CookingPot, { name: 'frying.pan', fill: 'frying.pan.fill' }],
  [Coffee, { name: 'cup.and.saucer', fill: 'cup.and.saucer.fill' }],
  [CakeSlice, { name: 'birthday.cake', fill: 'birthday.cake.fill' }],
  [Wine, { name: 'wineglass', fill: 'wineglass.fill' }],
  [Beer, { name: 'mug', fill: 'mug.fill' }],
  [Music, { name: 'music.note' }],
  [Mic, { name: 'music.mic' }],
  [Disc3, { name: 'opticaldisc', fill: 'opticaldisc.fill' }],
  [Clapperboard, { name: 'film', fill: 'film.fill' }],
  [Brush, { name: 'paintbrush', fill: 'paintbrush.fill' }],
  [Camera, { name: 'camera', fill: 'camera.fill' }],
  [Gamepad2, { name: 'gamecontroller', fill: 'gamecontroller.fill' }],
  [Dices, { name: 'dice', fill: 'dice.fill' }],
  [Sparkles, { name: 'sparkles' }],
  [Dumbbell, { name: 'dumbbell', fill: 'dumbbell.fill' }],
  [Bike, { name: 'bicycle' }],
  [Volleyball, { name: 'volleyball', fill: 'volleyball.fill' }],
  [Trophy, { name: 'trophy', fill: 'trophy.fill' }],
  [Footprints, { name: 'figure.walk' }],
  [Waves, { name: 'water.waves' }],
  [Mountain, { name: 'mountain.2', fill: 'mountain.2.fill' }],
  [Trees, { name: 'tree', fill: 'tree.fill' }],
  [Library, { name: 'books.vertical', fill: 'books.vertical.fill' }],
  [GraduationCap, { name: 'graduationcap', fill: 'graduationcap.fill' }],
  [Lightbulb, { name: 'lightbulb', fill: 'lightbulb.fill' }],
  [Languages, { name: 'character.bubble', fill: 'character.bubble.fill' }],
  [Newspaper, { name: 'newspaper', fill: 'newspaper.fill' }],
  [Landmark, { name: 'building.columns', fill: 'building.columns.fill' }],
  [IdCard, { name: 'person.text.rectangle', fill: 'person.text.rectangle.fill' }],
  [FileText, { name: 'doc.text', fill: 'doc.text.fill' }],
  [Shield, { name: 'shield', fill: 'shield.fill' }],
  [ShieldCheck, { name: 'checkmark.shield', fill: 'checkmark.shield.fill' }],
  [Siren, { name: 'light.beacon.max', fill: 'light.beacon.max.fill' }],
  [Lock, { name: 'lock', fill: 'lock.fill' }],
  [ShoppingBag, { name: 'bag', fill: 'bag.fill' }],
  [Briefcase, { name: 'briefcase', fill: 'briefcase.fill' }],
  [Wallet, { name: 'wallet.pass', fill: 'wallet.pass.fill' }],
  [Coins, { name: 'dollarsign.circle', fill: 'dollarsign.circle.fill' }],
  [Laptop, { name: 'laptopcomputer' }],
  [Wrench, { name: 'wrench.adjustable', fill: 'wrench.adjustable.fill' }],
  [Video, { name: 'video', fill: 'video.fill' }],
  [Bus, { name: 'bus', fill: 'bus.fill' }],
  [Car, { name: 'car', fill: 'car.fill' }],
  [Luggage, { name: 'suitcase', fill: 'suitcase.fill' }],
  [Backpack, { name: 'backpack', fill: 'backpack.fill' }],
  [Baby, { name: 'figure.and.child.holdinghands' }],
  [Puzzle, { name: 'puzzlepiece', fill: 'puzzlepiece.fill' }],
  [PawPrint, { name: 'pawprint', fill: 'pawprint.fill' }],
  [Crown, { name: 'crown', fill: 'crown.fill' }],
  [Moon, { name: 'moon', fill: 'moon.fill' }],
  [Tag, { name: 'tag', fill: 'tag.fill' }],
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
  [BookOpen, 'menu_book'],
  [Globe, 'language'],
  [Mail, 'mail'],
  [Phone, 'call'],
  [LinkIcon, 'link'],
  [LifeBuoy, 'sos'],
  [BedDouble, 'bed'],
  [ShoppingBasket, 'restaurant'],
  [Stethoscope, 'stethoscope'],
  [HeartPulse, 'medical_services'],
  [Brain, 'psychology'],
  [Scale, 'balance'],
  [MessagesSquare, 'forum'],
  [Martini, 'nightlife'],
  [Store, 'storefront'],
  [ShieldPlus, 'health_and_safety'],
  // The kinds of place (src/lib/kind-icons.ts).
  [Speech, 'record_voice_over'],
  [HeartHandshake, 'volunteer_activism'],
  [Heart, 'favorite'],
  [Megaphone, 'campaign'],
  [PartyPopper, 'celebration'],
  [Rainbow, 'looks'],
  [Transgender, 'transgender'],
  [Hospital, 'local_hospital'],
  [TestTube, 'science'],
  [Pill, 'medication'],
  [Syringe, 'vaccines'],
  [Bandage, 'healing'],
  [Accessibility, 'accessible'],
  [Ear, 'hearing'],
  [Flower2, 'local_florist'],
  [Leaf, 'eco'],
  [House, 'home'],
  [Building2, 'domain'],
  [KeyRound, 'key'],
  [Tent, 'camping'],
  [Shirt, 'checkroom'],
  [WashingMachine, 'local_laundry_service'],
  [ShowerHead, 'shower'],
  [Package, 'inventory_2'],
  [Gift, 'redeem'],
  [Scissors, 'content_cut'],
  [Utensils, 'restaurant'],
  [CookingPot, 'soup_kitchen'],
  [Coffee, 'local_cafe'],
  [CakeSlice, 'cake'],
  [Wine, 'wine_bar'],
  [Beer, 'sports_bar'],
  [Music, 'music_note'],
  [Mic, 'mic'],
  [Disc3, 'album'],
  [Clapperboard, 'movie'],
  [Brush, 'brush'],
  [Camera, 'photo_camera'],
  [Gamepad2, 'sports_esports'],
  [Dices, 'casino'],
  [Sparkles, 'auto_awesome'],
  [Dumbbell, 'fitness_center'],
  [Bike, 'pedal_bike'],
  [Volleyball, 'sports_volleyball'],
  [Trophy, 'emoji_events'],
  [Footprints, 'directions_walk'],
  [Waves, 'pool'],
  [Mountain, 'landscape'],
  [Trees, 'park'],
  [Library, 'local_library'],
  [GraduationCap, 'school'],
  [Lightbulb, 'lightbulb'],
  [Newspaper, 'newspaper'],
  [Landmark, 'account_balance'],
  [IdCard, 'badge'],
  [FileText, 'description'],
  [Shield, 'shield'],
  [ShieldCheck, 'verified_user'],
  [Siren, 'emergency'],
  [Lock, 'lock'],
  [ShoppingBag, 'shopping_bag'],
  [Briefcase, 'work'],
  [Wallet, 'account_balance_wallet'],
  [Coins, 'payments'],
  [Laptop, 'laptop'],
  [Wrench, 'build'],
  [Video, 'videocam'],
  [Bus, 'directions_bus'],
  [Car, 'directions_car'],
  [Luggage, 'luggage'],
  [Sprout, 'eco'],
  [Backpack, 'backpack'],
  [Baby, 'child_care'],
  [Puzzle, 'extension'],
  [PawPrint, 'pets'],
  [Crown, 'crown'],
  [Moon, 'dark_mode'],
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
