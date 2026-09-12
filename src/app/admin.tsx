import { Redirect } from 'expo-router';

/**
 * The native half of /admin.
 *
 * The panel is web-only and always will be - a moderation table is a desktop
 * tool, and shipping it to phones would put a screen full of other people's
 * accounts inside an app anyone can install. So the real screen is
 * admin.web.tsx and this sends a phone back to the map.
 *
 * This file exists because expo-router will not accept a route that only has a
 * platform extension: without a sibling here it refuses admin.web.tsx outright
 * ("does not have a fallback sibling file without a platform extension"). It
 * imports nothing from the panel, so the panel is still absent from the native
 * bundle - which was the point of splitting the route in the first place.
 */
export default function AdminScreen() {
  return <Redirect href="/" />;
}
