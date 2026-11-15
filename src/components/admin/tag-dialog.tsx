import { Check } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import { IconPickerDialog } from '@/components/admin/icon-picker';
import { TagChipPreview } from '@/components/admin/tag-chip';
import { KindBadge } from '@/components/kind-badge';
import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import {
  createTag,
  fetchTagDescribesPlace,
  setTagDescribesPlace,
  setTagIcon,
  updateTag,
  type AdminTag,
  type TagDraft,
} from '@/lib/admin';
import { defaultKindIconKey, kindIcon, kindIconEntry, kindIconKey } from '@/lib/kind-icons';
import { refreshTagIcons, useTagIcons, useTagIconsSupported } from '@/lib/tag-icons';
import { isValidHex, TAG_COLOR_PRESETS } from '@/lib/tag-colors';
import { cn } from '@/lib/utils';

/** Mirrors tags_slug_format and tags_slug_length in the migration. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

type TagDialogProps = {
  /** Null creates a new tag; a tag edits it. */
  tag: AdminTag | null;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Create or edit one tag.
 *
 * The parent mounts this fresh per tag (keyed), so every field can initialise
 * straight from props. That is deliberate: syncing props into state with an
 * effect is what the lint rule about setState-in-effect exists to prevent, and
 * remounting is both simpler and impossible to get subtly wrong.
 *
 * This is the one place in the panel with a Save button. Everything else applies
 * on the spot, but a half-typed hex is not a colour and a blank label is not a
 * tag - a form needs a moment where it is not yet true.
 */
