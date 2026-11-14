import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { InlinePicker } from '@/components/admin/inline-picker';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  CONTACT_LABEL_MAX,
  contactProblem,
  VENUE_CONTACTS_MAX,
  type ContactDraft,
} from '@/lib/admin';
import { CONTACT_TEXT } from '@/lib/directory-text';
import { CONTACT_KINDS, type ContactKind, type VenueContact } from '@/lib/venue-contacts';

/** A row of the form: a draft, and a key that survives reordering. */
export type EditorContact = ContactDraft & { key: string };

let nextKey = 0;
const newKey = () => `contact-${(nextKey += 1)}`;

export function toEditorContacts(contacts: readonly VenueContact[]): EditorContact[] {
  return contacts.map((contact) => ({
    key: newKey(),
    kind: contact.kind,
    value: contact.value,
    label: contact.label ?? '',
  }));
}

/** Whether two lists would save the same thing: same order, same trimmed words. */
export function sameContacts(a: readonly ContactDraft[], b: readonly ContactDraft[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (draft, index) =>
        draft.kind === b[index].kind &&
        draft.value.trim() === b[index].value.trim() &&
        draft.label.trim() === b[index].label.trim()
    )
  );
}

const KIND_OPTIONS = CONTACT_KINDS.map((kind) => ({ value: kind, label: CONTACT_TEXT.kinds[kind] }));

const VALUE_PLACEHOLDER: Record<ContactKind, string> = {
  website: 'kindspace.ca',
  phone: '613-555-0100',
  text: '613-555-0100',
  email: 'info@example.org',
  link: 'kindspace.ca/trans-id-clinic',
};

/**
 * How to reach a place, as the panel edits it: a row per contact, in the order
 * readers see them, each with its kind, its value and an optional label
 * ("Toll-free", "Crisis line") - required for a link, which is a page of the
 * place's own (a clinic, a booking form) and needs saying what it is.
 *
 * Only an organisation's own published contacts. Never a person's number or
 * address, even a staff member's that is on the website.
 */
export function ContactsEditor({
  contacts,
  onChange,
  showProblems,
  disabled,
}: {
  contacts: EditorContact[];
  onChange: (next: EditorContact[]) => void;
  /** After a save was tried: every row's problem, not only the touched ones. */
  showProblems: boolean;
  disabled?: boolean;
}) {
  const update = (key: string, patch: Partial<ContactDraft>) =>
    onChange(contacts.map((contact) => (contact.key === key ? { ...contact, ...patch } : contact)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...contacts];
    const [moved] = next.splice(index, 1);
    next.splice(index + by, 0, moved);
    onChange(next);
  };

  return (
    <View className="gap-2">
      {contacts.length === 0 ? (
        <Text className="text-sm text-muted-foreground">
          No contacts yet. Readers see the website, numbers and addresses written in the notes
          until you add some here.
        </Text>
      ) : null}

      {contacts.map((contact, index) => {
        const problem = showProblems ? contactProblem(contact) : null;
        return (
          <View key={contact.key} className="gap-2 rounded-md border border-border p-2.5">
            <View className="flex-row items-start gap-2">
              <View className="flex-1">
                <InlinePicker
                  value={contact.kind}
                  options={KIND_OPTIONS}
                  onChange={(kind) => update(contact.key, { kind })}
                  disabled={disabled}
                />
              </View>
              <View className="flex-row">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={disabled || index === 0}
                  onPress={() => move(index, -1)}
                  accessibilityLabel="Move up">
                  <Icon as={ArrowUp} className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={disabled || index === contacts.length - 1}
                  onPress={() => move(index, 1)}
                  accessibilityLabel="Move down">
                  <Icon as={ArrowDown} className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={disabled}
                  onPress={() => onChange(contacts.filter((other) => other.key !== contact.key))}
                  accessibilityLabel="Remove contact">
                  <Icon as={Trash2} className="size-4 text-destructive" />
                </Button>
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Input
                className="min-w-48 flex-[2]"
                value={contact.value}
                onChangeText={(value) => update(contact.key, { value })}
                placeholder={VALUE_PLACEHOLDER[contact.kind]}
                accessibilityLabel={CONTACT_TEXT.kinds[contact.kind]}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={300}
                editable={!disabled}
              />
              <Input
                className="min-w-32 flex-1"
                value={contact.label}
                onChangeText={(label) => update(contact.key, { label })}
                placeholder={contact.kind === 'link' ? 'What it is' : 'Label (optional)'}
                accessibilityLabel="Label"
                maxLength={CONTACT_LABEL_MAX}
                editable={!disabled}
              />
            </View>
            {problem ? (
              <Text className="text-xs text-destructive" accessibilityRole="alert">
                {problem}
              </Text>
            ) : null}
          </View>
        );
      })}

      {contacts.length < VENUE_CONTACTS_MAX ? (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={disabled}
          onPress={() =>
            onChange([...contacts, { key: newKey(), kind: 'website', value: '', label: '' }])
          }>
          <Icon as={Plus} className="size-4" />
          <Text>Add a contact</Text>
        </Button>
      ) : null}
    </View>
  );
}
