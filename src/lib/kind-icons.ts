import {
  Accessibility,
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
  CalendarDays,
  Camera,
  Car,
  Clapperboard,
  Coffee,
  Coins,
  CookingPot,
  Crown,
  Dices,
  Disc3,
  DoorOpen,
  Drama,
  Dumbbell,
  Ear,
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
  KeyRound,
  Landmark,
  Languages,
  Laptop,
  Leaf,
  Library,
  LifeBuoy,
  Lightbulb,
  Lock,
  Luggage,
  Mail,
  MapPin,
  Martini,
  Megaphone,
  MessagesSquare,
  Mic,
  Moon,
  Mountain,
  Music,
  Newspaper,
  NonBinary,
  Package,
  Palette,
  PartyPopper,
  PawPrint,
  Phone,
  Pill,
  Puzzle,
  Rainbow,
  Scale,
  Scissors,
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
  Star,
  Stethoscope,
  Store,
  Syringe,
  Tag,
  Tent,
  TestTube,
  Transgender,
  Trees,
  TriangleAlert,
  Trophy,
  Users,
  Utensils,
  VenusAndMars,
  Video,
  Volleyball,
  Wallet,
  WashingMachine,
  Waves,
  Wine,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * The symbols a kind of place can be drawn with: its pin on the map, its row
 * and badge in the Directory. A hundred or so, chosen for what LavenderBook
 * lists - care, housing, food, rights, nightlife, sport, learning - and each
 * matched in every skin: Lucide here, and in src/components/ui/icon.tsx the
 * same symbol from Apple's SF Symbols (Chenfeng on iPhone) and Google's
 * Material Symbols (Material). A symbol missing from one of those tables still
 * draws, as its Lucide shape.
 *
 * A tag stores its symbol's key (tags.icon, chosen in the admin panel's tag
 * window). Keys are kebab-case and never renamed: an installed app that does
 * not know a key - one added to this list later - draws the plain tag symbol,
 * and nothing breaks. A tag with no icon set falls back to its slug's default
 * below, and then to the plain tag.
 *
 * Generated from a checked list: every Lucide name exists in the installed
 * package, every Apple name exists in SF Symbols 4 or earlier (iOS 16), every
 * Material name has a codepoint in the font.
 */

export type KindIconEntry = {
  /** What a tag stores. Stable: never rename one. */
  key: string;
  icon: LucideIcon;
  /** What the picker calls it. */
  label: string;
  /** Other words a search should find it by, space-separated. */
  keywords: string;
};

export type KindIconGroup = { title: string; icons: KindIconEntry[] };

