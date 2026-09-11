// The google.maps namespace used below comes from @types/google.maps, which
// arrives as a transitive dependency of @vis.gl/react-google-maps rather than
// a direct one, so it is referenced explicitly instead of being relied on to
// be picked up automatically.
/// <reference types="google.maps" />

import { AdvancedMarker, APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { PlaceResult } from '@/lib/place-search';
import { lookupPlace } from '@/lib/place-search';
import { supabase } from '@/lib/supabase';
import { VIEW_RADIUS_METERS } from '@/lib/use-location';
import type { Coords } from '@/lib/use-location';
import type { MapRegion, NearbyVenue } from '@/lib/use-nearby-venues';
import type { SelectedPoi } from '@/lib/venues';

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY;
/**
 * Advanced markers refuse to load without a map ID, and that is the only reason
 * one is needed here - a map ID is free to create and bills identically, since
 * the Dynamic Maps SKU covers the Maps JavaScript API "with or without a map
 * ID". DEMO_MAP_ID is Google's documented test value and is fine until a real
 * one is set in .env.
 */
const mapId = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

/** Ground resolution at zoom 0 on the equator, in metres per pixel. */
const EQUATOR_METERS_PER_PIXEL = 156543.03392;

/**
 * Native takes a region in degrees; the JS API takes a zoom level. Derive the
 * zoom that puts `radiusMeters` between the centre and the nearest screen edge,
 * so both platforms frame the same amount of ground.
 */
function zoomForRadius(latitude: number, radiusMeters: number): number {
  const shortestEdge = Math.max(Math.min(window.innerWidth, window.innerHeight), 320);
  const metersPerPixel = radiusMeters / (shortestEdge / 2);
  const zoom = Math.log2(
    (EQUATOR_METERS_PER_PIXEL * Math.cos((latitude * Math.PI) / 180)) / metersPerPixel
  );
  return Math.min(Math.max(zoom, 3), 20);
}

// ---------------------------------------------------------------------------
// Rating box
//
// Deliberately a second implementation of venue-marker.tsx rather than a shared
// one. That file imports react-native-maps, which has no web build, and its
// shape is dictated by an Android constraint that does not exist here: a marker
// view is rasterised to a bitmap once, which is why native splits the box and
// its close button into two markers and draws stars as text glyphs. On the web
// the marker is live DOM, so the close button can simply live inside the box.
// The numbers below are copied from that file on purpose - the two platforms
// are meant to look identical.
// ---------------------------------------------------------------------------

const BOX_WIDTH = 168;
const BOX_HEIGHT = 44;
const SNIPPET_CHARS = 40;
/** Clearance above the point, so the box does not sit on Google's own label. */
const LIFT = 35;
const CLOSE_SIZE = 26;
const ENTER_MS = 160;

/** Matches venue-marker.tsx: earned stars only, with a half as a literal glyph. */
function starGlyphs(average: number): string {
  const rounded = Math.round(average * 2) / 2;
  const full = Math.floor(rounded);
  return '★'.repeat(full) + (rounded - full === 0.5 ? '½' : '');
}

function summarise(venue: NearbyVenue): string {
  const body = venue.latest_review_body?.trim();
  if (body) {
    return body.length > SNIPPET_CHARS ? `${body.slice(0, SNIPPET_CHARS).trimEnd()}...` : body;
  }
  return venue.review_count === 1 ? '1 review' : `${venue.review_count} reviews`;
}

// Plain DOM and inline styles, not NativeWind: AdvancedMarker portals its
// children into a div it owns, outside the react-native-web tree, so className
// would never be resolved.
const boxStyle: React.CSSProperties = {
  position: 'relative',
  boxSizing: 'border-box',
  width: BOX_WIDTH,
  height: BOX_HEIGHT,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid #e5e5e5',
  // Solid, because markers cannot occlude Google's own place labels; a fill
  // and shadow is what keeps the box readable where they overlap.
  background: '#ffffff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
  cursor: 'pointer',
  userSelect: 'none',
};

const lineStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const starsStyle: React.CSSProperties = {
  ...lineStyle,
  fontSize: 13,
  lineHeight: '16px',
  color: '#f59e0b',
  fontWeight: 600,
};

const snippetStyle: React.CSSProperties = {
  ...lineStyle,
  fontSize: 11,
  lineHeight: '14px',
  color: '#525252',
};

const closeStyle: React.CSSProperties = {
  position: 'absolute',
  // Centred on the box's top-right corner, matching the native close marker.
  top: -CLOSE_SIZE / 2,
  right: -CLOSE_SIZE / 2,
  width: CLOSE_SIZE,
  height: CLOSE_SIZE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  borderRadius: CLOSE_SIZE / 2,
  border: '1px solid #e5e5e5',
  background: '#ffffff',
  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
  fontSize: 13,
  lineHeight: '16px',
  fontWeight: 700,
  color: '#525252',
  cursor: 'pointer',
};

type VenueBoxProps = {
  venue: NearbyVenue;
  onSelect: (venue: NearbyVenue) => void;
  onDismiss: (venueId: string) => void;
};

function VenueBox({ venue, onSelect, onDismiss }: VenueBoxProps) {
  // Reanimated does not reach into the marker's portal, so the entrance is a
  // plain opacity transition flipped on the frame after mount.
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const average = Number(venue.avg_stars ?? 0);

  return (
    <AdvancedMarker
      position={{ lat: venue.lat, lng: venue.lng }}
      // Without this the library leaves pointer-events 'none' on the content
      // div and neither the box nor its close button can be clicked.
      clickable
      // The default anchor is the content's bottom centre; the extra -LIFT is
      // what native expresses as anchor/centerOffset.
      anchorLeft="-50%"
      anchorTop={`calc(-100% - ${LIFT}px)`}
      // Southern markers draw over northern ones, the usual map-label look.
      //
      // Offset from the pole rather than negated as on native. react-native-maps
      // treats zIndex as an ordering among markers, so a negative is harmless
      // there; here it becomes a real CSS z-index, and a negative one drops the
      // box behind the map's overlay panes, where it renders but cannot be
      // clicked. Subtracting from 90 keeps the same ordering, always positive.
      zIndex={Math.round((90 - venue.lat) * 1000)}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${venue.name}, ${average.toFixed(1)} of 5`}
        onClick={() => onSelect(venue)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(venue);
        }}
        style={{ ...boxStyle, opacity: shown ? 1 : 0, transition: `opacity ${ENTER_MS}ms ease-out` }}>
        <div style={starsStyle}>
          {starGlyphs(average)} <span style={{ color: '#0a0a0a' }}>{average.toFixed(1)}</span>
        </div>
        <div style={snippetStyle}>{summarise(venue)}</div>

        <button
          type="button"
          aria-label={`Hide ${venue.name}`}
          // Or the box's own click fires too and the sheet opens as it closes.
          onClick={(event) => {
            event.stopPropagation();
            onDismiss(venue.id);
          }}
          style={closeStyle}>
          x
        </button>
      </div>
    </AdvancedMarker>
  );
}

// ---------------------------------------------------------------------------
// Search pin
//
// The web twin of search-marker.tsx, for the same reason VenueBox is the twin
// of venue-marker.tsx: that file imports react-native-maps, which has no web
// build. The numbers are copied deliberately so the platforms look alike.
// ---------------------------------------------------------------------------

const SEARCH_BOX_WIDTH = 200;
const SEARCH_BOX_HEIGHT = 40;

const searchBoxStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  width: SEARCH_BOX_WIDTH,
  height: SEARCH_BOX_HEIGHT,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '0 12px',
  borderRadius: 10,
  // Filled dark where the rating boxes are white: a rating box is somewhere
  // other people have been, this is the one place you asked about.
  background: '#171717',
  boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
  cursor: 'pointer',
  userSelect: 'none',
};

const searchNameStyle: React.CSSProperties = {
  ...lineStyle,
  fontSize: 13,
  lineHeight: '16px',
  fontWeight: 600,
  color: '#fafafa',
};

const searchHintStyle: React.CSSProperties = {
  ...lineStyle,
  fontSize: 11,
  lineHeight: '14px',
  color: '#a3a3a3',
};

type SearchPinProps = {
  place: PlaceResult;
  onSelect: (place: PlaceResult) => void;
};

function SearchPin({ place, onSelect }: SearchPinProps) {
  // Mount-only, exactly like VenueBox. The parent keys this component by place
  // id, so a new search remounts it and the fade replays from here.
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <AdvancedMarker
      position={{ lat: place.latitude, lng: place.longitude }}
      clickable
      anchorLeft="-50%"
      anchorTop={`calc(-100% - ${LIFT}px)`}
      // Above every rating box - their ceiling is (90 - lat) * 1000 - and
      // positive, or it drops behind the map's overlay panes and stops
      // receiving clicks.
      zIndex={1_000_000}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Rate ${place.name}`}
        onClick={() => onSelect(place)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(place);
        }}
        style={{
          ...searchBoxStyle,
          opacity: shown ? 1 : 0,
          transition: `opacity ${ENTER_MS}ms ease-out`,
        }}>
        <div style={searchNameStyle}>{place.name}</div>
        <div style={searchHintStyle}>Click to rate</div>
      </div>
    </AdvancedMarker>
  );
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/**
 * How long a programmatic move is allowed to settle before idle events count as
 * the user again. The flag cannot simply be cleared on the next idle: panTo to
 * somewhere the map already sits emits no idle at all, and the flag would then
 * swallow the user's next pan.
 */
