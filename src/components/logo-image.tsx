import { Image, PixelRatio } from 'react-native';

import type { Logo } from '@/lib/logos';

/**
 * A logo drawn from the file made for this screen's density, so it is never
 * shrunk or stretched into a blur (src/lib/logos.ts). Decorative: the words
 * beside it, or the link it sits in, say what it is.
 *
 * The phone: the smallest file at least as dense as the screen. The website
 * has its own version, which lets the browser choose.
 */
export function LogoImage({ logo }: { logo: Logo }) {
  const density = PixelRatio.get();
  const file = logo.files.find((f) => f.scale >= density) ?? logo.files[logo.files.length - 1];
  return (
    <Image
      source={file.source}
      style={{ width: logo.width, height: logo.height }}
      aria-hidden
      accessibilityIgnoresInvertColors
    />
  );
}
