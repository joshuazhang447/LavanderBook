import * as React from 'react';
import { Text as RNText, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { MATERIAL_SYMBOLS_FAMILY } from '@/lib/material';

/**
 * Material Symbols, Material's icons (docs/material-design-guideline.md,
 * section 9): one glyph of the Rounded font, which SkinProvider loads (the
 * website's stylesheet on the web). Every style of the font puts a symbol at
 * the same codepoint; these are the ones the app draws, from expo-symbols'
 * table of the font.
 */
export const MATERIAL_SYMBOLS = {
  account_circle: 0xe853,
  add: 0xe145,
  arrow_back: 0xe5c4,
  arrow_downward: 0xe5db,
  arrow_forward: 0xe5c8,
  arrow_upward: 0xe5d8,
  balance: 0xeaf6,
  bed: 0xefdf,
  call: 0xe0b0,
  calendar_month: 0xebcc,
  calendar_today: 0xe935,
  cancel: 0xe5c9,
  chat: 0xe0b7,
  check: 0xe5ca,
  check_circle: 0xe86c,
  checklist: 0xe6b1,
  chevron_left: 0xe5cb,
  chevron_right: 0xe5cc,
  close: 0xe5cd,
  content_copy: 0xe14d,
  delete: 0xe872,
  directions: 0xe52e,
  door_front: 0xeffd,
  door_open: 0xe77c,
  edit: 0xe3c9,
  edit_square: 0xf88d,
  event_busy: 0xe615,
  event_upcoming: 0xf238,
  expand_less: 0xe5ce,
  expand_more: 0xe5cf,
  flag: 0xe153,
  forum: 0xe0bf,
  gpp_maybe: 0xf014,
  group: 0xe7ef,
  health_and_safety: 0xe1d5,
  info: 0xe88e,
  language: 0xe894,
  link: 0xe157,
  list: 0xe896,
  location_disabled: 0xe1b6,
  location_off: 0xe0c7,
  location_on: 0xe0c8,
  location_searching: 0xe1b7,
  logout: 0xe9ba,
  mail: 0xe158,
  map: 0xe55b,
  masks: 0xf218,
  medical_services: 0xf109,
  menu_book: 0xea19,
  more_horiz: 0xe5d3,
  my_location: 0xe55c,
  near_me: 0xe569,
  near_me_disabled: 0xf1ef,
  nightlife: 0xea62,
  open_in_new: 0xe89e,
  palette: 0xe40a,
  person: 0xe7fd,
  psychology: 0xea4a,
  refresh: 0xe5d5,
  restaurant: 0xe56c,
  schedule: 0xe8b5,
  search: 0xe8b6,
  search_off: 0xea76,
  sell: 0xf05b,
  sos: 0xebf7,
  star: 0xe838,
  star_half: 0xe839,
  stethoscope: 0xf805,
  storefront: 0xea12,
  theater_comedy: 0xea66,
  translate: 0xe8e2,
  unfold_more: 0xe5d7,
  visibility: 0xe8f4,
  visibility_off: 0xe8f5,
  warning: 0xe002,
} as const;

export type MaterialSymbolName = keyof typeof MATERIAL_SYMBOLS;

/** Marks a symbol on the website, so the stylesheet's Roboto passes it by. */
const DATA_SET = { materialSymbol: 'true' };

/**
 * One symbol, `size` square, its colour from `className` (a text colour) as
 * text's is. Decorative unless given a label - otherwise a screen reader would
 * read out the private-use character the glyph sits at. Never grows with the
 * text size: Material's icons keep their size.
 */
export function MaterialSymbol({
  name,
  size = 24,
  className,
  style,
  accessibilityLabel,
}: {
  name: MaterialSymbolName;
  size?: number;
  className?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const labelled = !!accessibilityLabel;
  return (
    <RNText
      // dataSet is react-native-web's; the phone ignores it.
      {...({ dataSet: DATA_SET } as object)}
      accessible={labelled}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={labelled ? 'yes' : 'no'}
      aria-hidden={!labelled}
      allowFontScaling={false}
      selectable={false}
      className={className}
      // One object, never an array: with a className, NativeWind's web runtime
      // pushes the class into a style array in place, and the React Compiler
      // hands back the same memoised array when only the class changed - so a
      // tab's old colour class stayed on beside its new one.
      style={{
        fontFamily: MATERIAL_SYMBOLS_FAMILY,
        fontSize: size,
        lineHeight: size,
        width: size,
        height: size,
        textAlign: 'center',
        includeFontPadding: false,
        ...StyleSheet.flatten(style),
      }}>
      {String.fromCharCode(MATERIAL_SYMBOLS[name])}
    </RNText>
  );
}
