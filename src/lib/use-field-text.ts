import * as React from 'react';
import { Platform } from 'react-native';

type FieldText = {
  value?: string;
  onChangeText?: (text: string) => void;
};

/**
 * Lets a phone's text field keep its own text, for a field written as
 * controlled (`value` + `onChangeText`).
 *
 * A controlled field sends every keystroke to JavaScript and is sent the text
 * back. On Android that round trip collides with the keyboard editing a word in
 * place: tap into the middle of a word and Gboard treats the whole word as one
 * still being typed, so a space or a backspace there arrives as two quick edits
 * - and the text sent back after the first lands on top of the second. The
 * space goes in the wrong place; a delete takes the wrong letter. Typing at the
 * end never shows it.
 *
 * So on the phone the field is uncontrolled. It starts from `value`, reports
 * every change, and is never told its own text again: `defaultValue` must not
 * change after it mounts, because React Native hands that to Android as the
 * text just the same. A `value` the field did not report itself - a prefill
 * arriving, a clear button - is a change from outside, applied by remounting
 * the field with it (`key`).
 *
 * That means the caller must store exactly what onChangeText gives it, in the
 * same handler. A value trimmed, filtered or set a moment later reads as a
 * change from outside, and remounts the field under the person's thumb.
 *
 * Inside a portal (every sheet) the value arrives late: the portal hands its
 * content to the host in an effect, so the field renders once with its own
 * new state and the old `value`, and again a commit later with the new one -
 * and quick typing can report a second change in between. So what decides is
 * not the last report but the reports `value` has not caught up with yet: a
 * `value` that has not changed is old news, and one that matches a pending
 * report is the field's own text arriving. Only anything else comes from
 * outside.
 *
 * The web keeps ordinary controlled inputs: browsers have no such round trip.
 */
export function useFieldText({ value, onChangeText }: FieldText) {
  const native = Platform.OS !== 'web';
  // What the field was last mounted with. Fixed until a change from outside.
  const [initial, setInitial] = React.useState(value);
  // The `value` last seen, to tell a new one from a late render of the old.
  const [seen, setSeen] = React.useState(value);
  // What the field has reported that `value` has not caught up with, oldest first.
  const [pending, setPending] = React.useState<string[]>([]);
  const [generation, setGeneration] = React.useState(0);

  if (native && value !== undefined && value !== seen) {
    setSeen(value);
    const caughtUp = pending.lastIndexOf(value);
    if (caughtUp >= 0) {
      // The field's own text: drop it and everything reported before it.
      setPending(pending.slice(caughtUp + 1));
    } else {
      setInitial(value);
      setPending([]);
      setGeneration((current) => current + 1);
    }
  }

  if (!native || value === undefined) {
    return { key: undefined, props: { value, onChangeText } };
  }
  return {
    key: generation,
    props: {
      defaultValue: initial,
      onChangeText: (text: string) => {
        // Capped: a caller that never stores what the field says would grow it.
        setPending((current) => [...current, text].slice(-50));
        onChangeText?.(text);
      },
    },
  };
}
