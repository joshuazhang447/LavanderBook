import { useColorScheme, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { deriveTagColors } from '@/lib/tag-colors';
import { cn } from '@/lib/utils';

type TagChipProps = {
  label: string;
  /** #rrggbb as stored on the tag. */
  color: string;
  /** Null or undefined means the text colour is computed. */
  textColor?: string | null;
  /**
   * Forces a theme instead of following the device. Only the editor's
   * side-by-side preview should pass this - everywhere else the chip belongs to
   * whichever theme the page is already in.
   */
  scheme?: 'light' | 'dark';
  className?: string;
};

/**
 * A tag, in its own colours.
 *
 * Inline `style` rather than `className`, which is the documented exception
 * rather than an oversight: the colour is a value an admin typed and stored, and
 * Tailwind cannot emit a class for a string it has never seen. `bg-[${color}]`
 * is invisible to the scanner and silently renders nothing - the same trap as
 * `bg-tag-${slug}`. Everything else here stays tokened.
 */
export function TagChip({ label, color, textColor, scheme, className }: TagChipProps) {
  const device = useColorScheme();
  // Safe despite the static-web caveat in AGENTS.md: the panel renders only
  // after a session and an is_admin() round trip, so it is never in prerendered
  // HTML and has nothing to hydrate into a mismatch.
  const resolved = scheme ?? (device === 'dark' ? 'dark' : 'light');
  const colors = deriveTagColors(color, textColor)[resolved];

  return (
    <Badge
      variant="outline"
      className={cn('border-transparent', className)}
      style={{ backgroundColor: colors.background }}>
      <Text style={{ color: colors.foreground }}>{label}</Text>
    </Badge>
  );
}

type ChipPreviewProps = {
  label: string;
  color: string;
  textColor: string | null;
};

/**
 * The chip on both grounds at once, with the measured contrast under each.
 *
 * The whole case for deriving colours is that both themes stay legible, and a
 * claim like that should be visible at the moment someone is choosing rather
 * than discovered later by whoever uses dark mode.
 */
export function TagChipPreview({ label, color, textColor }: ChipPreviewProps) {
  const derived = deriveTagColors(color, textColor);

  return (
    <View className="flex-row gap-2">
      {(['light', 'dark'] as const).map((scheme) => {
        const { contrast } = derived[scheme];
        const passes = contrast >= 4.5;

        return (
          <View
            key={scheme}
            className="flex-1 items-center gap-2 rounded-md border border-border p-3"
            style={{ backgroundColor: scheme === 'light' ? '#FFFFFF' : '#0A0A0A' }}>
            <TagChip label={label || 'Tag'} color={color} textColor={textColor} scheme={scheme} />
            <Text
              className="text-[10px]"
              style={{ color: passes ? '#6B7280' : '#DC2626' }}>
              {scheme} · {contrast.toFixed(1)}:1 {passes ? '✓' : '✕'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
