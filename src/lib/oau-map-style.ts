import type { MapStyleElement } from 'react-native-maps';

/**
 * OAU's base map on Android (LavenderBookStyle/oau-style-guide.md, section
 * 10): warm and quiet, so the sticker pins read first - cream land, soft sky
 * water, sage parks, cream roads with a paper edge, brown labels on a cream
 * halo, transit muted. Apple Maps on iOS takes no style; the website's style
 * lives on its Map ID (EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID_OAU).
 *
 * Points of interest are muted rather than hidden, as the guide has them:
 * tapping a Google place's label is how somebody reviews a place LavenderBook
 * does not list yet, and a hidden label cannot be tapped.
 */
export const OAU_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#F6EEE3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A6F50' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFF8F0' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFE6F2' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4F7F99' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#DDEBD3' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -70 }, { lightness: 25 }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#A08A70' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFDF9' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E6D7C3' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#F8E6CF' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ saturation: -60 }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#EADFCF' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ saturation: -60 }, { lightness: 20 }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#C9B597' }] },
];
