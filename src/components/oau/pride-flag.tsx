import * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Polygon, Rect } from 'react-native-svg';

/**
 * The intersex-inclusive Progress Pride flag (Valentino Vecchietti's 2021
 * design), drawn as one SVG so it stays crisp at any density: six rainbow
 * stripes, the chevron (intersex yellow, white, pink, light blue, brown,
 * black) and the intersex ring. Never recoloured with the tab. Decorative -
 * hidden from screen readers (LavenderBookStyle/oau-style-guide.md, sections
 * 13.20 and 13.21).
 */

/** Ink, for the hairline that keeps the flag's white from melting into cream. */
const INK = '#45311E';

/** The flag's own shapes, in its 1500 x 953 units. `from` is where the chevron starts. */
function FlagShapes({ from, width }: { from: number; width: number }) {
  return (
    <>
      <Rect x="0" y="0" width={width} height="159" fill="#DD1B11" />
      <Rect x="0" y="159" width={width} height="159" fill="#ED8412" />
      <Rect x="0" y="318" width={width} height="159" fill="#EAE01F" />
      <Rect x="0" y="477" width={width} height="159" fill="#73B325" />
      <Rect x="0" y="636" width={width} height="159" fill="#2C58A4" />
      <Rect x="0" y="795" width={width} height="158" fill="#6D2380" />
      <Polygon fill="#000000" points={`${from},0 394,0 835,476.5 394,953 ${from},953`} />
      <Polygon fill="#8F5011" points={`${from},0 302,0 743,476.5 302,953 ${from},953`} />
      <Polygon fill="#7BCCE5" points={`${from},0 211,0 652,476.5 211,953 ${from},953`} />
      <Polygon fill="#EFA9C3" points={`${from},0 119,0 560,476.5 119,953 ${from},953`} />
      <Polygon fill="#FFFFFF" points={`${from},0 27,0 468,476.5 27,953 ${from},953`} />
      <Polygon fill="#F8D312" points={`${from},0 -65,0 376,476.5 -65,953 ${from},953`} />
      <Circle cx="139" cy="476.5" r="101.5" fill="none" stroke="#66338B" strokeWidth="23" />
    </>
  );
}

/**
 * The flag as a book's ribbon marker: turned a quarter so its hoist is at the
 * top, the rainbow running down its length to a V notch. 30 x 86.
 */
export function PrideRibbon() {
  const id = `oau-ribbon-${React.useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden>
      <Svg width={30} height={86} viewBox="0 0 30 86">
        <Defs>
          <ClipPath id={id}>
            <Polygon points="0,0 30,0 30,86 15,73 0,86" />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${id})`}>
          <G transform="translate(30 8) rotate(90) scale(0.03148)">
            <FlagShapes from={-400} width={3000} />
          </G>
        </G>
        <Polygon
          points="0.25,0 29.75,0 29.75,85.4 15,72.6 0.25,85.4"
          fill="none"
          stroke={INK}
          strokeOpacity={0.55}
          strokeWidth={0.5}
        />
      </Svg>
    </View>
  );
}

/** The flag itself, 46 x 29 with a radius of 3: the last thing in OAU's colophon. */
export function PrideFlag() {
  const id = `oau-flag-${React.useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden>
      <Svg width={46} height={29} viewBox="0 0 46 29">
        <Defs>
          <ClipPath id={id}>
            <Rect x="0" y="0" width="46" height="29" rx="3" ry="3" />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${id})`}>
          <G transform="scale(0.030667 0.030430)">
            <FlagShapes from={-300} width={1500} />
          </G>
        </G>
        <Rect
          x="0.25"
          y="0.25"
          width="45.5"
          height="28.5"
          rx="2.8"
          ry="2.8"
          fill="none"
          stroke={INK}
          strokeOpacity={0.55}
          strokeWidth={0.5}
        />
      </Svg>
    </View>
  );
}
