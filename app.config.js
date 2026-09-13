/**
 * Supplies the Android Google Maps key from the environment.
 *
 * The key used to sit in app.json, which put a live billable key in a public
 * repository where it is trivially scraped. It cannot be hidden the way the
 * Places key is - the Maps SDK reads it from the merged AndroidManifest, so it
 * necessarily ships inside the APK - but that is exactly what Google's package
 * name + signing certificate restriction is for. Keeping it out of git is still
 * worth doing: a key in a public repo is found by a crawler in hours, and one
 * inside an APK has to be extracted from a build somebody first has to obtain.
 *
 * Expo reads app.json first and hands the normalised result to this file, so
 * everything else stays where it was and only the plugin entry is rewritten
 * here. See https://docs.expo.dev/workflow/configuration/.
 *
 * Local runs read GOOGLE_MAPS_ANDROID_KEY from .env. EAS builds do not upload
 * .env, so the same name has to exist as an EAS environment variable.
 */

const PLUGIN = 'react-native-maps';

module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_KEY;

  // Only the native Android build consumes this. On EAS we can tell directly;
  // locally we cannot, because `expo export --platform web` evaluates this file
  // once before .env is loaded and the key legitimately looks absent. So the
  // message says which builds it applies to rather than claiming something is
  // broken - a warning that cries wolf on every web export is one people learn
  // to scroll past, and then miss the time it was real.
  const buildingSomethingElse =
    process.env.EAS_BUILD_PLATFORM && process.env.EAS_BUILD_PLATFORM !== 'android';

  if (!key && !buildingSomethingElse) {
    // Not fatal: the web build and `expo start` do not need it, and failing
    // here would block them. An Android build without it produces a map that
    // renders as a blank grey grid with no error of its own, which is the worse
    // thing to discover, so it is still worth saying.
    console.warn(
      `[app.config.js] GOOGLE_MAPS_ANDROID_KEY is not set. Native Android builds ` +
        `will have a blank map; web builds are unaffected and can ignore this. ` +
        `Set it in .env locally, or as an EAS environment variable for cloud builds.`
    );
  }

  return {
    ...config,
    plugins: (config.plugins ?? []).map((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      if (name !== PLUGIN) return plugin;
      // Drop the props entirely when there is no key, rather than passing
      // `undefined` through to the plugin.
      return key ? [PLUGIN, { androidGoogleMapsApiKey: key }] : PLUGIN;
    }),
  };
};
