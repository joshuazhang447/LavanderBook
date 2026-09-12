import { Check, ChevronDown, ChevronUp, Pencil, Plus, X } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  createVenueNote,
  deleteVenueNote,
  listVenueNotes,
  reorderVenueNotes,
  updateVenueNote,
  type VenueNote,
} from '@/lib/admin';

/** Mirrors venue_notes_body_length in the migration. */
const MAX_BODY = 280;

type VenueNotesProps = {
  venueId: string;
  /** Lets the row refresh its note count. */
  onChanged: () => void;
};

/**
 * The bullet points an admin writes about one venue.
 *
 * These are LavenderBook speaking in its own voice - what we confirmed, not what
 * visitors reported - which is why they are freely editable where a question,
 * once answered, is not. Nothing points at a note and nothing is counted from
 * one, so correcting a wrong one is simply the right thing to do.
 *
 * Mounted only when a row is expanded, so opening the section does not fetch
 * notes for two hundred places on the off-chance.
 */
export function VenueNotes({ venueId, onChanged }: VenueNotesProps) {
  const [notes, setNotes] = React.useState<VenueNote[] | null>(null);
  const [draft, setDraft] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingBody, setEditingBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    listVenueNotes(venueId)
      .then((rows) => {
        if (!active) return;
        setNotes(rows);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setNotes([]);
        setError(cause instanceof Error ? cause.message : 'Could not load the notes.');
      });
    return () => {
      active = false;
    };
  }, [venueId, reloads]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.');
    }
    setBusy(false);
    setReloads((n) => n + 1);
    onChanged();
  }

  function add() {
    const body = draft.trim();
    if (body.length === 0 || body.length > MAX_BODY) return;
    setDraft('');
    void run(() => createVenueNote(venueId, body));
  }

  function saveEdit() {
    const body = editingBody.trim();
    if (!editingId || body.length === 0 || body.length > MAX_BODY) return;
    const id = editingId;
    setEditingId(null);
    void run(() => updateVenueNote(id, body));
  }

  function move(index: number, direction: -1 | 1) {
    if (!notes) return;
    const next = [...notes];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];

    setNotes(next);
    void run(() => reorderVenueNotes(venueId, next.map((note) => note.id)));
  }

  const draftLength = draft.trim().length;

  return (
    <View className="gap-2 rounded-md border border-border bg-muted/30 p-3">
      {notes === null ? (
        <ActivityIndicator size="small" />
      ) : notes.length === 0 ? (
        <Text className="text-xs text-muted-foreground">
          No notes yet. These are the things we know about this place that a review would not
          tell you — opening hours, which door to use, who to ask for.
        </Text>
      ) : (
        notes.map((note, index) =>
          editingId === note.id ? (
            <View key={note.id} className="flex-row items-center gap-2">
              <Input
                value={editingBody}
                onChangeText={setEditingBody}
                maxLength={MAX_BODY}
                autoFocus
                onSubmitEditing={saveEdit}
                className="flex-1"
                aria-label="Edit this note"
              />
              <Button variant="ghost" size="icon" className="size-7" aria-label="Save" onPress={saveEdit}>
                <Icon as={Check} className="size-4 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Cancel"
                onPress={() => setEditingId(null)}>
                <Icon as={X} className="size-4 text-muted-foreground" />
              </Button>
            </View>
          ) : (
            <View key={note.id} className="flex-row items-center gap-2">
              <View className="gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-4"
                  aria-label="Move this note up"
                  disabled={index === 0 || busy}
                  onPress={() => move(index, -1)}>
                  <Icon as={ChevronUp} className="size-3 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-4"
                  aria-label="Move this note down"
                  disabled={index === notes.length - 1 || busy}
                  onPress={() => move(index, 1)}>
                  <Icon as={ChevronDown} className="size-3 text-muted-foreground" />
                </Button>
              </View>
              <Text className="text-sm text-muted-foreground">{'•'}</Text>
              <Text className="flex-1 text-sm text-foreground">{note.body}</Text>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Edit "${note.body}"`}
                onPress={() => {
                  setEditingId(note.id);
                  setEditingBody(note.body);
                }}>
                <Icon as={Pencil} className="size-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Delete "${note.body}"`}
                onPress={() => void run(() => deleteVenueNote(note.id))}>
                <Icon as={X} className="size-3.5 text-muted-foreground" />
              </Button>
            </View>
          )
        )
      )}

      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}

      <View className="flex-row items-center gap-2">
        <Input
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          maxLength={MAX_BODY}
          placeholder="Open 24 hours, staffed overnight"
          className="flex-1"
          aria-label="A new note"
        />
        <Button size="sm" disabled={draftLength === 0 || busy} onPress={add}>
          <Icon as={Plus} className="size-3.5 text-primary-foreground" />
          <Text>Add</Text>
        </Button>
      </View>
      {draftLength > MAX_BODY - 40 ? (
        <Text className="text-xs text-muted-foreground">
          {MAX_BODY - draftLength} characters left. A note is a bullet, not a paragraph.
        </Text>
      ) : null}
    </View>
  );
}
