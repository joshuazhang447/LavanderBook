import {
  BedDouble,
  BookOpen,
  Brain,
  DoorOpen,
  Globe,
  HeartPulse,
  LifeBuoy,
  Martini,
  MessagesSquare,
  Scale,
  ShieldPlus,
  ShoppingBasket,
  Sprout,
  Stethoscope,
  Store,
  Tag,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * A symbol for each kind of place, so the Directory's kinds can be told apart
 * at a glance rather than read one by one - most of all by somebody reading in
 * their second language.
 *
 * Keyed by slug, the tags' stable handle; labels are prose admins can change.
 * A tag added later, which nothing here knows, gets the plain tag symbol: it is
 * still a kind, with its own colours and words, and nothing breaks.
 */
const KIND_ICONS: Record<string, LucideIcon> = {
  crisis: LifeBuoy,
  shelter: BedDouble,
  food: ShoppingBasket,
  healthcare: Stethoscope,
  'trans-healthcare': HeartPulse,
  'mental-health': Brain,
  youth: Sprout,
  legal: Scale,
  hub: DoorOpen,
  'support-group': MessagesSquare,
  nightlife: Martini,
  'queer-owned': Store,
  'sexual-health': ShieldPlus,
  online: Globe,
};

export function kindIcon(slug: string): LucideIcon {
  return KIND_ICONS[slug] ?? Tag;
}

/** "Everything", the first of the Directory's kinds. */
export const EVERY_KIND_ICON = BookOpen;
