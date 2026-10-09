import * as Location from 'expo-location';
import * as React from 'react';
import { AppState } from 'react-native';

/**
 * How much ground the map shows around the user, in metres. Roughly the radius
 * from the centre to the nearer screen edge.
 */
export const VIEW_RADIUS_METERS = 200;

/** One degree of latitude is ~111,320m everywhere. */
export const METERS_PER_DEGREE_LAT = 111320;

/**
 * How much ground the map shows when it opens on a city or a general area
 * rather than on the user: a few kilometres of the centre, still close enough
 * that venues are drawn (use-nearby-venues stops past ~5.5km of map).
 */
export const AREA_RADIUS_METERS = 1500;


export type Coords = { latitude: number; longitude: number };

/** Metres between two points, Haversine - the same formula venues_near uses. */
export function distanceMeters(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}


export type LocationState =
  | { status: 'loading' }
  | { status: 'granted'; latitude: number; longitude: number }
  | { status: 'denied' }
  | { status: 'error'; message: string };

/**
 * The user's position, while `enabled`.
 *
 * Never asks for permission: that happens only when someone chooses "Near me"
 * (see @/lib/map-location), so declining here is impossible by construction and
 * the OS prompt is not used up by merely opening the map. Without permission
 * this reports 'denied' and the map starts somewhere else.
 *
 * The position stays on the device. It moves the camera and draws the dot;
 * anything sent to a server is rounded first - see @/lib/location-privacy.
 *
 * expo-location covers web as well, where it delegates to the browser's
 * geolocation API - so this is one code path for every platform. Approximate
 * location (Android 12+, iOS) is accepted as it comes: the fixes are coarser,
 * and nothing here needs them precise.
 */
export function useCurrentLocation(enabled: boolean): LocationState {
  const [state, setState] = React.useState<LocationState>({ status: 'loading' });

  React.useEffect(() => {
    if (!enabled) return;
    let active = true;

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (!active) return;

        if (status !== 'granted') {
          setState({ status: 'denied' });
          return;
        }

        // A cached fix returns instantly where a fresh one can take seconds on
        // a cold GPS start - and the map, and everything that waits on it,
        // cannot draw until we have some position.
        const cached = await Location.getLastKnownPositionAsync();
        if (!active) return;
        if (cached) {
          setState({
            status: 'granted',
            latitude: cached.coords.latitude,
            longitude: cached.coords.longitude,
          });
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!active) return;

        setState({
          status: 'granted',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch (error) {
        if (!active) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not read your location.',
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled]);

  return enabled ? state : { status: 'denied' };
}

/**
 * The user's position while the map is following them.
 *
 * Subscribes only while `enabled`, so List view and a map the user has panned
 * away from cost no GPS at all.
 *
 * 5m is a few paces: small enough that the camera creeps rather than jumps,
 * large enough to sit above GPS jitter, which at High accuracy (~10m) would
 * otherwise wobble the map continuously. timeInterval is Android-only, so
 * distanceInterval is the only throttle on iOS.
 *
 * Returns two values on purpose. `position` moves with every fix and drives the
 * camera. `anchor` only steps once the user has travelled `anchorThresholdMeters`
 * and drives refetching - because rebuilding the venue list on every fix would
 * remount every marker and replay its fade, which reads as constant flicker.
 */
export function useFollowPosition(
  enabled: boolean,
  anchorThresholdMeters: number
): { position: Coords | null; anchor: Coords | null } {
  const [position, setPosition] = React.useState<Coords | null>(null);
  const [anchor, setAnchor] = React.useState<Coords | null>(null);
  const anchorRef = React.useRef<Coords | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    async function start() {
      if (subscription) return;

      // Checked, never requested: see useCurrentLocation.
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;

      const next = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        (fix) => {
          const next = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
          setPosition(next);

          // Throttled here, in the callback, rather than derived during render:
          // reading and writing a ref while rendering is not allowed.
          const previous = anchorRef.current;
          if (!previous || distanceMeters(previous, next) >= anchorThresholdMeters) {
            anchorRef.current = next;
            setAnchor(next);
          }
        }
      );

      // The await above can resolve after unmount; without this the native
      // watcher leaks and GPS stays on.
      if (cancelled) {
        next.remove();
        return;
      }
      subscription = next;
    }

    start();

    // The OS suspends the watcher while backgrounded, so restart it on return.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      subscription = null;
      appState.remove();
    };
  }, [enabled, anchorThresholdMeters]);

  return { position, anchor };
}
