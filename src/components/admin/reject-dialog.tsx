import * as React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { InlinePicker } from '@/components/admin/inline-picker';
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
import { REPORT_REASONS, rejectedLine, type ReportReason } from '@/lib/moderation-text';
import { cn } from '@/lib/utils';

/** Mirrors moderation_cases_note_length. */
const MAX_NOTE = 500;

const REASON_OPTIONS = REPORT_REASONS.map((reason) => ({
  value: reason.value,
  label: reason.label,
}));

type RejectDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  /** Throws to keep the dialog open with the error. */
  onConfirm: (reason: ReportReason, note: string) => Promise<void>;
};

/**
 * Why a review comes down, and what its author is told.
 *
 * The preview is the exact sentence the author reads in My reviews
 * (rejectedLine, shared with the app), so a moderator writes the note knowing
 * who will read it. The reason is required: an author told nothing cannot fix
 * anything.
 */
export function RejectDialog({ title, description, confirmLabel, onClose, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = React.useState<ReportReason | ''>('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canConfirm = !busy && reason !== '' && note.length <= MAX_NOTE;

  async function confirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason, note.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be done.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <View className="gap-4">
          <View className="gap-1.5">
            <Label>Reason</Label>
            <InlinePicker
              value={reason}
              options={REASON_OPTIONS}
              onChange={(next) => setReason(next as ReportReason)}
              disabled={busy}
            />
          </View>

          <View className="gap-1.5">
            <Label nativeID="reject-note">Note to the author (optional)</Label>
            <Textarea
              aria-labelledby="reject-note"
              value={note}
              onChangeText={setNote}
              maxLength={MAX_NOTE}
              numberOfLines={3}
              placeholder="What would make it publishable - for example, quoting the word differently."
            />
            <Text className="text-xs text-muted-foreground">
              {MAX_NOTE - note.length} characters left. The author reads this; nobody else does.
            </Text>
          </View>

          <View className="gap-1 rounded-md border border-border bg-muted/40 p-3">
            <Text className="text-xs font-medium text-muted-foreground">The author will read</Text>
            <Text className="text-sm text-foreground">{rejectedLine(reason || null, note)}</Text>
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
          <Button
            className={cn('bg-destructive', Platform.select({ web: 'hover:bg-destructive/90' }))}
            onPress={confirm}
            disabled={!canConfirm}>
            {busy ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-white">{confirmLabel}</Text>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
