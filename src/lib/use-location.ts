import * as Location from 'expo-location';
import * as React from 'react';
import { AppState } from 'react-native';

/**
 * How much ground the map shows around the user, in metres. Roughly the radius
 * from the centre to the nearer screen edge.
 */
export const VIEW_RADIUS_METERS = 200;

/** How far you must walk before nearby venues are fetched again. */
export const REFETCH_DISTANCE_METERS = 50;

export type Coords = { latitude: number; longitude: number };

/** Metres between two points. Haversine, same formula the venues_near function uses. */
function distanceMeters(a: Coords, b: Coords): number {
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
 * The position that nearby venues are fetched around, updated only once you have
 * actually walked somewhere.
 *
 * watchPositionAsync fires every few seconds. Letting each fix reach React would
 * re-render - and on Android re-rasterise - every map marker several times a
 * minute. Holding the raw fixes in a ref and publishing a new anchor only past
 * REFETCH_DISTANCE_METERS turns that into roughly one update per 35 seconds of
 * walking, and none at all while standing still.
 */
export function useWalkingAnchor(): Coords | null {
  const [anchor, setAnchor] = React.useState<Coords | null>(null);
  const anchorRef = React.useRef<Coords | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== 'granted') return;

      const next = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (position) => {
          const fix = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          const previous = anchorRef.current;
          if (previous && distanceMeters(previous, fix) < REFETCH_DISTANCE_METERS) return;
          anchorRef.current = fix;
          setAnchor(fix);
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
      if (state !== 'active' || subscription) return;
      start();
    });

    return () => {
      cancelled = true;
      subscription?.remove();
      subscription = null;
      appState.remove();
    };
  }, []);

  return anchor;
}