export const KIND_ICON_GROUPS: readonly KindIconGroup[] = [
  {
    title: 'Community and support',
    icons: [
      { key: 'door-open', icon: DoorOpen, label: 'Community centre', keywords: 'hub centre center drop-in entrance space' },
      { key: 'users', icon: Users, label: 'Group', keywords: 'people members community meetup' },
      { key: 'messages-square', icon: MessagesSquare, label: 'Support group', keywords: 'talk peer chat discussion circle' },
      { key: 'speech', icon: Speech, label: 'Speaking', keywords: 'voice talk counselling speaker' },
      { key: 'heart-handshake', icon: HeartHandshake, label: 'Care', keywords: 'support help kindness volunteer charity' },
      { key: 'heart', icon: Heart, label: 'Heart', keywords: 'love affirming friendly' },
      { key: 'megaphone', icon: Megaphone, label: 'Advocacy', keywords: 'activism rights campaign protest' },
      { key: 'calendar-days', icon: CalendarDays, label: 'Events', keywords: 'calendar meetups schedule' },
      { key: 'party-popper', icon: PartyPopper, label: 'Celebration', keywords: 'pride party festival' },
      { key: 'flag', icon: Flag, label: 'Pride flag', keywords: 'pride flag march' },
      { key: 'rainbow', icon: Rainbow, label: 'Rainbow', keywords: 'pride lgbtq queer gay' },
      { key: 'transgender', icon: Transgender, label: 'Trans', keywords: 'trans transgender gender' },
      { key: 'non-binary', icon: NonBinary, label: 'Non-binary', keywords: 'enby nonbinary genderqueer gender' },
      { key: 'venus-and-mars', icon: VenusAndMars, label: 'Gender', keywords: 'gender bisexual intersex' },
    ],
  },
  {
    title: 'Health and care',
    icons: [
      { key: 'stethoscope', icon: Stethoscope, label: 'Healthcare', keywords: 'doctor clinic medical gp' },
      { key: 'heart-pulse', icon: HeartPulse, label: 'Trans healthcare', keywords: 'hormones hrt gender-affirming care' },
      { key: 'hospital', icon: Hospital, label: 'Hospital', keywords: 'emergency clinic urgent care' },
      { key: 'shield-plus', icon: ShieldPlus, label: 'Sexual health', keywords: 'sti hiv testing prep condoms' },
      { key: 'test-tube', icon: TestTube, label: 'Testing', keywords: 'test lab hiv sti results' },
      { key: 'pill', icon: Pill, label: 'Pharmacy', keywords: 'medicine prescriptions drugs prep' },
      { key: 'syringe', icon: Syringe, label: 'Injections', keywords: 'vaccine harm reduction needles' },
      { key: 'brain', icon: Brain, label: 'Mental health', keywords: 'therapy counselling psychology' },
      { key: 'bandage', icon: Bandage, label: 'First aid', keywords: 'injury wound care' },
      { key: 'accessibility', icon: Accessibility, label: 'Accessible', keywords: 'wheelchair disability access ramp' },
      { key: 'ear', icon: Ear, label: 'Deaf and hearing', keywords: 'asl sign language hearing' },
      { key: 'flower-2', icon: Flower2, label: 'Wellness', keywords: 'self-care spa calm' },
      { key: 'leaf', icon: Leaf, label: 'Nature', keywords: 'garden green plants' },
    ],
  },
  {
    title: 'Housing and essentials',
    icons: [
      { key: 'bed-double', icon: BedDouble, label: 'Shelter', keywords: 'housing beds overnight emergency' },
      { key: 'house', icon: House, label: 'Housing', keywords: 'home rent apartment' },
      { key: 'building-2', icon: Building2, label: 'Offices', keywords: 'organisation office agency' },
      { key: 'key-round', icon: KeyRound, label: 'Housing help', keywords: 'keys rent move-in' },
      { key: 'tent', icon: Tent, label: 'Camp', keywords: 'camping outdoor summer camp' },
      { key: 'shirt', icon: Shirt, label: 'Clothing', keywords: 'clothes closet gender-affirming clothing' },
      { key: 'washing-machine', icon: WashingMachine, label: 'Laundry', keywords: 'wash clothes' },
      { key: 'shower-head', icon: ShowerHead, label: 'Showers', keywords: 'shower hygiene wash' },
      { key: 'package', icon: Package, label: 'Supplies', keywords: 'donations kits' },
      { key: 'gift', icon: Gift, label: 'Free items', keywords: 'free giveaway donation' },
      { key: 'scissors', icon: Scissors, label: 'Hair', keywords: 'barber salon haircut' },
    ],
  },
  {
    title: 'Food and drink',
    icons: [
      { key: 'shopping-basket', icon: ShoppingBasket, label: 'Food bank', keywords: 'food groceries pantry free food' },
      { key: 'utensils', icon: Utensils, label: 'Restaurant', keywords: 'meal dining eat' },
      { key: 'cooking-pot', icon: CookingPot, label: 'Community meal', keywords: 'kitchen soup free meal' },
      { key: 'coffee', icon: Coffee, label: 'Café', keywords: 'cafe coffee tea' },
      { key: 'cake-slice', icon: CakeSlice, label: 'Bakery', keywords: 'pastry cake sweets' },
      { key: 'wine', icon: Wine, label: 'Wine bar', keywords: 'wine drinks' },
      { key: 'beer', icon: Beer, label: 'Pub', keywords: 'beer bar tavern' },
      { key: 'martini', icon: Martini, label: 'Nightlife', keywords: 'bar club cocktails' },
    ],
  },
  {
    title: 'Arts and nightlife',
    icons: [
      { key: 'music', icon: Music, label: 'Music', keywords: 'concert live music choir' },
      { key: 'mic', icon: Mic, label: 'Open mic', keywords: 'karaoke singing comedy' },
      { key: 'disc-3', icon: Disc3, label: 'DJ and dancing', keywords: 'club dance dj' },
      { key: 'drama', icon: Drama, label: 'Drag and theatre', keywords: 'drag theatre theater show performance' },
      { key: 'clapperboard', icon: Clapperboard, label: 'Film', keywords: 'cinema movies screening' },
      { key: 'palette', icon: Palette, label: 'Art', keywords: 'gallery painting artist' },
      { key: 'brush', icon: Brush, label: 'Crafts', keywords: 'craft painting workshop' },
      { key: 'camera', icon: Camera, label: 'Photography', keywords: 'photo pictures' },
      { key: 'gamepad-2', icon: Gamepad2, label: 'Games', keywords: 'gaming video games' },
      { key: 'dices', icon: Dices, label: 'Board games', keywords: 'tabletop dnd board game night' },
      { key: 'sparkles', icon: Sparkles, label: 'Sparkle', keywords: 'glam special fabulous' },
    ],
  },
  {
    title: 'Sport and outdoors',
    icons: [
      { key: 'dumbbell', icon: Dumbbell, label: 'Gym', keywords: 'fitness workout training' },
      { key: 'bike', icon: Bike, label: 'Cycling', keywords: 'bike bicycle ride' },
      { key: 'volleyball', icon: Volleyball, label: 'Team sports', keywords: 'sport league team' },
      { key: 'trophy', icon: Trophy, label: 'Competition', keywords: 'tournament win sport' },
      { key: 'footprints', icon: Footprints, label: 'Walking group', keywords: 'walk hike stroll' },
      { key: 'waves', icon: Waves, label: 'Swimming', keywords: 'swim pool beach water' },
      { key: 'mountain', icon: Mountain, label: 'Hiking', keywords: 'hike outdoors nature trail' },
      { key: 'trees', icon: Trees, label: 'Park', keywords: 'park green space outdoors' },
    ],
  },
  {
    title: 'Learning and culture',
    icons: [
      { key: 'book-open', icon: BookOpen, label: 'Books', keywords: 'reading book club' },
      { key: 'library', icon: Library, label: 'Library', keywords: 'books lending library archive' },
      { key: 'graduation-cap', icon: GraduationCap, label: 'School', keywords: 'university college students campus' },
      { key: 'lightbulb', icon: Lightbulb, label: 'Workshops', keywords: 'learning classes ideas education' },
      { key: 'languages', icon: Languages, label: 'Languages', keywords: 'translation french esl newcomers' },
      { key: 'newspaper', icon: Newspaper, label: 'News and media', keywords: 'magazine media press' },
      { key: 'landmark', icon: Landmark, label: 'Museum', keywords: 'museum history institution culture' },
    ],
  },
  {
    title: 'Rights and safety',
    icons: [
      { key: 'scale', icon: Scale, label: 'Legal aid', keywords: 'law lawyer rights justice' },
      { key: 'id-card', icon: IdCard, label: 'ID and name change', keywords: 'id documents name gender marker' },
      { key: 'file-text', icon: FileText, label: 'Paperwork', keywords: 'forms documents applications' },
      { key: 'life-buoy', icon: LifeBuoy, label: 'Crisis', keywords: 'crisis emergency suicide help line' },
      { key: 'phone', icon: Phone, label: 'Helpline', keywords: 'phone call hotline' },
      { key: 'shield', icon: Shield, label: 'Protection', keywords: 'safety security' },
      { key: 'shield-check', icon: ShieldCheck, label: 'Safe space', keywords: 'safe space verified' },
      { key: 'shield-alert', icon: ShieldAlert, label: 'Caution', keywords: 'caution unsafe report' },
      { key: 'triangle-alert', icon: TriangleAlert, label: 'Warning', keywords: 'danger unsafe avoid' },
      { key: 'siren', icon: Siren, label: 'Emergency', keywords: 'police ambulance urgent' },
      { key: 'lock', icon: Lock, label: 'Private', keywords: 'confidential private discreet' },
    ],
  },
  {
    title: 'Work, money and shops',
    icons: [
      { key: 'store', icon: Store, label: 'Queer-owned shop', keywords: 'business shop store owned' },
      { key: 'shopping-bag', icon: ShoppingBag, label: 'Shopping', keywords: 'shop retail boutique' },
      { key: 'briefcase', icon: Briefcase, label: 'Jobs', keywords: 'employment work career' },
      { key: 'wallet', icon: Wallet, label: 'Money help', keywords: 'finance benefits tax income' },
      { key: 'coins', icon: Coins, label: 'Free or low cost', keywords: 'cost free sliding scale' },
      { key: 'laptop', icon: Laptop, label: 'Computers', keywords: 'internet computer access tech' },
      { key: 'wrench', icon: Wrench, label: 'Repairs', keywords: 'repair fix bike tools' },
    ],
  },
  {
    title: 'Getting around and online',
    icons: [
      { key: 'globe', icon: Globe, label: 'Online', keywords: 'online internet website virtual' },
      { key: 'video', icon: Video, label: 'Video calls', keywords: 'zoom virtual meeting' },
      { key: 'mail', icon: Mail, label: 'Email', keywords: 'email mail letters' },
      { key: 'bus', icon: Bus, label: 'Transit', keywords: 'bus transit transportation' },
      { key: 'car', icon: Car, label: 'Rides', keywords: 'car rides driving parking' },
      { key: 'luggage', icon: Luggage, label: 'Newcomers', keywords: 'immigrants refugees arrival newcomers' },
      { key: 'map-pin', icon: MapPin, label: 'Place', keywords: 'location place pin' },
    ],
  },
  {
    title: 'Family, youth and pets',
    icons: [
      { key: 'sprout', icon: Sprout, label: 'Youth', keywords: 'youth young teens growth' },
      { key: 'backpack', icon: Backpack, label: 'Students', keywords: 'school students youth' },
      { key: 'baby', icon: Baby, label: 'Families', keywords: 'parents kids children family' },
      { key: 'puzzle', icon: Puzzle, label: 'Activities', keywords: 'kids games activities' },
      { key: 'paw-print', icon: PawPrint, label: 'Pets', keywords: 'pets dogs animals pet-friendly' },
    ],
  },
  {
    title: 'Symbols',
    icons: [
      { key: 'star', icon: Star, label: 'Star', keywords: 'favourite featured' },
      { key: 'crown', icon: Crown, label: 'Royalty', keywords: 'drag king queen' },
      { key: 'moon', icon: Moon, label: 'Late night', keywords: 'night late' },
      { key: 'tag', icon: Tag, label: 'Tag', keywords: 'label other general' },
    ],
  },
];

