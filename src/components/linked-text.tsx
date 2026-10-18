import * as React from 'react';
// react-native's Text, not ours, on purpose: this only ever renders nested in
// one of ours, and ours would reapply text-base and the skin's typeface over
// the parent's size and style. A bare nested Text inherits all of it.
import { Linking, Platform, Text as NestedText } from 'react-native';

import { linkify } from '@/lib/linkify';
import { cn } from '@/lib/utils';

function openLink(href: string) {
  if (Platform.OS === 'web') {
    // A new tab, and no referrer: the page we send someone to does not need to
    // learn they came from LavenderBook.
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  // Nothing useful to do if no app takes the link (no mail app, a tablet with
  // no phone), and an unhandled rejection would show as a dev red-box.
  Linking.openURL(href).catch(() => {});
}

type LinkedTextProps = {
  text: string;
  /** For the links only; the surrounding text inherits from the parent Text. */
  linkClassName?: string;
};

/**
 * A note's text with its websites, emails and phone numbers tappable. Renders
 * nested text only, so it must sit inside a Text that carries the style.
 */
export function LinkedText({ text, linkClassName }: LinkedTextProps) {
  const parts = React.useMemo(() => linkify(text), [text]);

  return parts.map((part, index) =>
    part.kind === 'text' ? (
      part.text
    ) : (
      <NestedText
        key={index}
        onPress={() => openLink(part.href)}
        accessibilityRole="link"
        className={cn('underline', linkClassName)}>
        {part.text}
      </NestedText>
    )
  );
}