const PROGRAMMATIC_SETTLE_MS = 650;

type CameraProps = {
  followCenter: Coords | null;
  focusToken: number;
  programmaticRef: React.RefObject<boolean>;
};

/**
 * Drives the camera imperatively from inside the map.
 *
 * panTo on an uncontrolled map, never a controlled `center` prop: a controlled
 * centre that is not updated on every camera event locks the map, and panTo
 * preserves whatever zoom the user chose, which is exactly what the native side
 * gets from animateCamera with a partial camera.
 */
function Camera({ followCenter, focusToken, programmaticRef }: CameraProps) {
  const map = useMap();

  React.useEffect(() => {
    if (!map || !followCenter) return;

    programmaticRef.current = true;
    map.panTo({ lat: followCenter.latitude, lng: followCenter.longitude });

    const timer = setTimeout(() => {
      programmaticRef.current = false;
    }, PROGRAMMATIC_SETTLE_MS);
    return () => clearTimeout(timer);
    // focusToken re-runs the move even when the target has not changed, so
    // pressing recentre while already centred still does something.
  }, [map, followCenter, focusToken, programmaticRef]);

  return null;
}

/** The visible bounds, in the degree-deltas the shared fetch hook expects. */
function regionOf(map: google.maps.Map): MapRegion | null {
  const bounds = map.getBounds();
  const center = map.getCenter();
  if (!bounds || !center) return null;

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  let longitudeDelta = ne.lng() - sw.lng();
  // Crossing the antimeridian wraps the difference negative.
  if (longitudeDelta < 0) longitudeDelta += 360;

  return {
    latitude: center.lat(),
    longitude: center.lng(),
    latitudeDelta: ne.lat() - sw.lat(),
    longitudeDelta,
  };
}

