import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { InlinePicker } from '@/components/admin/inline-picker';
import {
  CATEGORY_LABEL,
  MATCH_HINT,
  MATCH_LABEL,
  TIER_HINT,
  TIER_LABEL,
} from '@/components/admin/moderation-labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import {
  createTerm,
  updateTerm,
  type ModerationTerm,
  type TermCategory,
  type TermDraft,
  type TermMatch,
  type TermTier,
} from '@/lib/admin';

const TIER_OPTIONS = (Object.keys(TIER_LABEL) as TermTier[]).map((value) => ({
  value,
  label: TIER_LABEL[value],
}));
const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as TermCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}));
const MATCH_OPTIONS = (Object.keys(MATCH_LABEL) as TermMatch[]).map((value) => ({
  value,
  label: MATCH_LABEL[value],
}));

type TermDialogProps = {
  /** Null adds a new word; a term edits it. */
  term: ModerationTerm | null;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Add or edit one word on the list.
 *
 * Mounted fresh per term (keyed), so every field initialises from props, as
 * TagDialog does. The server folds the word and compiles its pattern; anything
 * it cannot match comes back as an error under the form.
 */
export function TermDialog({ term, onClose, onSaved }: TermDialogProps) {
  const isNew = term === null;

  const [word, setWord] = React.useState(term?.term ?? '');
  const [tier, setTier] = React.useState<TermTier>(term?.tier ?? 'hold');
  const [category, setCategory] = React.useState<TermCategory>(term?.category ?? 'transphobic');
  const [matchMode, setMatchMode] = React.useState<TermMatch>(term?.matchMode ?? 'word');
  const [language, setLanguage] = React.useState(term?.language ?? 'en');
  const [allowText, setAllowText] = React.useState((term?.allow ?? []).join('\n'));
  const [note, setNote] = React.useState(term?.note ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canSave = !busy && word.trim() !== '';

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);

    const draft: TermDraft = {
      term: word,
      tier,
      category,
      matchMode,
      language,
      allow: allowText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
      note,
    };

    try {
      if (isNew) await createTerm(draft);
      else await updateTerm(term.id, draft);
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That could not be saved.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="w-full max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add a word' : 'Edit word'}</DialogTitle>
          <DialogDescription>
            Accents, lookalike letters, spacing and number-for-letter spellings are matched for
            you - add each spelling only once.
          </DialogDescription>
        </DialogHeader>

        <ScrollView className="max-h-[60vh]" contentContainerClassName="gap-4 px-0.5">
          <View className="gap-1.5">
            <Label nativeID="term-word">Word or phrase</Label>
            <Input
              aria-labelledby="term-word"
              value={word}
              onChangeText={setWord}
              maxLength={100}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View className="gap-1.5">
            <Label>Tier</Label>
            <InlinePicker value={tier} options={TIER_OPTIONS} onChange={setTier} />
            <Text className="text-xs text-muted-foreground">{TIER_HINT[tier]}</Text>
          </View>

          <View className="gap-1.5">
            <Label>Category</Label>
            <InlinePicker value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
          </View>

          <View className="gap-1.5">
            <Label>Match</Label>
            <InlinePicker value={matchMode} options={MATCH_OPTIONS} onChange={setMatchMode} />
            <Text className="text-xs text-muted-foreground">{MATCH_HINT[matchMode]}</Text>
          </View>

          <View className="gap-1.5">
            <Label nativeID="term-language">Language</Label>
            <Input
              aria-labelledby="term-language"
              value={language}
              onChangeText={setLanguage}
              maxLength={12}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="en"
              className="w-32"
            />
            <Text className="text-xs text-muted-foreground">
              A label for whoever reviews the list. Every word is looked for in every review, in
              any language.
            </Text>
          </View>

          <View className="gap-1.5">
            <Label nativeID="term-allow">Innocent phrases</Label>
            <Textarea
              aria-labelledby="term-allow"
              value={allowText}
              onChangeText={setAllowText}
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="One per line: a street, a town, a trade"
            />
            <Text className="text-xs text-muted-foreground">
              Text matching one of these never counts as this word - a place name that contains
              it, or a job title.
            </Text>
          </View>

          <View className="gap-1.5">
            <Label nativeID="term-note">Note</Label>
            <Textarea
              aria-labelledby="term-note"
              value={note}
              onChangeText={setNote}
              maxLength={500}
              numberOfLines={2}
              placeholder="Why it is here, and why this tier. Admins only."
            />
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
            {busy ? <ActivityIndicator size="small" /> : <Text>{isNew ? 'Add word' : 'Save'}</Text>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