const BY_KEY = new Map<string, KindIconEntry>(
  KIND_ICON_GROUPS.flatMap((group) => group.icons.map((entry) => [entry.key, entry] as const))
);

/** The plain tag: a kind with no symbol of its own. */
export const DEFAULT_KIND_ICON_KEY = 'tag';

/**
 * The symbols the first kinds were given before a tag could choose one, by
 * slug - so a tag whose icon was never set (or a server from before the
 * column) still draws as it always has. The migration that added tags.icon
 * wrote these same keys onto those tags.
 */
const DEFAULT_BY_SLUG: Record<string, string> = {
  // A warning, not a resource: drawn as one.
  dangerous: 'triangle-alert',
  crisis: 'life-buoy',
  shelter: 'bed-double',
  food: 'shopping-basket',
  healthcare: 'stethoscope',
  'trans-healthcare': 'heart-pulse',
  'mental-health': 'brain',
  youth: 'sprout',
  legal: 'scale',
  hub: 'door-open',
  'support-group': 'messages-square',
  nightlife: 'martini',
  'queer-owned': 'store',
  'sexual-health': 'shield-plus',
  online: 'globe',
};

export function kindIconEntry(key: string | null | undefined): KindIconEntry | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

/** The key a kind is drawn with: its chosen one, if this app knows it; else its slug's; else the plain tag. */
export function kindIconKey(slug: string, chosen?: string | null): string {
  if (chosen && BY_KEY.has(chosen)) return chosen;
  return DEFAULT_BY_SLUG[slug] ?? DEFAULT_KIND_ICON_KEY;
}

