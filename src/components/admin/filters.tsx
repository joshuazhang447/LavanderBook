import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * The controls every admin list filters itself with.
 *
 * Users, Places and Reviews all ask the same two things of their filter row - a
 * search box that waits for you to stop typing, and a select that is really a
 * `{ value, label }` list - and each had grown its own copy. Three copies of a
 * debounce is three chances for one of them to be 150ms.
 */

/** Waits for typing to stop, so a search is one request rather than one per key. */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export type FilterOption = { value: string; label: string };

/**
 * Finds the option for a value.
 *
 * Rebuilt rather than passed through because `Select` compares by identity, and
 * the readonly tuples these lists are declared as are not assignable to the
 * mutable shape it wants.
 */
export function optionFor(options: readonly FilterOption[], value: string): FilterOption | undefined {
  const found = options.find((option) => option.value === value);
  return found ? { value: found.value, label: found.label } : undefined;
}

type FilterSelectProps = {
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
  /** A tailwind width, applied to the trigger and the content so they agree. */
  width: string;
  label: string;
};

export function FilterSelect({ value, options, onChange, width, label }: FilterSelectProps) {
  return (
    <Select
      value={optionFor(options, value)}
      onValueChange={(option) => option && onChange(option.value)}>
      <SelectTrigger className={width} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className={width}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} label={option.label} />
        ))}
      </SelectContent>
    </Select>
  );
}