type VenueMapProps = {
  center: { latitude: number; longitude: number };
  onSelectPoi: (poi: SelectedPoi) => void;
  /** Tapping bare map, away from any place label. */
  onDismiss: () => void;
  venues: NearbyVenue[];
  onSelectVenue: (venue: NearbyVenue) => void;
  onDismissVenue: (venueId: string) => void;
  /** The place the user searched for, pinned until they clear the box. */
  searchResult: PlaceResult | null;
  onSelectSearchResult: (place: PlaceResult) => void;
  /** Where the camera should sit while following. Null pauses following. */
  followCenter: Coords | null;
  focusToken: number;
  /** Fires only for a pan or zoom the user performed, never our own moves. */
  onUserPannedTo: (region: MapRegion) => void;
};

/**
 * Web uses the Maps JavaScript API; native uses react-native-maps, which has no
 * web support. Metro picks this file for web, so the two never collide.
 *
 * Tapping a label opens the review form here exactly as it does on a phone.
 * That took a detour: Android's onPoiClick hands back a place's name with the
 * tap, while the JS API's click event carries only an id, so the web build has
 * to fetch the name. Doing that from the browser would have meant a billable
 * Places key in the bundle, so for a while web could only open places somebody
 * had already reviewed. The edge function proxy removed that constraint - the
 * lookup happens server-side now, and both platforms behave the same.
 */
