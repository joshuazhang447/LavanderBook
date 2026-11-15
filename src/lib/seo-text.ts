/**
 * What search engines and link previews say about the website: each page's
 * title, description and whether it belongs in search results at all. Drawn by
 * SeoHead (src/components/seo-head.tsx), on the website only.
 *
 * Public copy: commas, colons and full stops, never em or en dashes. The figures and
 * claims match the about site (lavenderbook-about.oau.app); change them in both.
 */

export const SITE_URL = 'https://lavenderbook.oau.app';
export const SITE_NAME = 'LavenderBook';

/** The about site's preview card: the same brand card, 1200 x 630. */
export const SHARE_IMAGE = {
  url: 'https://lavenderbook-about.oau.app/assets/og.png',
  width: 1200,
  height: 630,
  alt: 'LavenderBook: find the places that welcome you. A free guide to LGBTQ+ places.',
} as const;

/**
 * Google Search Console's ownership check for SITE_URL, under One Among Us's
 * Google account. A tag rather than Google's file: Cloudflare redirects
 * `/google....html` to the address without `.html`, and the check does not
 * follow it. Removing the tag unverifies the site.
 */
export const GOOGLE_SITE_VERIFICATION = '_y6q7X4vQx4J6OvMkClnuO8jgvulXPQ3D4AxAVJnlik';

export type SeoPage = {
  title: string;
  description: string;
  /**
   * The address search engines should know the page by, as Cloudflare serves
   * it: a folder's index ends in a slash (`/directory/`), a file does not.
   * Null keeps the page out of search results.
   */
  canonical: string | null;
};

const DESCRIPTION =
  'A free map of LGBTQ+ friendly places: trans healthcare, community centres, shelters, support groups and queer-owned spots, with honest, anonymous reviews from the community. No account needed.';

/** The pages worth finding, by expo-router's pathname. Also in public/sitemap.xml. */
const INDEXED: Record<string, SeoPage> = {
  '/': {
    title: 'LavenderBook: a map of LGBTQ+ friendly places',
    description: DESCRIPTION,
    canonical: '/',
  },
  '/directory': {
    title: 'Directory of LGBTQ+ places and groups | LavenderBook',
    description:
      'Browse 1,500+ LGBTQ+ places and groups across Canada by kind: trans healthcare, mental health, shelters, food, legal aid, youth services, community centres and online groups, each checked by LavenderBook.',
    canonical: '/directory/',
  },
  '/account/privacy': {
    title: 'Privacy policy | LavenderBook',
    description:
      'What LavenderBook collects and who can see it. Use it without an account, your exact location never leaves your device, and reviews show a made-up name. No ads, no tracking.',
    canonical: '/account/privacy',
  },
};

/** Pages with nothing for a stranger to find: a title for the tab, no listing. */
const UNLISTED: Record<string, string> = {
  '/account': 'Account',
  '/account/appearance': 'Appearance',
  '/account/dates': 'Review dates',
  '/account/leave-now': 'Leave now',
  '/account/location': 'Location',
  '/account/names': 'Names at each place',
  '/admin': 'Admin',
};

/** The page's title, description and listing, for any pathname. */
export function seoPage(pathname: string): SeoPage {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
  const indexed = INDEXED[path];
  if (indexed) return indexed;
  const name = UNLISTED[path];
  return {
    title: name ? `${name} | ${SITE_NAME}` : SITE_NAME,
    description: DESCRIPTION,
    canonical: null,
  };
}

/**
 * Structured data for the home page: the web app, the site and who makes it.
 * The ids match the about site's, so Google reads both as one thing.
 */
export const HOME_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://oneamongus.ca/#organization',
      name: 'One Among Us',
      url: 'https://oneamongus.ca/',
      sameAs: ['https://one-among.us/', 'https://www.instagram.com/oneamongus_ca/'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: DESCRIPTION,
      inLanguage: 'en-CA',
      publisher: { '@id': 'https://oneamongus.ca/#organization' },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: DESCRIPTION,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Any (works in a web browser)',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' },
      image: SHARE_IMAGE.url,
      creator: { '@id': 'https://oneamongus.ca/#organization' },
      subjectOf: { '@type': 'WebPage', url: 'https://lavenderbook-about.oau.app/' },
    },
  ],
} as const;
