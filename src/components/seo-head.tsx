import { usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { Platform } from 'react-native';

import {
  GOOGLE_SITE_VERIFICATION,
  HOME_STRUCTURED_DATA,
  SHARE_IMAGE,
  SITE_NAME,
  SITE_URL,
  seoPage,
} from '@/lib/seo-text';

/**
 * The website's head for search engines and link previews: the page's title,
 * description, canonical address, preview card and, on the home page, the
 * structured data and Search Console's ownership tag. The static export writes
 * it into every page's HTML, so crawlers read it without running the app.
 *
 * A phone gets the title alone, as before: on iOS the head feeds Handoff, and
 * nothing there is for a search engine.
 */
export function SeoHead() {
  const pathname = usePathname();

  if (Platform.OS !== 'web') {
    return (
      <Head>
        <title>{SITE_NAME}</title>
      </Head>
    );
  }

  const page = seoPage(pathname);
  const url = page.canonical ? `${SITE_URL}${page.canonical}` : null;
  const home = page.canonical === '/';

  return (
    <Head>
      <title>{page.title}</title>
      <meta name="description" content={page.description} />
      <meta
        name="robots"
        content={url ? 'index, follow, max-image-preview:large, max-snippet:-1' : 'noindex, follow'}
      />
      {url ? <link rel="canonical" href={url} /> : null}
      <meta name="application-name" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_CA" />
      <meta property="og:title" content={page.title} />
      <meta property="og:description" content={page.description} />
      {url ? <meta property="og:url" content={url} /> : null}
      <meta property="og:image" content={SHARE_IMAGE.url} />
      <meta property="og:image:width" content={String(SHARE_IMAGE.width)} />
      <meta property="og:image:height" content={String(SHARE_IMAGE.height)} />
      <meta property="og:image:alt" content={SHARE_IMAGE.alt} />
      <meta name="twitter:card" content="summary_large_image" />
      {home ? <meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} /> : null}
      {home ? (
        <script type="application/ld+json">{JSON.stringify(HOME_STRUCTURED_DATA)}</script>
      ) : null}
    </Head>
  );
}
