import { Search, X } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

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
import { Text } from '@/components/ui/text';
import {
  defaultKindIconKey,
  KIND_ICON_GROUPS,
  kindIcon,
  kindIconEntry,
  searchKindIcons,
} from '@/lib/kind-icons';
import { cn } from '@/lib/utils';
import type { VenueTag } from '@/lib/venue-tags';

const TOTAL = KIND_ICON_GROUPS.reduce((sum, group) => sum + group.icons.length, 0);

type IconPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tag being edited, for its colours and its slug's default icon. */
  tag: VenueTag;
  /** The icon set on the tag now; null is the slug's default. */
  value: string | null;
  /** The chosen key, or null to go back to the slug's default. */
  onChoose: (key: string | null) => void;
};

/**
 * A window of every icon a kind of place can have, grouped and searchable,
 * opened from the tag's own window.
 *
 * The search looks in each icon's name, its other words and its group, so an
 * admin can type what the place is - "food", "trans", "safe", "newcomers" -
 * rather than guess what the picture is called. Each tile draws the icon in
 * the tag's own colours, as the Directory will. Choosing is two steps, pick
 * then "Use this icon", so a stray click while browsing changes nothing.
 *
 * A Dialog inside the tag's Dialog: two Radix dialogs nest properly, the inner
 * one on top, Escape closing only it. (It is a Select inside a Dialog that
 * misbehaves on the web - see inline-picker.tsx.)
 */
export function IconPickerDialog({ open, onOpenChange, tag, value, onChoose }: IconPickerDialogProps) {
  const fallback = defaultKindIconKey(tag.slug);
  const [query, setQuery] = React.useState('');
  // Starts on what is in use: the chosen icon, or the default it falls back to.
  const [picked, setPicked] = React.useState<string>(value ?? fallback);

  const groups = React.useMemo(() => searchKindIcons(query), [query]);
  // Opens scrolled to the icon in use, so it is in sight with its highlight.
  const scrollRef = React.useRef<ScrollView>(null);
  const scrolledRef = React.useRef(false);
  const opening = value ?? fallback;
  const shown = groups.reduce((sum, group) => sum + group.icons.length, 0);
  const pickedEntry = kindIconEntry(picked);

  function choose() {
    // The default is stored as null, so it follows the slug if that ever changes.
    onChoose(picked === fallback ? null : picked);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sm: as well: the base window caps itself at sm:max-w-lg, which a
          plain max-w does not override at that width and up. */}
      <DialogContent className="w-full max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose an icon</DialogTitle>
          <DialogDescription>
            Drawn on {tag.label}&apos;s map pins and in the Directory, in the tag&apos;s colours.
          </DialogDescription>
        </DialogHeader>

        <View className="gap-1.5">
          <View className="relative justify-center">
            <View className="absolute left-3 z-10" pointerEvents="none">
              <Icon as={Search} className="size-4 text-muted-foreground" />
            </View>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search: food, trans, safe space, music…"
              accessibilityLabel="Search icons"
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
              className="pl-9 pr-9"
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear the search"
                className={cn(
                  'absolute right-2 rounded-full p-1 active:bg-accent',
                  Platform.select({ web: 'cursor-pointer hover:bg-accent' })
                )}>
                <Icon as={X} className="size-4 text-muted-foreground" />
              </Pressable>
            ) : null}
          </View>
          <Text className="text-xs text-muted-foreground" aria-live="polite">
            {query.trim()
              ? shown === 1
                ? '1 icon matches'
                : `${shown} icons match`
              : `${TOTAL} icons`}
          </Text>
        </View>

        <ScrollView ref={scrollRef} className="max-h-[50vh]" contentContainerClassName="gap-5 pb-1">
          {groups.length === 0 ? (
            <View className="items-center gap-1 py-10">
              <Text className="text-sm font-medium text-foreground">
                No icon matches “{query.trim()}”
              </Text>
              <Text className="text-sm text-muted-foreground">
                Try a word for what the place does, like “food” or “health”.
              </Text>
            </View>
          ) : (
            groups.map((group) => (
              <View
                key={group.title}
                className="gap-2"
                onLayout={(event) => {
                  if (scrolledRef.current || query) return;
                  if (!group.icons.some((entry) => entry.key === opening)) return;
                  scrolledRef.current = true;
                  const y = Math.max(0, event.nativeEvent.layout.y - 4);
                  if (y > 0) scrollRef.current?.scrollTo({ y, animated: false });
                }}>
                <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </Text>
                <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-1.5">
                  {group.icons.map((entry) => {
                    const selected = entry.key === picked;
                    return (
                      <Pressable
                        key={entry.key}
                        onPress={() => setPicked(entry.key)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        aria-checked={selected}
                        accessibilityLabel={entry.key === fallback ? `${entry.label}, default` : entry.label}
                        className={cn(
                          'w-[84px] items-center gap-1.5 rounded-lg border-2 px-1 py-2',
                          selected ? 'border-primary bg-accent' : 'border-transparent',
                          Platform.select({
                            web: 'cursor-pointer transition-colors hover:bg-accent focus-visible:border-ring',
                          })
                        )}>
                        <KindBadge tag={tag} icon={entry.icon} size={36} />
                        <Text
                          numberOfLines={2}
                          className={cn(
                            'text-center text-[11px] leading-[14px]',
                            selected ? 'font-semibold text-foreground' : 'text-muted-foreground'
                          )}>
                          {entry.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <DialogFooter className="gap-3 sm:flex-wrap sm:items-center sm:justify-between">
          {/* What "Use this icon" will set, in the tag's colours: the tile's
              highlight can be scrolled out of sight. */}
          <View className="min-w-0 shrink flex-row items-center gap-2 self-start sm:self-auto">
            <KindBadge tag={tag} icon={kindIcon(tag.slug, picked)} size={32} />
            <View>
              <Text className="text-sm font-medium text-foreground">{pickedEntry?.label ?? 'Tag'}</Text>
              <Text className="text-xs text-muted-foreground">
                {picked === fallback ? 'Default for this tag' : 'Chosen'}
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap justify-end gap-2">
            {picked !== fallback ? (
              <Button variant="ghost" onPress={() => setPicked(fallback)}>
                <Text>Use the default</Text>
              </Button>
            ) : null}
            <Button variant="outline" onPress={() => onOpenChange(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button onPress={choose}>
              <Text>Use this icon</Text>
            </Button>
          </View>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
