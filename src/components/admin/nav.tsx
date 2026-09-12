import {
  ListChecks,
  LogOut,
  MapPin,
  MessageSquareText,
  Tag as TagIcon,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * The panel's sections, in display order.
 *
 * Same shape as TABS in src/components/tab-bar.tsx, and for the same reason:
 * adding a section should be adding a line here, not editing a switch in three
 * places. Unlike the tab bar these are not routes - the panel is one screen, so
 * a section is state. That is deliberate. Routes would buy deep links into a
 * panel whose first move is to check the session anyway.
 */
export const SECTIONS = [
  // Ordered by how often a section is opened, not by how the data nests. Users
  // and Reviews are the daily moderation work; tags are set up once and then
  // rarely touched, so they sit at the bottom.
  { name: 'users', label: 'Users', icon: Users },
  { name: 'reviews', label: 'Reviews', icon: MessageSquareText },
  // Lucide's `Tag` collides with nothing here, but it is aliased anyway to match
  // how `Map as MapIcon` is handled in tab-bar.tsx.
  { name: 'tags', label: 'Tags', icon: TagIcon },
  // Below Tags because you reach for it second: a field is written once and then
  // attached from the tag that needs it.
  { name: 'fields', label: 'Custom fields', icon: ListChecks },
  // Last because it depends on the three above: you tag a place with tags that
  // exist, and it asks fields that exist.
  { name: 'places', label: 'Places', icon: MapPin },
] as const satisfies readonly { name: string; label: string; icon: LucideIcon }[];

export type SectionName = (typeof SECTIONS)[number]['name'];

type NavItemProps = {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onPress: () => void;
};

function NavItem({ icon, label, active, onPress }: NavItemProps) {
  return (
    // The context colours the icon and the label together, so neither can drift
    // out of step with the other - the same trick the tab bar uses.
    <TextClassContext.Provider
      value={active ? 'text-primary font-semibold' : 'text-muted-foreground'}>
      <Pressable
        onPress={onPress}
        role="tab"
        aria-selected={active}
        className={cn(
          'flex-row items-center gap-3 rounded-md px-3 py-2',
          active && 'bg-accent',
          'active:bg-accent',
          Platform.select({ web: 'cursor-pointer transition-colors hover:bg-accent' })
        )}>
        <Icon as={icon} className="size-5" />
        <Text className="text-sm">{label}</Text>
      </Pressable>
    </TextClassContext.Provider>
  );
}

type AdminNavProps = {
  section: SectionName;
  onSelect: (section: SectionName) => void;
  /** Shown at the foot, so it is obvious which account is acting. */
  email: string | null;
  onSignOut: () => void;
};

export function AdminNav({ section, onSelect, email, onSignOut }: AdminNavProps) {
  return (
    <View className="w-56 border-r border-border bg-card">
      <View className="gap-0.5 px-4 py-5">
        <Text className="text-base font-semibold text-foreground">LavenderBook</Text>
        <Text className="text-xs text-muted-foreground">Admin</Text>
      </View>

      <Separator />

      <View className="flex-1 gap-1 p-3">
        {SECTIONS.map((item) => (
          <NavItem
            key={item.name}
            icon={item.icon}
            label={item.label}
            active={section === item.name}
            onPress={() => onSelect(item.name)}
          />
        ))}
      </View>

      <Separator />

      <View className="gap-2 p-3">
        {email ? (
          <Text className="px-3 text-xs text-muted-foreground" numberOfLines={1}>
            {email}
          </Text>
        ) : null}
        <TextClassContext.Provider value="text-muted-foreground">
          <Pressable
            onPress={onSignOut}
            role="button"
            className={cn(
              'flex-row items-center gap-3 rounded-md px-3 py-2 active:bg-accent',
              Platform.select({ web: 'cursor-pointer transition-colors hover:bg-accent' })
            )}>
            <Icon as={LogOut} className="size-5" />
            <Text className="text-sm">Sign out</Text>
          </Pressable>
        </TextClassContext.Provider>
      </View>
    </View>
  );
}
