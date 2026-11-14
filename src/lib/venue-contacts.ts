import { CONTACT_TEXT } from '@/lib/directory-text';
import { linkify } from '@/lib/linkify';

/**
 * How to reach a place: its website, phone, text line, email, and a few
 * labelled links - kept as data in venue_contacts (20261114100000), shown as
 * rows to press in the window that opens from a place's description.
 */

export type ContactKind = 'website' | 'phone' | 'text' | 'email' | 'link';

export type VenueContact = {
  id: string;
  kind: ContactKind;
  /** An https URL, a phone number as written, or an email address. */
  value: string;
  /** "Toll-free", "Trans ID Clinic". Required for a link, optional otherwise. */
  label: string | null;
};

export const CONTACT_KINDS: readonly ContactKind[] = ['website', 'phone', 'text', 'email', 'link'];

export function isContactKind(value: unknown): value is ContactKind {
  return CONTACT_KINDS.includes(value as ContactKind);
}

function digits(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

/** What pressing the contact opens: the browser, the dialler, messages or mail. */
export function contactHref(contact: Pick<VenueContact, 'kind' | 'value'>): string {
  switch (contact.kind) {
    case 'phone':
      return `tel:${digits(contact.value)}`;
    case 'text':
      return `sms:${digits(contact.value)}`;
    case 'email':
      return `mailto:${contact.value}`;
    default:
      return /^https?:\/\//i.test(contact.value) ? contact.value : `https://${contact.value}`;
  }
}

/** The row's title: its own label, or what kind of contact it is. */
export function contactTitle(contact: Pick<VenueContact, 'kind' | 'label'>): string {
  return contact.label ?? CONTACT_TEXT.kinds[contact.kind];
}

/**
 * The value as a person reads it: a website without its scheme, "www." or a
 * trailing slash ("kindspace.ca/trans-id-clinic"); everything else as written.
 */
export function contactDisplay(contact: Pick<VenueContact, 'kind' | 'value'>): string {
  if (contact.kind !== 'website' && contact.kind !== 'link') return contact.value;
  return contact.value
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

/**
 * Contacts found in a place's own words, for a place nobody has given any yet:
 * every website, email address and phone number written into its description
 * and notes, once each, in the order they appear - found by the same linkify
 * that makes them tappable in the text, so the two can never disagree.
 *
 * Only when the place has no contacts of its own. Once an admin has written
 * them those are the list: merging in what the notes say as well would show
 * the same website twice in two spellings.
 */
export function contactsFromText(texts: readonly (string | null | undefined)[]): VenueContact[] {
  const seen = new Set<string>();
  const found: VenueContact[] = [];

  for (const text of texts) {
    if (!text) continue;
    for (const part of linkify(text)) {
      if (part.kind !== 'link' || seen.has(part.href)) continue;
      seen.add(part.href);
      const kind: ContactKind = part.href.startsWith('mailto:')
        ? 'email'
        : part.href.startsWith('tel:')
          ? 'phone'
          : 'website';
      found.push({ id: `text:${part.href}`, kind, value: part.text, label: null });
    }
  }

  return found;
}
