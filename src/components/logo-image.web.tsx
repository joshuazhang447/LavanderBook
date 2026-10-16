import type { ImageURISource } from 'react-native';

import type { Logo } from '@/lib/logos';

/** On the web an image import is a `{ uri }`, one fixed file - never a scale set. */
function uriOf(source: Logo['files'][number]['source']) {
  return (source as ImageURISource).uri ?? '';
}

/**
 * The website: the browser's own `<img srcset>`. It knows the screen's pixel
 * ratio - which the page, rendered ahead of time at 1x, does not - and picks
 * again when the page is zoomed or moved to another screen.
 */
export function LogoImage({ logo }: { logo: Logo }) {
  return (
    <img
      src={uriOf(logo.files[0].source)}
      srcSet={logo.files.map((f) => `${uriOf(f.source)} ${f.scale}x`).join(', ')}
      width={logo.width}
      height={logo.height}
      alt=""
      aria-hidden
      draggable={false}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}
