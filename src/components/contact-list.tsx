import {
  ExternalLink,
  Globe,
  Link as LinkIcon,
  Mail,
  MessageSquareText,
  Phone,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { openLink } from '@/components/linked-text';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CONTACT_TEXT } from '@/lib/directory-text';
import { cn } from '@/lib/utils';
import {
  contactDisplay,
  contactHref,
  contactTitle,
  type ContactKind,
  type VenueContact,
} from '@/lib/venue-contacts';

/** Every skin's icon for a kind of contact; Material and Chenfeng map them to their own. */
export const CONTACT_ICONS: Record<ContactKind, LucideIcon> = {
  website: Globe,
  phone: Phone,
  text: MessageSquareText,
  email: Mail,
  link: LinkIcon,
};

/** Read out for the whole row: "Call 613-555-0100, Toll-free". */
export function contactSpoken(contact: VenueContact): string {
  const what = `${CONTACT_TEXT.spoken[contact.kind]} ${contactDisplay(contact)}`;
  return contact.label ? `${what}, ${contact.label}` : what;
}

/**
 * How to reach a place, for Basic and Material: one bordered box, a row per
 * contact - what it is on a small line, the value under it - pressed to open
 * the browser, the dialler, messages or mail. Two short lines a row so five
 * contacts still fit in a phone's window beside the description.
 */
export function ContactList({ contacts }: { contacts: readonly VenueContact[] }) {
  return (
    <View className="overflow-hidden rounded-lg border border-border">
      {contacts.map((contact, index) => {
        const web = contact.kind === 'website' || contact.kind === 'link';
        return (
          <Pressable
            key={contact.id}
            onPress={() => openLink(contactHref(contact))}
            accessibilityRole="link"
            accessibilityLabel={contactSpoken(contact)}
            className={cn(
              'flex-row items-center gap-3 px-3 py-2 active:bg-accent',
              index > 0 && 'border-t border-border',
              Platform.select({ web: 'cursor-pointer transition-colors hover:bg-accent' })
            )}>
            <View className="size-8 items-center justify-center rounded-full bg-secondary">
              <Icon as={CONTACT_ICONS[contact.kind]} className="size-4 text-secondary-foreground" />
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="text-xs text-muted-foreground">
                {contactTitle(contact)}
              </Text>
              <Text numberOfLines={1} className="text-sm font-medium text-foreground">
                {contactDisplay(contact)}
              </Text>
            </View>
            {web ? <Icon as={ExternalLink} className="size-4 text-muted-foreground" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
