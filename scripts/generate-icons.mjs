// Renders every app icon and the splash image from favicon.svg.
//
// Run with `npm run icons` after editing the artwork. The outputs are committed,
// so this is not part of the build - it exists so the icons can be regenerated
// from the source drawing rather than hand-edited as pixels.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'favicon.svg';
const OUT = 'assets/images';

/** Light lavender. The one place the icon's colour is decided. */
const LAVENDER = '#E8DEF8';

/** The book drawing's own proportions, from the source viewBox. */
const ART_W = 798;
const ART_H = 970;

/** Outline of the book, lifted from the `book` clipPath in the source. */
const SILHOUETTE = `M100.36,1.59H696.77C751.69,1.59 797.12,48.66 797.12,105.57
  V881.11C797.12,924.02 757.59,969.17 720.02,969.17
  H68.66C28.79,969.17 -4.19,932.59 -4.19,888.36
  V107.11C-4.19,49.36 43.14,1.59 100.36,1.59Z`;

const source = readFileSync(SRC, 'utf8');

/**
 * Stamp a concrete pixel size onto the SVG before rasterising.
 *
 * Rasterising at the exact output size and letting the vector do the scaling
 * keeps the edges crisp; resizing a bitmap afterwards would not.
 */
function atHeight(svg, height) {
  const width = Math.round((height * ART_W) / ART_H);
  return Buffer.from(svg.replace(`width="${ART_W}" height="${ART_H}"`, `width="${width}" height="${height}"`));
}

function silhouetteSvg(height) {
  const width = Math.round((height * ART_W) / ART_H);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ART_W} ${ART_H}" width="${width}" height="${height}">` +
      `<path fill="#ffffff" d="${SILHOUETTE}"/></svg>`
  );
}

/**
 * The book centred on a square canvas, `fraction` of the canvas tall.
 *
 * A fraction of 0 means no artwork at all - a plain filled square, which is
 * what the adaptive icon's background layer is.
 */
async function square({ size, fraction, background, art = source, file }) {
  const height = Math.round(size * fraction);
  const book =
    height > 0
      ? await sharp(typeof art === 'function' ? art(height) : atHeight(art, height))
          .png()
          .toBuffer()
      : null;

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(book ? [{ input: book, gravity: 'center' }] : [])
    .png()
    .toFile(path.join(OUT, file));

  console.log(`${file}  ${size}x${size}`);
}

// Store and web icons: full bleed lavender, the book inset so the rounded mask
// iOS and the browser apply never clips it.
await square({ size: 1024, fraction: 0.72, background: LAVENDER, file: 'icon.png' });
await square({ size: 196, fraction: 0.72, background: LAVENDER, file: 'favicon.png' });

// Android adaptive icon. The launcher supplies the mask, and most use a circle,
// so the book has to fit the inscribed circle rather than the 66% safe square -
// a rectangle filling that square has corners outside the circle. At 0.53 the
// book's furthest corner sits 335px from centre against the circle's 341px.
await square({ size: 1024, fraction: 0.53, file: 'android-icon-foreground.png' });
await square({ size: 1024, fraction: 0, background: LAVENDER, file: 'android-icon-background.png' });

// Themed icons: the system tints a flat silhouette, so colour here is discarded.
await square({ size: 1024, fraction: 0.53, art: silhouetteSvg, file: 'android-icon-monochrome.png' });

// The splash image is cropped to the artwork - expo-splash-screen paints the
// background itself and scales this to `imageWidth`, so padding would shrink it.
await sharp(atHeight(source, 622)).png().toFile(path.join(OUT, 'splash-icon.png'));
console.log('splash-icon.png  512x622');
