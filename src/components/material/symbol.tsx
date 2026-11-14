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
  accessible: 0xe914,
  account_balance: 0xe84f,
  account_balance_wallet: 0xe850,
  account_circle: 0xe853,
  add: 0xe145,
  album: 0xe019,
  arrow_back: 0xe5c4,
  arrow_downward: 0xe5db,
  arrow_forward: 0xe5c8,
  arrow_upward: 0xe5d8,
  auto_awesome: 0xe65f,
  backpack: 0xf19c,
  badge: 0xea67,
  balance: 0xeaf6,
  bed: 0xefdf,
  brush: 0xe3ae,
  build: 0xe869,
  cake: 0xe7e9,
  calendar_month: 0xebcc,
  calendar_today: 0xe935,
  call: 0xe0b0,
  campaign: 0xef49,
  camping: 0xf8a2,
  cancel: 0xe5c9,
  casino: 0xeb40,
  celebration: 0xea65,
  chat: 0xe0b7,
  check: 0xe5ca,
  check_circle: 0xe86c,
  checklist: 0xe6b1,
  checkroom: 0xf19e,
  chevron_left: 0xe5cb,
  chevron_right: 0xe5cc,
  child_care: 0xeb41,
  close: 0xe5cd,
  content_copy: 0xe14d,
  content_cut: 0xe14e,
  crown: 0xecb3,
  dark_mode: 0xe51c,
  delete: 0xe872,
  description: 0xe873,
  directions: 0xe52e,
  directions_bus: 0xe530,
  directions_car: 0xe531,
  directions_walk: 0xe536,
  domain: 0xe7ee,
  door_front: 0xeffd,
  door_open: 0xe77c,
  eco: 0xea35,
  edit: 0xe3c9,
  edit_square: 0xf88d,
  emergency: 0xe1eb,
  emoji_events: 0xea23,
  event_busy: 0xe615,
  event_upcoming: 0xf238,
  expand_less: 0xe5ce,
  expand_more: 0xe5cf,
  extension: 0xe87b,
  favorite: 0xe87d,
  fitness_center: 0xeb43,
  flag: 0xe153,
  forum: 0xe0bf,
  gpp_maybe: 0xf014,
  group: 0xe7ef,
  healing: 0xe3f3,
  health_and_safety: 0xe1d5,
  hearing: 0xe023,
  home: 0xe88a,
  info: 0xe88e,
  inventory_2: 0xe1a1,
  key: 0xe73c,
  landscape: 0xe3f7,
  language: 0xe894,
  laptop: 0xe31e,
  lightbulb: 0xe0f0,
  link: 0xe157,
  list: 0xe896,
  local_cafe: 0xe541,
  local_florist: 0xe545,
  local_hospital: 0xe548,
  local_laundry_service: 0xe54a,
  local_library: 0xe54b,
  location_disabled: 0xe1b6,
  location_off: 0xe0c7,
  location_on: 0xe0c8,
  location_searching: 0xe1b7,
  lock: 0xe897,
  logout: 0xe9ba,
  looks: 0xe3fc,
  luggage: 0xf235,
  mail: 0xe158,
  map: 0xe55b,
  masks: 0xf218,
  medical_services: 0xf109,
  medication: 0xf033,
  menu_book: 0xea19,
  mic: 0xe029,
  more_horiz: 0xe5d3,
  movie: 0xe02c,
  music_note: 0xe405,
  my_location: 0xe55c,
  near_me: 0xe569,
  near_me_disabled: 0xf1ef,
  newspaper: 0xeb81,
  nightlife: 0xea62,
  open_in_new: 0xe89e,
  palette: 0xe40a,
  park: 0xea63,
  payments: 0xef63,
  pedal_bike: 0xeb29,
  person: 0xe7fd,
  pets: 0xe91d,
  photo_camera: 0xe412,
  pool: 0xeb48,
  psychology: 0xea4a,
  record_voice_over: 0xe91f,
  redeem: 0xe8b1,
  refresh: 0xe5d5,
  restaurant: 0xe56c,
  schedule: 0xe8b5,
  school: 0xe80c,
  science: 0xea4b,
  search: 0xe8b6,
  search_off: 0xea76,
  sell: 0xf05b,
  shield: 0xe9e0,
  shopping_bag: 0xf1cc,
  shower: 0xf061,
  sos: 0xebf7,
  soup_kitchen: 0xe7d3,
  sports_bar: 0xf1f3,
  sports_esports: 0xea28,
  sports_volleyball: 0xea31,
  star: 0xe838,
  star_half: 0xe839,
  stethoscope: 0xf805,
  storefront: 0xea12,
  theater_comedy: 0xea66,
  transgender: 0xe58d,
  translate: 0xe8e2,
  unfold_more: 0xe5d7,
  vaccines: 0xe138,
  verified_user: 0xe8e8,
  videocam: 0xe04b,
  visibility: 0xe8f4,
  visibility_off: 0xe8f5,
  volunteer_activism: 0xea70,
  warning: 0xe002,
  wine_bar: 0xf1e8,
  work: 0xe8f9,
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
