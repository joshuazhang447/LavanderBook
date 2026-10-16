import { Platform, type PressableAndroidRippleConfig } from 'react-native';

/**
 * Small pieces the Material skin's components share
 * (docs/material-design-guideline.md).
 */

/**
 * The font Material Symbols are drawn in: the name SkinProvider loads it under
 * on a phone, and the @font-face family on the website (skin-provider.web.tsx).
 */
export const MATERIAL_SYMBOLS_FAMILY =
  Platform.OS === 'web' ? 'LavenderBook Material Symbols' : 'MaterialSymbolsRounded_400Regular';

/**
 * State layers (StateTokens; the guideline's section 12.1): the content's own
 * colour over the container, at these opacities. On Android the pressed one is
 * the ripple.
 */
export const STATE_LAYER = {
  hover: 0.08,
  focus: 0.1,
  pressed: 0.1,
  dragged: 0.16,
} as const;

/** The opacity of the layer for a Pressable's state, the strongest that applies. */
export function stateLayerOpacity(state: {
  pressed?: boolean;
  hovered?: boolean;
  focused?: boolean;
}): number {
  if (state.pressed) return STATE_LAYER.pressed;
  if (state.focused) return STATE_LAYER.focus;
  if (state.hovered) return STATE_LAYER.hover;
  return 0;
}

/**
 * Android's own ripple in a colour - the content's, as a state layer is.
 * Foreground, so it washes over icons and labels too, as Material's does.
 */
export function materialRipple(
  color: string,
  options: { borderless?: boolean; radius?: number } = {}
): PressableAndroidRippleConfig {
  return { color, foreground: true, ...options };
}
