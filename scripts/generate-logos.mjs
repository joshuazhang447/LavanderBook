// Renders the two small logos drawn in the app - the book beside
// "LavenderBook" in the website's header, and OAU's leaves in the credit - at
// the exact pixel size of every screen density.
//
// Run with `npm run logos` after changing either drawing or the size it is
// shown at. The outputs are committed; this is not part of the build.
//
// Why exact sizes: a logo 24pt tall is 24, 36, 48 or 72 real pixels depending
// on the screen. Shrinking one big file to that in the browser smears it; a
// file drawn at the size it is shown is sharp. Each file is named for its
// height in pixels - not @2x, which the website ignores - and LogoImage
// (src/components/logo-image.tsx) picks one. The sets are in src/lib/logos.ts.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = 'assets/images';
const SCALES = [1, 1.5, 2, 3];

function file(name, height) {
  return path.join(OUT, `${name}-${height}.png`);
}

// The book: favicon.svg, the app icon's own drawing, rasterised straight from
// the vector at each size. 20 x 24 points.
{
  const BOOK = { width: 20, height: 24 };
  const svg = readFileSync('favicon.svg', 'utf8');
  for (const scale of SCALES) {
    const width = Math.round(BOOK.width * scale);
    const height = Math.round(BOOK.height * scale);
    const sized = svg.replace('width="798" height="970"', `width="${width}" height="${height}"`);
    await sharp(Buffer.from(sized)).png().toFile(file('book-mark', height));
    console.log(`book-mark ${width}x${height}`);
  }
}

// OAU's leaves: from the 735 x 770 drawing OAU supplied. 23 x 24 points.
//
// The drawing's outline is about 10px thick, so at 24pt it would be under a
// third of a pixel - too thin to draw, and it smears into the pastel fill,
// which is what made the logo look blurry. Type designers solve the same
// problem with optical sizes: the smaller a size, the heavier its strokes. Each
// file here thickens the outline just enough to be about a pixel wide at its
// own size, and the 3x file - big enough to carry the original - is untouched.
{
  const SOURCE = 'docs/logo5-alpha.png';
  const LEAF = { width: 23, height: 24 };
  /** The outline's colour, measured from the drawing. */
  const INK = [70, 57, 22];
  const STROKE = 10;

  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const ink = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b, a] = data.subarray(i * 4, i * 4 + 4);
    ink[i] = a > 128 && (r + g + b) / 3 < 120 ? 1 : 0;
  }

  /** The drawing with every pixel within `radius` of the outline made outline. */
  function thickened(radius) {
    if (radius === 0) return sharp(SOURCE);
    const out = Buffer.from(data);
    const disc = [];
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        if (dx * dx + dy * dy <= radius * radius + radius) disc.push([dx, dy]);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const near = disc.some(([dx, dy]) => {
          const xx = x + dx;
          const yy = y + dy;
          return xx >= 0 && yy >= 0 && xx < W && yy < H && ink[yy * W + xx] === 1;
        });
        if (near) out.set([...INK, 255], (y * W + x) * 4);
      }
    return sharp(out, { raw: { width: W, height: H, channels: 4 } });
  }

  for (const scale of SCALES) {
    const width = Math.round(LEAF.width * scale);
    const height = Math.round(LEAF.height * scale);
    // Source pixels per output pixel is the stroke a one-pixel line needs;
    // capped, so the smallest sizes keep their lobes.
    const radius = Math.min(6, Math.max(0, Math.round((H / height - STROKE) / 2)));
    await thickened(radius)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
      .png()
      .toFile(file('oau-logo', height));
    console.log(`oau-logo ${width}x${height} (outline +${radius * 2}px)`);
  }
}
