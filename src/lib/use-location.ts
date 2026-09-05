import * as Location from 'expo-location';
import * as React from 'react';

/**
 * How much ground the map shows around the user, in metres. Roughly the radius
 * from the centre to the nearer screen edge.
 */
export const VIEW_RADIUS_METERS = 200;

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
