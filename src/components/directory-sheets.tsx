import { useTabTrigger } from 'expo-router/ui';
import * as React from 'react';

import { ReviewSheet } from '@/components/review-sheet';
import { VenueSheet } from '@/components/venue-sheet';
import { focusMapOn } from '@/lib/map-focus';
import { isMapped, type NearbyVenue } from '@/lib/use-nearby-venues';
import type { SelectedPoi } from '@/lib/venues';

/**
 * What opens from a row of the Directory, for every skin: the place's card,
 * the review form the card hands off to, and the way over to the map.
 *
 * The same two sheets the Map tab opens, wired the same way - the card is
 * closed before the form opens, and the form is told which venue it is for
 * rather than left to resolve one from a place id.
 */
export function usePlaceSheets(onSaved: () => void) {
  const [viewing, setViewing] = React.useState<NearbyVenue | null>(null);
  const [reviewing, setReviewing] = React.useState<{ poi: SelectedPoi; venueId: string } | null>(
    null
  );
  // switchTab rather than router.navigate: it is the mechanism the tab bar
  // itself uses, so the map tab is focused exactly as a tap would focus it.
  const { switchTab } = useTabTrigger({ name: 'map' });

  const showOnMap = React.useCallback(
    (venue: NearbyVenue) => {
      // An online organisation has nowhere to show; the rows hide the action,
      // and this is the backstop.
      if (!isMapped(venue)) return;
      focusMapOn({ latitude: venue.lat, longitude: venue.lng });
      switchTab('map', {});
    },
    [switchTab]
  );

  const sheets = (
    <>
      {viewing ? (
        <VenueSheet
          venue={viewing}
          onClose={() => setViewing(null)}
          onWriteReview={() => {
            const venue = viewing;
            setViewing(null);
            setReviewing({
              venueId: venue.id,
              poi: {
                placeId: venue.google_place_id ?? undefined,
                name: venue.name,
                latitude: venue.lat,
                longitude: venue.lng,
              },
            });
          }}
        />
      ) : null}

      {reviewing ? (
        <ReviewSheet
          poi={reviewing.poi}
          venueId={reviewing.venueId}
          onClose={() => setReviewing(null)}
          onSaved={() => {
            setReviewing(null);
            // The place has a rating now: ask again rather than wait for it.
            onSaved();
          }}
        />
      ) : null}
    </>
  );

  return { open: setViewing, showOnMap, sheets };
}
