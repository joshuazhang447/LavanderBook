import { useFocusEffect } from 'expo-router';
import { ChevronDown, ChevronUp, Palette } from 'lucide-react-native';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';
import { chooseSkin, DEFAULT_SKIN, SKINS, useSkinChoice, type Skin } from '@/lib/skin';
import { cn } from '@/lib/utils';

function isSkin(value: string): value is Skin {
  return SKINS.some((option) => option.id === value);
}

/**
 * Which skin the app is drawn in. For everyone, signed in or not, and stored on
 * the device like where the map opens - so it sits beside the settings, not in
 * the account's own card. Applies the moment it is picked.
 *
 * Folded to one line saying which look is on, like the account's settings
 * card: it is changed rarely, and the options only take room. Folded again
 * whenever the tab is left. Chenfeng has a page of its own instead
 * (src/components/chenfeng/setting-pages.tsx).
 */
export function AppearanceSetting() {
  const { skin } = useSkinChoice();
  const [open, setOpen] = React.useState(false);
  const current = SKINS.find((option) => option.id === skin)?.label ?? '';

  // Fold on the way out, so the next visit opens on the one line.
  useFocusEffect(React.useCallback(() => () => setOpen(false), []));

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <View className="rounded-lg border border-border bg-card">
        {/* Only text in here: the options are in the content below, siblings
            rather than children, so no button ends up inside another. */}
        <CollapsibleTrigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              open ? 'Hide appearance options' : `Appearance: ${current}. Show options`
            }
            accessibilityState={{ expanded: open }}
            className={cn(
              'flex-row items-center gap-3 rounded-lg p-4 active:opacity-80',
              Platform.select({ web: 'cursor-pointer' })
            )}>
            <View className="size-9 items-center justify-center rounded-full bg-muted">
              <Icon as={Palette} className="size-5 text-muted-foreground" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-medium text-foreground">Appearance</Text>
              <Text className="text-xs text-muted-foreground">{current}</Text>
            </View>
            <Icon as={open ? ChevronUp : ChevronDown} className="size-5 text-muted-foreground" />
          </Pressable>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <View className="gap-4 px-4 pb-4">
            <Text className="text-xs text-muted-foreground">
              How buttons, switches and the tab bar look on this device.
            </Text>
            <RadioGroup
              value={skin}
              onValueChange={(value) => {
                if (isSkin(value)) void chooseSkin(value);
              }}
              accessibilityLabel="Appearance">
              {SKINS.map((option) => {
                const labelId = `skin-option-${option.id}`;
                return (
                  <View key={option.id} className="flex-row items-center gap-3">
                    <RadioGroupItem value={option.id} aria-labelledby={labelId} />
                    {/* The label selects too, so the whole line is the target and
                        not just the small circle. */}
                    <Label nativeID={labelId} onPress={() => void chooseSkin(option.id)}>
                      <Text className="text-sm font-medium text-foreground">{option.label}</Text>
                      {option.id === DEFAULT_SKIN ? (
                        <Text className="text-sm text-muted-foreground"> (default)</Text>
                      ) : null}
                    </Label>
                  </View>
                );
              })}
            </RadioGroup>
          </View>
        </CollapsibleContent>
      </View>
    </Collapsible>
  );
}
