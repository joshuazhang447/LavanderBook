/**
 * Finds the links in a venue note: a website, an email address or a phone
 * number, written as plain text by an admin ("Text 647-694-4275, or chat at
 * youthline.ca"). Online organisations have no address, so a note is the only
 * way to reach them, and a number nobody can tap has to be retyped.
 *
 * Deliberately narrow. A bare domain needs one of a few top-level domains, so
 * "6 to 9pm" or "e.g." never become links; anything with http(s):// always
 * does. Phone numbers are North American, which is every note we write today.
 */

export type NotePart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string };

const EMAIL = String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`;
const URL = String.raw`https?:\/\/[^\s]+`;
const DOMAIN = String.raw`(?<![@\w.-])(?:[A-Za-z0-9-]+\.)+(?:ca|com|org|net|info|fyi|io)(?:\/[^\s]*)?(?![\w-])`;
const PHONE = String.raw`(?<![\w-])(?:\+?1[-. ]?)?(?:\(\d{3}\) ?|\d{3}[-. ])\d{3}[-. ]\d{4}(?![\w-])`;

// Order matters: an email is tried before the bare domain inside it.
const PATTERN = new RegExp(`(${EMAIL})|(${URL})|(${DOMAIN})|(${PHONE})`, 'g');

/** Sentence punctuation that ends a note is not part of the link before it. */
const TRAILING = /[.,;:!?)\]'"]+$/;

export function linkify(text: string): NotePart[] {
  const parts: NotePart[] = [];
  let last = 0;

  for (const match of text.matchAll(PATTERN)) {
    const raw = match[0];
    const trimmed = raw.replace(TRAILING, '');
    if (!trimmed) continue;
    const start = match.index ?? 0;

    const href = match[1]
      ? `mailto:${trimmed}`
      : match[2]
        ? trimmed
        : match[3]
          ? `https://${trimmed}`
          : `tel:${trimmed.replace(/[^\d+]/g, '')}`;

    if (start > last) parts.push({ kind: 'text', text: text.slice(last, start) });
    parts.push({ kind: 'link', text: trimmed, href });
    last = start + trimmed.length;
  }

  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
