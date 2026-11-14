import { AlertTriangle, Globe, MapPin, Search } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { DescriptionField } from '@/components/admin/description-field';
import { TagChip } from '@/components/admin/tag-chip';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import {
  createVenueNote,
  ONLINE_TAG_SLUG,
  upsertVenue,
  VENUE_NAME_MAX,
  type AdminTag,
} from '@/lib/admin';
import { searchPlaces, type PlaceResult } from '@/lib/place-search';
import { cn } from '@/lib/utils';

type PlaceDialogProps = {
  allTags: AdminTag[];
  onClose: () => void;
  /** Told what happened so the section can say "added" or "already knew this". */
  onSaved: (outcome: { created: boolean; name: string; online: boolean }) => void;
};

/** Mirrors venue_notes_body_length: the contact line becomes the first note. */
const NOTE_MAX = 280;

/**
 * Add a place - somewhere with a door, found through the same Google Places
 * search the map uses - or an organisation with no place to visit at all.
 *
 * Goes through `searchPlaces` rather than anything new: that function is the
 * only part of the app that knows where places come from, which is what makes
 * swapping providers a one-file change. See src/lib/place-search.ts.
 *
 * An online organisation is a venue with no coordinates and the Online tag
 * (20261018110000). It is never pinned - a pin says "come here", and there is
 * nowhere to come - so it is found in the list and the Directory instead, and
 * how to reach it is its first note, where links are tappable.
 */
