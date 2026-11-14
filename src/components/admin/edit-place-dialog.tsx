import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import {
  ContactsEditor,
  sameContacts,
  toEditorContacts,
  type EditorContact,
} from '@/components/admin/contacts-editor';
import { DescriptionField } from '@/components/admin/description-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import {
  contactProblem,
  isOnlineVenue,
  listVenueContacts,
  setVenueContacts,
  updateVenue,
  VENUE_DESCRIPTION_MAX,
  VENUE_NAME_MAX,
  type AdminVenue,
} from '@/lib/admin';

type EditPlaceDialogProps = {
  venue: AdminVenue;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * A place's name, its description and how to reach it - the things about it
 * that are ours to word, and that its description window shows. Tags have their
 * own dialog and notes their own editor under the row: each changes something
 * different about what a reader is shown, and one form for all of it would make
 * a typo fix feel like re-tagging.
 */
export function EditPlaceDialog({ venue, onClose, onSaved }: EditPlaceDialogProps) {
  const [name, setName] = React.useState(venue.name);
  const [description, setDescription] = React.useState(venue.description ?? '');
  /**
   * `undefined` while loading, `null` on a server without contacts yet - the
   * form then leaves them alone - and otherwise what was stored, to compare.
   */
  const [storedContacts, setStoredContacts] = React.useState<EditorContact[] | null | undefined>();
  const [contacts, setContacts] = React.useState<EditorContact[]>([]);
  const [contactsError, setContactsError] = React.useState<string | null>(null);
  const [triedSave, setTriedSave] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    listVenueContacts(venue.id)
      .then((list) => {
        if (!active) return;
        const rows = list ? toEditorContacts(list) : null;
        setStoredContacts(rows);
        setContacts(rows ?? []);
      })
      .catch((cause) => {
        if (!active) return;
        setStoredContacts(null);
        setContactsError(cause instanceof Error ? cause.message : 'Contacts could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [venue.id]);

  const online = isOnlineVenue(venue);
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const placeUnchanged =
    trimmedName === venue.name && trimmedDescription === (venue.description ?? '');
  const contactsUnchanged = !storedContacts || sameContacts(contacts, storedContacts);
  const invalid =
    trimmedName.length === 0 ||
    trimmedName.length > VENUE_NAME_MAX ||
    trimmedDescription.length > VENUE_DESCRIPTION_MAX;
  const contactsInvalid = !contactsUnchanged && contacts.some((draft) => contactProblem(draft));

  async function save() {
    if (busy || invalid) return;
    if (contactsInvalid) {
      setTriedSave(true);
      return;
    }
    if (placeUnchanged && contactsUnchanged) {
      onClose();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (!placeUnchanged) {
        await updateVenue(venue.id, { name: trimmedName, description: trimmedDescription });
      }
      if (!contactsUnchanged) await setVenueContacts(venue.id, contacts);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be saved.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-full max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {venue.name}</DialogTitle>
          <DialogDescription>
            {online
              ? 'An online organisation: its name and description are all a reader sees before opening it.'
              : 'What the app calls this place, the line it prints under the name, and how to reach it.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollView className="max-h-[60vh]" contentContainerClassName="gap-4 px-0.5">
          <View className="gap-1.5">
            <Label nativeID="place-name">Name</Label>
            <Input
              aria-labelledby="place-name"
              value={name}
              onChangeText={setName}
              maxLength={VENUE_NAME_MAX}
              onSubmitEditing={save}
            />
            {/* Said because it is true and would otherwise be a surprise: adding
                a known place again from search refreshes the name from Google. */}
            {venue.googlePlaceId ? (
              <Text className="text-xs text-muted-foreground">
                The name came from Google. Change it when Google names the building rather than
                the group inside it; adding this place again from search puts Google&apos;s back.
              </Text>
            ) : null}
          </View>

          <DescriptionField
            value={description}
            onChangeText={setDescription}
            placeholder={
              online
                ? 'A free text and chat line for LGBTQ+ youth, answered by trained peers.'
                : undefined
            }
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">Contact</Text>
            <Text className="text-xs text-muted-foreground">
              Shown in the place&apos;s description window, in this order. The organisation&apos;s
              own published website, numbers and addresses only - never a person&apos;s.
            </Text>
            {storedContacts === undefined ? (
              <ActivityIndicator size="small" className="self-start py-2" />
            ) : storedContacts === null ? (
              <Text className="text-sm text-muted-foreground">
                {contactsError ??
                  'The database does not have contacts yet. They need the newest migration (npx supabase db push).'}
              </Text>
            ) : (
              <ContactsEditor
                contacts={contacts}
                onChange={setContacts}
                showProblems={triedSave}
                disabled={busy}
              />
            )}
          </View>

          {error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <DialogFooter>
          <Button variant="outline" onPress={onClose} disabled={busy}>
            <Text>Cancel</Text>
          </Button>
          <Button onPress={save} disabled={busy || invalid}>
            {busy ? <ActivityIndicator size="small" /> : <Text>Save</Text>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