export function TagDialog({ tag, onClose, onSaved }: TagDialogProps) {
  const isNew = tag === null;

  const [label, setLabel] = React.useState(tag?.label ?? '');
  const [slug, setSlug] = React.useState(tag?.slug ?? '');
  const [slugEdited, setSlugEdited] = React.useState(!isNew);
  const [description, setDescription] = React.useState(tag?.description ?? '');
  const [color, setColor] = React.useState(tag?.color ?? TAG_COLOR_PRESETS[7]);
  const [autoText, setAutoText] = React.useState(tag?.textColor == null);
  const [textColor, setTextColor] = React.useState(tag?.textColor ?? '#FFFFFF');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The icon as stored arrives with the app's tag icons, possibly after this
  // window opens - so the field holds only a change, and shows the stored one
  // until there is one. Undefined: unchanged; null: back to the default.
  const tagIcons = useTagIcons();
  const iconsSupported = useTagIconsSupported();
  const storedIcon = tag ? (tagIcons[tag.slug] ?? null) : null;
  const [chosenIcon, setChosenIcon] = React.useState<string | null | undefined>(undefined);
  const icon = chosenIcon === undefined ? storedIcon : chosenIcon;
  const [pickingIcon, setPickingIcon] = React.useState(false);
  // Whether its questions go to every reviewer or only to those who used it.
  // Read when the window opens; undefined until then, null on a server
  // without the setting (the switch is then left out).
  const [storedDescribes, setStoredDescribes] = React.useState<boolean | null | undefined>(
    undefined
  );
  const [chosenDescribes, setChosenDescribes] = React.useState<boolean | undefined>(undefined);
  const describesPlace = chosenDescribes ?? storedDescribes ?? false;
  const tagId = tag?.id ?? null;
  React.useEffect(() => {
    let active = true;
    fetchTagDescribesPlace(tagId)
      .then((value) => active && setStoredDescribes(value))
      .catch(() => active && setStoredDescribes(null));
    return () => {
      active = false;
    };
  }, [tagId]);

  function onLabelChange(next: string) {
    setLabel(next);
    // Follows the label until someone types a slug of their own, then stops.
    if (isNew && !slugEdited) setSlug(slugify(next));
  }

  const effectiveTextColor = autoText ? null : textColor;
  const colorValid = isValidHex(color);
  const textValid = autoText || isValidHex(textColor);
  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 2;
  const canSave =
    !busy && label.trim().length >= 2 && colorValid && textValid && (!isNew || slugValid);
  /** The tag as the Directory would draw it, from what is typed so far. */
  const previewTag = {
    slug: slug || 'tag',
    label: label.trim() || 'this tag',
    color: colorValid ? color : '#71717A',
    textColor: textValid ? effectiveTextColor : null,
  };

  async function save() {
    if (!canSave) return;

    setBusy(true);
    setError(null);

    const draft: TagDraft = {
      label: label.trim(),
      description: description.trim(),
      color: color.toUpperCase(),
      textColor: effectiveTextColor,
    };

    try {
      const id = isNew ? await createTag(slug, draft) : tag.id;
      if (!isNew) await updateTag(tag.id, draft);
      // After the tag itself, so a server without icons still saves the rest.
      // A new tag's default needs no row: null already means its slug's default.
      if (chosenIcon !== undefined && chosenIcon !== storedIcon) {
        await setTagIcon(id, chosenIcon);
        await refreshTagIcons();
      }
      if (
        typeof storedDescribes === 'boolean' &&
        chosenDescribes !== undefined &&
        chosenDescribes !== storedDescribes
      ) {
        await setTagDescribesPlace(id, chosenDescribes);
      }
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
          <DialogTitle>{isNew ? 'New tag' : `Edit ${tag.label}`}</DialogTitle>
          <DialogDescription>
            A tag says what kind of place a venue is, and carries its own questions.
          </DialogDescription>
        </DialogHeader>

        <ScrollView className="max-h-[60vh]" contentContainerClassName="gap-4 px-0.5">
          <View className="gap-1.5">
            <Label nativeID="tag-label">Name</Label>
            <Input
              aria-labelledby="tag-label"
              value={label}
              onChangeText={onLabelChange}
              placeholder="Shelter"
            />
          </View>

          <View className="gap-1.5">
            <Label nativeID="tag-slug">Slug</Label>
            <Input
              aria-labelledby="tag-slug"
              value={slug}
              editable={isNew}
              onChangeText={(next) => {
                setSlugEdited(true);
                setSlug(slugify(next));
              }}
              placeholder="shelter"
              className={cn(!isNew && 'opacity-60')}
            />
            <Text className="text-xs text-muted-foreground">
              {isNew
                ? 'Lower case, dashes for spaces. Cannot be changed later.'
                : 'Fixed once created — anything holding a reference keys off it. Retire the tag and make a new one instead.'}
            </Text>
          </View>

          {/* Which symbol the kind is drawn with, in its colours, as the
              Directory draws it. Its window lists them all, searchable. */}
          <View className="gap-1.5">
            <Label nativeID="tag-icon">Icon</Label>
            {iconsSupported === false ? (
              <Text className="text-xs text-muted-foreground">
                The database does not have tag icons yet. They need the newest migration (npx
                supabase db push); until then each tag keeps the icon its slug gives it.
              </Text>
            ) : (
              <View className="flex-row items-center gap-3 rounded-lg border border-border p-2.5">
                <KindBadge
                  tag={previewTag}
                  icon={kindIcon(slug || 'tag', icon)}
                  size={40}
                />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">
                    {kindIconEntry(kindIconKey(slug, icon))?.label ?? 'Tag'}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {icon === null || icon === defaultKindIconKey(slug)
                      ? 'The default for this tag. Shown on its map pins and in the Directory.'
                      : 'Shown on its map pins and in the Directory.'}
                  </Text>
                </View>
                <Button
                  variant="outline"
                  size="sm"
                  aria-labelledby="tag-icon"
                  disabled={busy || iconsSupported !== true}
                  onPress={() => setPickingIcon(true)}>
                  <Text>Change</Text>
                </Button>
              </View>
            )}
          </View>

          {/* Who is asked its questions in a review. Left out until it is
              known, and on a server without the setting. */}
          {typeof storedDescribes === 'boolean' ? (
            <View className="gap-2">
              <View className="flex-row items-center justify-between gap-3">
                <Label nativeID="tag-describes-place">Describes the place</Label>
                <Switch
                  aria-labelledby="tag-describes-place"
                  checked={describesPlace}
                  onCheckedChange={setChosenDescribes}
                  disabled={busy}
                />
              </View>
              <Text className="text-xs text-muted-foreground">
                {describesPlace
                  ? 'Every reviewer of a place with this tag is asked its questions, as anyone who walked in could answer them. For what a place is, like a community hub or a campus centre.'
                  : 'A service: its questions go only to reviewers who say they used it. Its required questions are never asked of anyone else.'}
              </Text>
            </View>
          ) : null}

          <View className="gap-1.5">
            <Label nativeID="tag-description">Description</Label>
            <Textarea
              aria-labelledby="tag-description"
              value={description}
              onChangeText={setDescription}
              placeholder="Has beds someone can sleep in tonight. Not drop-in day centres — those are hubs."
              numberOfLines={2}
            />
            <Text className="text-xs text-muted-foreground">
              Only shown on this screen. Visitors never see it — it is here so whoever is tagging
              can tell two similar tags apart.
            </Text>
          </View>

          <View className="gap-2">
            <Label nativeID="tag-color">Colour</Label>
            <View className="flex-row flex-wrap gap-2">
              {TAG_COLOR_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => setColor(preset)}
                  role="button"
                  aria-label={`Use ${preset}`}
                  className={cn(
                    'size-7 items-center justify-center rounded-full border-2',
                    color.toUpperCase() === preset ? 'border-foreground' : 'border-transparent',
                    Platform.select({ web: 'cursor-pointer' })
                  )}
                  style={{ backgroundColor: preset }}>
                  {color.toUpperCase() === preset ? (
                    <Icon as={Check} className="size-4 text-white" />
                  ) : null}
                </Pressable>
              ))}
            </View>
            <Input
              aria-labelledby="tag-color"
              value={color}
              onChangeText={setColor}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="#6D0FF0"
              className={cn('font-mono', !colorValid && 'border-destructive')}
            />
            {!colorValid ? (
              <Text className="text-xs text-destructive">Needs to be a six-digit hex, like #6D0FF0.</Text>
            ) : null}
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Label nativeID="tag-auto-text">Work out the text colour</Label>
              <Switch
                aria-labelledby="tag-auto-text"
                checked={autoText}
                onCheckedChange={setAutoText}
              />
            </View>
            <Text className="text-xs text-muted-foreground">
              {autoText
                ? 'The colour above becomes a tint that adapts to light and dark, with readable text worked out for each.'
                : 'Your two colours are used exactly as given, the same in both themes.'}
            </Text>
            {!autoText ? (
              <Input
                value={textColor}
                onChangeText={setTextColor}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="#FFFFFF"
                aria-label="Text colour"
                className={cn('font-mono', !textValid && 'border-destructive')}
              />
            ) : null}
          </View>

          <View className="gap-1.5">
            <Label>Preview</Label>
            <TagChipPreview
              label={label || 'Tag'}
              color={colorValid ? color : '#71717A'}
              textColor={textValid ? effectiveTextColor : null}
            />
            <Text className="text-xs text-muted-foreground">
              Chip text is small, so 4.5:1 is the bar it has to clear. Below that the panel says
              so but still lets you save it.
            </Text>
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
          <Button onPress={save} disabled={!canSave}>
            {busy ? <ActivityIndicator size="small" /> : <Text>{isNew ? 'Create tag' : 'Save'}</Text>}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Mounted only while open, so each opening starts from what is set now. */}
      {pickingIcon ? (
        <IconPickerDialog
          open
          onOpenChange={(next) => !next && setPickingIcon(false)}
          tag={previewTag}
          value={icon}
          onChoose={setChosenIcon}
        />
      ) : null}
    </Dialog>
  );
}
