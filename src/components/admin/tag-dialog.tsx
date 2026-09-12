import { Check } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import { TagChipPreview } from '@/components/admin/tag-chip';
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
import { createTag, updateTag, type AdminTag, type TagDraft } from '@/lib/admin';
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
      if (isNew) await createTag(slug, draft);
      else await updateTag(tag.id, draft);
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
    </Dialog>
  );
}
