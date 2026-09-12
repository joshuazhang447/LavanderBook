import { MessageSquareText } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { AdminUser } from '@/lib/admin';

type ReviewsSectionProps = {
  /** Set when this was reached from a user's posted count, null from the nav. */
  author: AdminUser | null;
};

/**
 * A stub, on purpose.
 *
 * It exists now so the posted count in the users table is a real link with a
 * real destination, and so the shape of that hand-off - an AdminUser, not a bare
 * id - is settled before the table is built on top of it. The list itself is the
 * next piece of work.
 */
export function ReviewsSection({ author }: ReviewsSectionProps) {
  return (
    <View className="flex-1">
      <View className="gap-1 border-b border-border px-6 py-5">
        <Text className="text-2xl font-bold text-foreground">Reviews</Text>
        <Text className="text-sm text-muted-foreground">
          {author
            ? `Filtered to ${author.displayName} — ${author.reviewCount} posted.`
            : 'Every review posted to LavenderBook.'}
        </Text>
      </View>

      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Icon as={MessageSquareText} className="size-8 text-muted-foreground" />
        <Text className="text-center text-sm text-muted-foreground">
          {author
            ? `The reviews by ${author.displayName} will be listed here.`
            : 'The reviews list is still to be built.'}
        </Text>
        {author ? (
          <Text className="font-mono text-xs text-muted-foreground">{author.id}</Text>
        ) : null}
      </View>
    </View>
  );
}
