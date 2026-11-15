import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { OauSegments } from '@/components/oau/segments';
import { Segmented } from '@/components/ui/segmented';
import { Text } from '@/components/ui/text';
import { LIST_FILTER_TEXT, LIST_ORDER_TEXT } from '@/lib/directory-text';
import { selectionTick } from '@/lib/haptics';
import {
  setListFilter,
  setListOrder,
  useListFilter,
  useListOrder,
  type ListFilter,
  type ListOrder,
} from '@/lib/list-filter';
import { useSkin } from '@/lib/skin';
import { cn } from '@/lib/utils';

const ORDER: readonly ListFilter[] = ['all', 'listed', 'visitors'];

/**
 * Which places the list shows: all of them, the ones LavenderBook lists (a
 * place with a tag - a centre, a clinic, a queer-owned shop, whether or not
 * anyone has reviewed it), or the ones visitors found and reviewed that
 * LavenderBook does not list. Every place is one or the other.
 *
 * Each choice says how many it would show, so a choice that would empty the
 * list can be seen to before it is made. Chenfeng draws iOS's segmented
 * control; Basic and Material three pills, the chosen one filled.
 */
export function ListFilterControl({ counts }: { counts: Record<ListFilter, number> }) {
  const value = useListFilter();
  const { skin } = useSkin();

  const choose = (next: ListFilter) => {
    if (next === value) return;
    selectionTick();
    setListFilter(next);
  };

  if (skin === 'oau') {
    return (
      <OauSegments
        options={ORDER.map((filter) => ({
          value: filter,
          label: `${LIST_FILTER_TEXT[filter].label} ${counts[filter]}`,
          spoken: `${LIST_FILTER_TEXT[filter].spoken}, ${counts[filter]}`,
        }))}
        value={value}
        onChange={(next) => setListFilter(next)}
        accessibilityLabel={LIST_FILTER_TEXT.label}
      />
    );
  }

  if (skin === 'chenfeng') {
    return (
      <Segmented
        segments={ORDER.map((filter) => ({
          value: filter,
          label: `${LIST_FILTER_TEXT[filter].title} ${counts[filter]}`,
        }))}
        value={value}
        onChange={choose}
        accessibilityLabel={LIST_FILTER_TEXT.label}
      />
    );
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={LIST_FILTER_TEXT.label} className="flex-row gap-2">
      {ORDER.map((filter) => {
        const chosen = filter === value;
        return (
          <Pressable
            key={filter}
            onPress={() => choose(filter)}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            aria-checked={chosen}
            accessibilityLabel={`${LIST_FILTER_TEXT[filter].spoken}, ${counts[filter]}`}
            className={cn(
              'h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border px-3 active:opacity-80',
              chosen ? 'border-primary bg-primary' : 'border-border bg-card',
              Platform.select({ web: 'cursor-pointer select-none' })
            )}>
            <Text
              numberOfLines={1}
              className={cn('text-sm font-medium', chosen ? 'text-primary-foreground' : 'text-foreground')}>
              {LIST_FILTER_TEXT[filter].label}
            </Text>
            <Text
              className={cn('text-xs', chosen ? 'text-primary-foreground' : 'text-muted-foreground')}
              style={{ fontVariant: ['tabular-nums'] }}>
              {counts[filter]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ORDERS: readonly ListOrder[] = ['nearest', 'rated'];

/**
 * The order the list is in: nearest first, or the best rated first (byRating:
 * a single review does not top the list). Drawn as the filter above it is.
 */
export function ListOrderControl() {
  const value = useListOrder();
  const { skin } = useSkin();

  const choose = (next: ListOrder) => {
    if (next === value) return;
    selectionTick();
    setListOrder(next);
  };

  if (skin === 'oau') {
    return (
      <OauSegments
        options={ORDERS.map((order) => ({
          value: order,
          label: LIST_ORDER_TEXT[order].label,
          spoken: LIST_ORDER_TEXT[order].spoken,
        }))}
        value={value}
        onChange={(next) => setListOrder(next)}
        accessibilityLabel={LIST_ORDER_TEXT.label}
      />
    );
  }

  if (skin === 'chenfeng') {
    return (
      <Segmented
        segments={ORDERS.map((order) => ({ value: order, label: LIST_ORDER_TEXT[order].title }))}
        value={value}
        onChange={choose}
        accessibilityLabel={LIST_ORDER_TEXT.label}
      />
    );
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={LIST_ORDER_TEXT.label} className="flex-row gap-2">
      {ORDERS.map((order) => {
        const chosen = order === value;
        return (
          <Pressable
            key={order}
            onPress={() => choose(order)}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            aria-checked={chosen}
            accessibilityLabel={LIST_ORDER_TEXT[order].spoken}
            className={cn(
              'h-9 flex-1 flex-row items-center justify-center rounded-full border px-3 active:opacity-80',
              chosen ? 'border-primary bg-primary' : 'border-border bg-card',
              Platform.select({ web: 'cursor-pointer select-none' })
            )}>
            <Text
              numberOfLines={1}
              className={cn('text-sm font-medium', chosen ? 'text-primary-foreground' : 'text-foreground')}>
              {LIST_ORDER_TEXT[order].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