export function PlaceDialog({ allTags, onClose, onSaved }: PlaceDialogProps) {
  const [kind, setKind] = React.useState<'place' | 'online'>('place');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [chosen, setChosen] = React.useState<PlaceResult | null>(null);
  const [tagIds, setTagIds] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const live = allTags.filter((tag) => tag.archivedAt === null);
  // Every other tag asks about a door - step-free entry, drop-in hours - so an
  // online organisation carries this one alone.
  const onlineTag = live.find((tag) => tag.slug === ONLINE_TAG_SLUG) ?? null;
  const [name, setName] = React.useState('');
  const [contact, setContact] = React.useState('');

  async function run() {
    if (query.trim().length === 0 || searching) return;

    setSearching(true);
    setError(null);
    // Null origin: an admin curating the directory is not searching near
    // themselves, and origin only biases ordering anyway.
    const outcome = await searchPlaces(query, null);
    if (outcome.ok) {
      setResults(outcome.results);
    } else {
      setResults([]);
      setError(outcome.message);
    }
    setSearching(false);
  }

  async function save() {
    if (!chosen || tagIds.length === 0 || busy) return;

    setBusy(true);
    setError(null);
    try {
      const outcome = await upsertVenue(
        {
          name: chosen.name,
          googlePlaceId: chosen.placeId,
          address: chosen.address,
          lat: chosen.latitude,
          lng: chosen.longitude,
          description,
        },
        tagIds
      );
      onSaved({ created: outcome.created, name: chosen.name, online: false });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That place could not be added.');
      setBusy(false);
    }
  }

  const onlineName = name.trim();
  const onlineContact = contact.trim();
  const canAddOnline =
    !!onlineTag && onlineName.length > 0 && onlineName.length <= VENUE_NAME_MAX && !busy;

  async function saveOnline() {
    if (!onlineTag || !canAddOnline) return;

    setBusy(true);
    setError(null);
    try {
      // No Google id and no coordinates: always a new row, and never on the map.
      const outcome = await upsertVenue(
        { name: onlineName, googlePlaceId: null, address: null, lat: null, lng: null, description },
        [onlineTag.id]
      );
      if (onlineContact) await createVenueNote(outcome.venueId, onlineContact);
      onSaved({ created: true, name: onlineName, online: true });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That organisation could not be added.');
      setBusy(false);
    }
  }

  // `=== false`, never `!reviewable`. The field is optional, the web build and
  // the edge functions deploy separately, and a client that knows about it will
  // at some point be talking to a function that does not send it. Reading absent
  // as "not reviewable" would turn routine version skew into every result being
  // flagged. See the comment on PlaceResult in src/lib/place-search.ts.
  const notAPlace = chosen?.reviewable === false;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a place</DialogTitle>
          <DialogDescription>
            {kind === 'place'
              ? 'Search for somewhere real, then say what kind of place it is. It goes on the map as soon as it has a tag, without waiting for anyone to review it.'
              : 'A group people reach by website, chat, text or phone, with no place to visit. It is listed in the app\'s list and Directory, never pinned on the map.'}
          </DialogDescription>
        </DialogHeader>

        {/* Which kind of thing is being added: the two need different facts. */}
        <View className="flex-row gap-2" accessibilityRole="radiogroup">
          <Button
            variant={kind === 'place' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            accessibilityRole="radio"
            aria-checked={kind === 'place'}
            onPress={() => {
              setKind('place');
              setError(null);
            }}>
            <Icon
              as={MapPin}
              className={cn('size-4', kind === 'place' ? 'text-primary-foreground' : 'text-foreground')}
            />
            <Text>A place with an address</Text>
          </Button>
          <Button
            variant={kind === 'online' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            accessibilityRole="radio"
            aria-checked={kind === 'online'}
            onPress={() => {
              setKind('online');
              setError(null);
            }}>
            <Icon
              as={Globe}
              className={cn('size-4', kind === 'online' ? 'text-primary-foreground' : 'text-foreground')}
            />
            <Text>Online or by phone</Text>
          </Button>
        </View>

        {kind === 'online' ? (
          <ScrollView className="max-h-[55vh]" contentContainerClassName="gap-4 px-0.5">
            {!onlineTag ? (
              <Text className="text-sm text-destructive">
                There is no Online tag (slug online). Make it in Tags first: an online organisation
                carries that tag and no other.
              </Text>
            ) : null}

            <View className="gap-1.5">
              <Label nativeID="online-name">Name</Label>
              <Input
                aria-labelledby="online-name"
                value={name}
                onChangeText={setName}
                maxLength={VENUE_NAME_MAX}
                placeholder="LGBT YouthLine"
              />
            </View>

            <DescriptionField
              value={description}
              onChangeText={setDescription}
              placeholder="A free text and chat line for LGBTQ+ youth, answered by trained peers."
            />

            <View className="gap-1.5">
              <Label nativeID="online-contact">How to reach them</Label>
              <Textarea
                aria-labelledby="online-contact"
                value={contact}
                onChangeText={setContact}
                maxLength={NOTE_MAX}
                numberOfLines={2}
                placeholder="Text 647-694-4275, or chat at youthline.ca. Free, for LGBTQ+ youth 29 and under."
              />
              <Text className="text-xs text-muted-foreground">
                Becomes its first note. Websites, emails and phone numbers in it are tappable in the
                app. The organisation&apos;s own address only - never a person&apos;s.
              </Text>
            </View>

            <View className="flex-row items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
              <Icon as={Globe} className="mt-0.5 size-4 text-muted-foreground" />
              <Text className="flex-1 text-xs text-muted-foreground">
                It gets the Online tag and no other: every other tag asks reviewers about a door -
                step-free entry, drop-in hours. A group that meets somewhere public is better added
                as that place, with a note naming the group.
              </Text>
            </View>

            {error ? (
              <Text className="text-sm text-destructive" accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </ScrollView>
        ) : (
        <ScrollView className="max-h-[55vh]" contentContainerClassName="gap-4 px-0.5">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
              <Icon as={Search} className="size-4 text-muted-foreground" />
              <Input
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={run}
                placeholder="Name or address"
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
                aria-label="Search for a place"
              />
            </View>
            <Button variant="outline" onPress={run} disabled={searching || query.trim().length === 0}>
              {searching ? <ActivityIndicator size="small" /> : <Text>Search</Text>}
            </Button>
          </View>

          {results !== null && results.length === 0 && !error ? (
            <Text className="text-sm text-muted-foreground">
              Nothing found. Try the street address.
            </Text>
          ) : null}

          {results && results.length > 0 ? (
            <View className="gap-1">
              {results.map((place) => {
                const selected = chosen?.placeId === place.placeId;
                return (
                  <Pressable
                    key={place.placeId}
                    onPress={() => setChosen(place)}
                    className={cn(
                      'flex-row items-start gap-3 rounded-md p-2',
                      selected ? 'bg-accent' : 'active:bg-accent'
                    )}>
                    <Icon as={MapPin} className="mt-0.5 size-4 text-muted-foreground" />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm text-foreground">{place.name}</Text>
                      {place.address ? (
                        <Text className="text-xs text-muted-foreground">{place.address}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {chosen ? (
            <View className="gap-2 border-t border-border pt-4">
              {notAPlace ? (
                <View className="flex-row items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
                  <Icon as={AlertTriangle} className="mt-0.5 size-4 text-muted-foreground" />
                  <Text className="flex-1 text-xs text-muted-foreground">
                    Google calls this a region, road or similar rather than somewhere with a door.
                    You can still add it — you can see it and we cannot — but check it is the
                    building you meant.
                  </Text>
                </View>
              ) : null}

              <Label>What kind of place is {chosen.name}?</Label>
              {live.length === 0 ? (
                <Text className="text-xs text-destructive">
                  There are no tags yet. Make one in Tags first.
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-x-4 gap-y-2">
                  {live.map((tag) => {
                    const on = tagIds.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        onPress={() =>
                          setTagIds(on ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id])
                        }
                        className="flex-row items-center gap-2">
                        {/* See field-dialog.tsx: a Checkbox inside a Pressable eats the
                            press, so it is made non-interactive and the row handles it. */}
                        <View pointerEvents="none">
                          <Checkbox checked={on} onCheckedChange={() => {}} />
                        </View>
                        <TagChip label={tag.label} color={tag.color} textColor={tag.textColor} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Text className="text-xs text-muted-foreground">
                At least one. A place with no tag and no reviews would be created invisible — the
                map only draws somewhere that is reviewed or tagged.
              </Text>

              {/* Asked for here, while whoever is adding the place still knows
                  why: a listed place with nothing under its name is a gap
                  somebody has to come back for. Optional all the same - it can
                  be written from the row's Edit later. */}
              <View className="pt-2">
                <DescriptionField value={description} onChangeText={setDescription} />
              </View>
            </View>
          ) : null}

          {error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </ScrollView>
        )}

        <DialogFooter>
          <Button variant="outline" onPress={onClose} disabled={busy}>
            <Text>Cancel</Text>
          </Button>
          {kind === 'online' ? (
            <Button onPress={saveOnline} disabled={!canAddOnline}>
              {busy ? <ActivityIndicator size="small" /> : <Text>Add organisation</Text>}
            </Button>
          ) : (
            <Button onPress={save} disabled={!chosen || tagIds.length === 0 || busy}>
              {busy ? <ActivityIndicator size="small" /> : <Text>Add place</Text>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
