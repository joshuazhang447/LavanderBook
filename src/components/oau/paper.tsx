import * as React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useDisplaySettings } from '@/lib/accessibility';
import { oauTabColor, type OauTab } from '@/lib/theme';

/**
 * OAU's paper (LavenderBookStyle/oau-style-guide.md, section 8): never a plain
 * page, but warm paper with a faint grain, the tab's colour washing in at the
 * top. Both are drawn behind a screen's or a sheet's content and take no
 * touches; cards sit on top of them, so body text is never on the wash.
 */

const GRAIN = require('@/assets/images/paper-grain.png');

/**
 * A width and height of its own, not absoluteFill: on the website an Image
 * without them takes the file's 160 x 160 and ignores the insets, so the grain
 * stopped in a square at the top corner.
 */
const FILL = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as const;

/** A 160 x 160 tile of faint ink specks, repeated. Off under increased contrast. */
export function PaperGrain() {
  const { highContrast } = useDisplaySettings();
  if (highContrast) return null;
  return (
    <Image
      source={GRAIN}
      resizeMode="repeat"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={FILL}
    />
  );
}

/**
 * The tab's colour at the top, fading into the paper over `height`: the Map's
 * blue, the Directory's white, My Account's pink. Off under increased
 * contrast, where the page is plain paper.
 */
export function Wash({ tab, height = 160 }: { tab: OauTab; height?: number }) {
  const id = `oau-wash-${React.useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const { highContrast } = useDisplaySettings();
  if (highContrast) return null;
  const color = oauTabColor(tab, 'wash');

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Grain and wash together, filling the view they are the first child of. */
export function PaperBackdrop({ tab, washHeight }: { tab: OauTab; washHeight?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <PaperGrain />
      <Wash tab={tab} height={washHeight} />
    </View>
  );
}
