import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

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
  isOnlineVenue,
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
 * A place's name and its description - the two things about it that are ours
 * to word. Tags have their own dialog and notes their own editor under the row:
 * each changes something different about what a reader is shown, and one form
 * for all of it would make a typo fix feel like re-tagging.
 */
export function EditPlaceDialog({ venue, onClose, onSaved }: EditPlaceDialogProps) {
  const [name, setName] = React.useState(venue.name);
  const [description, setDescription] = React.useState(venue.description ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const online = isOnlineVenue(venue);
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const unchanged =
    trimmedName === venue.name && trimmedDescription === (venue.description ?? '');
  const invalid =
    trimmedName.length === 0 ||
    trimmedName.length > VENUE_NAME_MAX ||
    trimmedDescription.length > VENUE_DESCRIPTION_MAX;

  async function save() {
    if (busy || invalid) return;
    if (unchanged) {
      onClose();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateVenue(venue.id, { name: trimmedName, description: trimmedDescription });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be saved.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {venue.name}</DialogTitle>
          <DialogDescription>
            {online
              ? 'An online organisation: its name and description are all a reader sees before opening it.'
              : 'What the app calls this place, and the line it prints under the name.'}
          </DialogDescription>
        </DialogHeader>

        <View className="gap-4">
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

          {error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>

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
