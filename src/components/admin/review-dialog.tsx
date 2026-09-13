import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { StarRating, STAR_HINT } from '@/components/star-rating';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { updateReview, type AdminReview } from '@/lib/admin';
import { ANSWER_LABEL, type Answer } from '@/lib/answers';

/** Mirrors the reviews_body_length check constraint, and review-sheet.tsx. */
const MAX_BODY = 2000;

/** The same three, in the same order, that the reviewer themselves was offered. */
const BATHROOM_OPTIONS: Answer[] = ['yes', 'no', 'unsure'];

type ReviewDialogProps = {
  review: AdminReview;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Edit a review somebody else wrote.
 *
 * Deliberately the same three controls the author had in review-sheet.tsx, in
 * the same order and with the same wording, so an admin is editing the answers
 * that were actually given rather than a different form that happens to write
 * the same columns.
 *
 * What is NOT here is as considered as what is. The author, the venue and the
 * date cannot be changed - a review is a person's account of a place, and a
 * moderator who could move it is not moderating. The tag-question answers are
 * shown in the row's expansion but never editable: `review_answers` has no admin
 * writer at all, and this dialog is not a way to become one.
 */
export function ReviewDialog({ review, onClose, onSaved }: ReviewDialogProps) {
  const [stars, setStars] = React.useState<number>(review.stars);
  const [bathroom, setBathroom] = React.useState<Answer>(review.transBathroom);
  const [body, setBody] = React.useState(review.body ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const tooLong = body.length > MAX_BODY;

  async function save() {
    if (busy || tooLong) return;

    setBusy(true);
    setError(null);
    try {
      await updateReview(review.id, { stars, bathroom, body });
      onSaved();
      onClose();
    } catch (cause: unknown) {
      // Left open on failure, holding what was typed. A dialog that closes on
      // refusal has thrown the edit away along with the reason for it.
      setError(cause instanceof Error ? cause.message : 'That edit was refused.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit this review</DialogTitle>
          <DialogDescription>
            {review.authorName}&rsquo;s review of {review.venueName}. It stays published under their
            name, so the panel records that an administrator changed it.
          </DialogDescription>
        </DialogHeader>

        <View className="gap-5 py-2">
          <View className="gap-2">
            <Label>How LGBTQ friendly is this place?</Label>
            <StarRating value={stars} onChange={setStars} />
            <Text className="text-xs text-muted-foreground">{STAR_HINT[stars]}</Text>
          </View>

          <View className="gap-2">
            <Label>Is there a bathroom trans people can use safely?</Label>
            <View className="flex-row gap-2">
              {BATHROOM_OPTIONS.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={bathroom === option ? 'default' : 'outline'}
                  onPress={() => setBathroom(option)}
                  className="flex-1">
                  <Text>{ANSWER_LABEL[option]}</Text>
                </Button>
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Label>What they wrote</Label>
            <Textarea
              value={body}
              onChangeText={setBody}
              placeholder="No written review"
              numberOfLines={5}
              className="min-h-28"
            />
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">
                Clearing this leaves the rating on its own, which is a valid review.
              </Text>
              <Text className={tooLong ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {body.length}/{MAX_BODY}
              </Text>
            </View>
          </View>

          {error ? (
            <Text className="text-sm text-destructive" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </View>

        <DialogFooter>
          <Button variant="outline" onPress={onClose} disabled={busy}>
            <Text>Cancel</Text>
          </Button>
          <Button onPress={save} disabled={busy || tooLong}>
            {busy ? <ActivityIndicator size="small" /> : <Text>Save changes</Text>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
