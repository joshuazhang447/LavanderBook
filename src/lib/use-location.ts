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

/** The span the map opens at, shared so the first fetch matches the first view. */
export const INITIAL_LATITUDE_DELTA = (VIEW_RADIUS_METERS * 2) / METERS_PER_DEGREE_LAT;


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
 * Asks once for foreground location and resolves the user's position.
 *
 * expo-location covers web as well, where it delegates to the browser's
 * geolocation API - so this is one code path for every platform.
 */
export function useCurrentLocation(): LocationState {
  const [state, setState] = React.useState<LocationState>({ status: 'loading' });

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!active) return;

        if (status !== 'granted') {
          setState({ status: 'denied' });
          return;
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
  }, []);

  return state;
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

      const { status } = await Location.requestForegroundPermissionsAsync();
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