export function VenueMap({
  center,
  onSelectPoi,
  onDismiss,
  venues,
  onSelectVenue,
  onDismissVenue,
  searchResult,
  onSelectSearchResult,
  followCenter,
  focusToken,
  onUserPannedTo,
}: VenueMapProps) {
  const programmaticRef = React.useRef(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const noticeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    []
  );

  const showNotice = React.useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  const selectPlace = React.useCallback(
    async (placeId: string, at: google.maps.LatLngLiteral | null) => {
      // Our own table first, and free. A place somebody has already reviewed
      // has a name here, so there is nothing to look up.
      const { data } = await supabase
        .from('venues')
        .select('name, lat, lng')
        .eq('google_place_id', placeId)
        .maybeSingle();

      if (data) {
        onSelectPoi({
          placeId,
          name: data.name,
          latitude: data.lat ?? at?.lat ?? 0,
          longitude: data.lng ?? at?.lng ?? 0,
        });
        return;
      }

      // Nobody has reviewed it, so the name has to be fetched - one Place
      // Details call through the same proxy search uses, and cached there.
      // The coordinates from the click are the fallback: they are where the
      // user actually pointed, which is good enough if Google's differ.
      const outcome = await lookupPlace(placeId);
      if (!outcome.ok) {
        showNotice(outcome.message);
        return;
      }

      // Zoomed out, the clickable labels are cities and regions. They are not
      // places you walk into, so there is nothing to review about them.
      if (outcome.place.reviewable === false) {
        showNotice(`${outcome.place.name} is a place on the map, not somewhere you can visit - so there is nothing to review. Zoom in and pick a venue.`);
        return;
      }

      onSelectPoi({
        placeId,
        name: outcome.place.name,
        latitude: outcome.place.latitude ?? at?.lat ?? 0,
        longitude: outcome.place.longitude ?? at?.lng ?? 0,
      });
    },
    [onSelectPoi, showNotice]
  );

  if (!apiKey) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-muted px-6">
        <Text className="text-lg font-semibold text-foreground">Map key missing</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Set EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY in .env, then restart the dev server. Environment
          variables are inlined at build time, so a running server will not pick it up.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: '100%', height: '100%' }}
          mapId={mapId}
          defaultCenter={{ lat: center.latitude, lng: center.longitude }}
          defaultZoom={zoomForRadius(center.latitude, VIEW_RADIUS_METERS)}
          gestureHandling="greedy"
          clickableIcons
          // Unlike native - where a POI tap goes to onPoiClick and never to
          // onPress - the web map reports both through onClick, so the place id
          // is what tells them apart. It is undefined on ordinary clicks
          // despite being typed string | null, so this must be a truthy test.
          onClick={(event) => {
            const placeId = event.detail.placeId;
            if (placeId) {
              // Suppress Google's own info window; the app answers the tap.
              event.stop();
              void selectPlace(placeId, event.detail.latLng);
              return;
            }
            onDismiss();
          }}
          // onIdle, not onCameraChanged: the latter is an alias for
          // bounds_changed and fires continuously through a drag, which would
          // be a query per frame. This is the analogue of native's
          // onRegionChangeComplete. Its own detail is empty, so read the map.
          onIdle={(event) => {
            if (programmaticRef.current) return;
            const region = regionOf(event.map);
            if (region) onUserPannedTo(region);
          }}
          // Strip Google's default chrome - this is our UI, not theirs.
          mapTypeControl={false}
          fullscreenControl={false}
          streetViewControl={false}
          cameraControl={false}
          rotateControl={false}
          zoomControl={false}>
          <Camera
            followCenter={followCenter}
            focusToken={focusToken}
            programmaticRef={programmaticRef}
          />

          {venues.map((venue) => (
            <VenueBox
              key={venue.id}
              venue={venue}
              onSelect={onSelectVenue}
              onDismiss={onDismissVenue}
            />
          ))}

          {/* Keyed by place: a new search remounts the pin rather than moving
              it, which is what replays the entrance fade. */}
          {searchResult ? (
            <SearchPin
              key={searchResult.placeId}
              place={searchResult}
              onSelect={onSelectSearchResult}
            />
          ) : null}
        </Map>
      </APIProvider>

      {notice ? (
        <View pointerEvents="box-none" className="absolute inset-x-0 bottom-20 items-center px-4">
          <Pressable
            onPress={() => setNotice(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            className="max-w-md rounded-xl bg-foreground/90 px-4 py-3 shadow-lg">
            <Text className="text-center text-sm text-background">{notice}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