/** The key a new tag starts with, before anyone chooses: its slug's, else the plain tag. */
export function defaultKindIconKey(slug: string): string {
  return DEFAULT_BY_SLUG[slug] ?? DEFAULT_KIND_ICON_KEY;
}

/** The symbol a kind is drawn with. `chosen` is the tag's own icon, from useTagIcons(). */
export function kindIcon(slug: string, chosen?: string | null): LucideIcon {
  return BY_KEY.get(kindIconKey(slug, chosen))?.icon ?? Tag;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** The words of a text, normalised: "Trans healthcare" -> ["trans", "healthcare"]. */
function words(text: string): string[] {
  return normalise(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * How well one word of a search fits an icon. A word of its name counts most,
 * then its other words, then its group's title; and a whole-word match beats
 * one the word starts, which beats one it only appears inside - so "trans"
 * puts Trans and Trans healthcare ahead of Languages ("translation") and
 * Transit. Zero: no match.
 */
function fit(word: string, fields: readonly (readonly [string[], number])[]): number {
  let best = 0;
  for (const [tokens, weight] of fields) {
    for (const token of tokens) {
      const score =
        token === word
          ? weight * 3
          : token.startsWith(word)
            ? weight * 2
            : word.length >= 3 && token.includes(word)
              ? weight
              : 0;
      if (score > best) best = score;
    }
  }
  return best;
}

/** The title of the one group a search shows: everything it found, best first. */
export const SEARCH_RESULTS_TITLE = 'Best matches first';

/**
 * Every icon, in its groups, for an empty `query`. Otherwise one group of the
 * icons matching every word of it - in the name, the key, the other words or
 * the group's title, so "trans", "food" and "safety" all find something -
 * ordered by how well they match, and empty when nothing does.
 */
export function searchKindIcons(query: string): KindIconGroup[] {
  const wanted = words(query);
  if (wanted.length === 0) return [...KIND_ICON_GROUPS];

  const found: { entry: KindIconEntry; score: number; order: number }[] = [];
  let order = 0;
  for (const group of KIND_ICON_GROUPS) {
    const title = words(group.title);
    for (const entry of group.icons) {
      order += 1;
      const fields = [
        [words(entry.label), 4],
        [words(entry.key), 4],
        [words(entry.keywords), 2],
        [title, 1],
      ] as const;
      let score = 0;
      for (const word of wanted) {
        const one = fit(word, fields);
        if (one === 0) {
          score = 0;
          break;
        }
        score += one;
      }
      if (score > 0) found.push({ entry, score, order });
    }
  }

  found.sort((x, y) => y.score - x.score || x.order - y.order);
  return found.length > 0
    ? [{ title: SEARCH_RESULTS_TITLE, icons: found.map((item) => item.entry) }]
    : [];
}

/** "Everything", the first of the Directory's kinds. */
export const EVERY_KIND_ICON = BookOpen;
