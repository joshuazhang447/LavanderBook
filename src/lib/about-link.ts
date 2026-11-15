import { Linking, Platform } from 'react-native';

/**
 * The website that introduces LavenderBook: what it is, its features, who made
 * it. Its own repository (one-among-us/lavenderbook-about); linked from the
 * header's credit and from My Account in every skin, so people - and search
 * engines - find it from the app.
 */
export const ABOUT_URL = 'https://lavenderbook-about.oau.app/';

export const ABOUT_TEXT = {
  label: 'About LavenderBook',
  /** Read out: where it goes, since it leaves the app. */
  spoken: 'About LavenderBook. Opens its website.',
} as const;

/**
 * Props that make a pressable a real link on the website: an <a href> that
 * search engines follow and the browser opens in a new tab, sent with no
 * referrer. Nothing on a phone, where pressLink opens the browser instead.
 */
export function webLinkProps(href: string): object {
  return Platform.OS === 'web'
    ? { href, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }
    : {};
}

/** A link's press: the browser on a phone; on the website the <a> already goes. */
export function pressLink(href: string) {
  if (Platform.OS === 'web') return;
  Linking.openURL(href).catch(() => {});
}
