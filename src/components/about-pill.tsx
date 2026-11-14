import { ChevronRight } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { CONTACT_ICONS } from '@/components/contact-list';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ABOUT_TEXT } from '@/lib/directory-text';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';
import type { ContactKind, VenueContact } from '@/lib/venue-contacts';

/** The kinds of contact a place has, each once, in its own order, at most three. */
function contactKinds(contacts: readonly VenueContact[]): ContactKind[] {
  const kinds: ContactKind[] = [];
  for (const contact of contacts) {
    if (!kinds.includes(contact.kind)) kinds.push(contact.kind);
  }
  return kinds.slice(0, 3);
}

/** What the pill says, for the screen reader too. */
export function aboutPillLabel(
  contacts: readonly VenueContact[],
  hasDescription: boolean,
  titleCase: boolean
): string {
  if (contacts.length === 0) return titleCase ? ABOUT_TEXT.moreTitle : ABOUT_TEXT.more;
  if (!hasDescription) return titleCase ? ABOUT_TEXT.contactOnlyTitle : ABOUT_TEXT.contactOnly;
  return titleCase ? ABOUT_TEXT.withContactTitle : ABOUT_TEXT.withContact;
}

/**
 * The way into a place's description window, under the two lines of it on
 * the card. A plain "More" read as "more of the same words", and nobody
 * looked behind it for a phone number - so where the place has contacts, the
 * pill says "Contact & more" and shows them: a badge for each kind it has,
 * website, phone, email, as the window lists them.
 *
 * Drawn inside the card's own pressable; it is a picture of the button, not a
 * second one. Chenfeng tints it like its other secondary buttons; Basic and
 * Material outline it like a chip.
 */
export function AboutPill({
  contacts,
  hasDescription,
}: {
  contacts: readonly VenueContact[];
  hasDescription: boolean;
}) {
  const chenfeng = useSkin().skin === 'chenfeng';
  const kinds = contactKinds(contacts);
  const label = aboutPillLabel(contacts, hasDescription, chenfeng);

  return (
    <View
      className={cn(
        'flex-row items-center self-start rounded-full',
        chenfeng ? 'gap-2 bg-secondary py-1 pr-2.5' : 'gap-2 border border-border bg-card py-1 pr-2',
        kinds.length > 0 ? 'pl-1' : 'pl-3'
      )}>
      {kinds.length > 0 ? (
        // Overlapping, each ringed in the pill's own colour, so they read as
        // one set: everything this place can be reached by.
        <View className="flex-row">
          {kinds.map((kind, index) => (
            <View
              key={kind}
              className={cn(
                'size-6 items-center justify-center rounded-full border-2 bg-primary',
                chenfeng ? 'border-secondary' : 'border-card',
                index > 0 && '-ml-1.5'
              )}>
              <Icon as={CONTACT_ICONS[kind]} className="size-3 text-primary-foreground" />
            </View>
          ))}
        </View>
      ) : null}
      {chenfeng ? (
        <Text textStyle="subheadline" emphasized className="text-primary">
          {label}
        </Text>
      ) : (
        <Text className="text-xs font-semibold text-foreground">{label}</Text>
      )}
      <Icon
        as={ChevronRight}
        className={cn('size-3.5', chenfeng ? 'text-primary' : 'text-muted-foreground')}
      />
    </View>
  );
}
