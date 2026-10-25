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
import { useSkin } from '@/lib/skin';
import { supabase } from '@/lib/supabase';
import { deriveTagColors } from '@/lib/tag-colors';
import { VIEW_RADIUS_METERS, ZOOM_IN_SLACK } from '@/lib/use-location';
import type { Coords } from '@/lib/use-location';
import type { MapRegion, NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';
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
/** Two lines: the name and its chip, then "Listed by LavenderBook". */
const BOX_HEIGHT = 44;
/** Three: the name and its chip, the rating, the latest quote. */
const REVIEWED_BOX_HEIGHT = 58;
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
  // Tagged but unreviewed: it is on the map because we listed it, so say that
  // rather than counting to zero. The tag itself is on the line above.
  if (venue.review_count === 0) return 'Listed by LavenderBook';
  return venue.review_count === 1 ? '1 review' : `${venue.review_count} reviews`;
}

// Plain DOM and inline styles, not NativeWind: AdvancedMarker portals its
// children into a div it owns, outside the react-native-web tree, so className
// would never be resolved.
const boxStyle: React.CSSProperties = {
  position: 'relative',
  boxSizing: 'border-box',
  width: BOX_WIDTH,
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

// The box is always white, whatever the app's theme, so the chip always takes
// its light-mode colours - same as the native marker.
const chipStyle: React.CSSProperties = {
  ...lineStyle,
  // Shrinks below its own words and ellipsises, down to 84px, so a long tag
  // cannot take the whole line from the name. The full label is in the sheet.
  flexShrink: 1,
  minWidth: 0,
  maxWidth: 84,
  borderRadius: 5,
  padding: '0 4px',
  fontSize: 10,
  lineHeight: '14px',
  fontWeight: 600,
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
  // `avg_stars ?? 0` would draw a venue nobody has reviewed as "0.0" - a rating
  // of zero out of five, about a place we listed ourselves. An absent rating has
  // to look absent. Same branch as venue-marker.tsx.
  const unreviewed = venue.review_count === 0;
  const tag = venueTags(venue)[0] ?? null;
  const tagColors = deriveTagColors(tag?.color ?? '#e5e5e5', tag?.textColor).light;

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
        aria-label={
          unreviewed
            ? `${venue.name}, listed, not yet reviewed`
            : `${venue.name}, ${average.toFixed(1)} of 5`
        }
        onClick={() => onSelect(venue)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(venue);
        }}
        style={{
          ...boxStyle,
          height: unreviewed ? BOX_HEIGHT : REVIEWED_BOX_HEIGHT,
          opacity: shown ? 1 : 0,
          transition: `opacity ${ENTER_MS}ms ease-out`,
        }}>
        {/* The name always comes first: a box of stars alone could be any of
            the places around it. It shrinks; the chip beside it does not get
            pushed out, because the tag is often why the place is on the map.
            One chip even when a place carries several; the sheet lists them. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ ...starsStyle, color: '#0a0a0a', flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
            {venue.name}
          </div>
          {tag ? (
            <span
              style={{ ...chipStyle, background: tagColors.background, color: tagColors.foreground }}>
              {tag.label}
            </span>
          ) : null}
        </div>
        {unreviewed ? null : (
          <div style={starsStyle}>
            {starGlyphs(average)} <span style={{ color: '#0a0a0a' }}>{average.toFixed(1)}</span>
          </div>
        )}
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

/** Smaller changes of span are latitude drift or rounding, not a zoom. */
const SPAN_CHANGE = 0.1;

/**
 * A fly's curve and pace: how far out it pulls on a long trip, and roughly how
 * many screens a second it covers - Mapbox's defaults, from van Wijk and Nuij,
 * "Smooth and efficient zooming and panning" (2003). From the whole world down
 * to a street would take seven seconds at that pace, so the time is clamped:
 * long enough to see where you went, short enough not to wait for it.
 */
const FLY_CURVE = 1.42;
const FLY_SPEED = 1.2;
const FLY_MIN_MS = 500;
const FLY_MAX_MS = 1500;

/** Web Mercator, as a share of the world: x east from the antimeridian, y down from the top. */
function project(latitude: number, longitude: number): { x: number; y: number } {
  const sin = Math.min(Math.max(Math.sin((latitude * Math.PI) / 180), -0.9999), 0.9999);
  return { x: (longitude + 180) / 360, y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) };
}

function unproject(x: number, y: number): google.maps.LatLngLiteral {
  const wrapped = x - Math.floor(x);
  return {
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
    lng: wrapped * 360 - 180,
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Flies the camera to `target` at `zoom`: out and back in along one curve on a
 * long trip, straight down on a short one. Google's map animates a pan only
 * within a screen and never animates a zoom set from code, so this steps the
 * camera itself, a frame at a time. Returns a cancel.
 */
function flyTo(
  map: google.maps.Map,
  target: Coords,
  zoom: number,
  onDone: () => void
): () => void {
  const center = map.getCenter();
  const fromZoom = map.getZoom();
  const to = { lat: target.latitude, lng: target.longitude };
  if (!center || fromZoom === undefined) {
    map.moveCamera({ center: to, zoom });
    onDone();
    return () => {};
  }

  // All in world units: w is the visible width, u the distance travelled.
  const box = map.getDiv();
  const screen = Math.max(box.clientWidth, box.clientHeight, 1);
  const p0 = project(center.lat(), center.lng());
  const p1 = project(target.latitude, target.longitude);
  // The short way round the antimeridian.
  let dx = p1.x - p0.x;
  if (dx > 0.5) dx -= 1;
  else if (dx < -0.5) dx += 1;
  const dy = p1.y - p0.y;
  const u1 = Math.hypot(dx, dy);
  const w0 = screen / (256 * 2 ** fromZoom);
  const w1 = screen / (256 * 2 ** zoom);
  const rho = FLY_CURVE;
  const rho2 = rho * rho;

  const r = (end: 0 | 1) => {
    const b =
      (w1 * w1 - w0 * w0 + (end ? -1 : 1) * rho2 * rho2 * u1 * u1) /
      (2 * (end ? w1 : w0) * rho2 * u1);
    return Math.log(Math.sqrt(b * b + 1) - b);
  };

  const r0 = u1 > 0 ? r(0) : 0;
  let length = u1 > 0 ? (r(1) - r0) / rho : NaN;
  let width: (s: number) => number;
  let along: (s: number) => number;
  if (Number.isFinite(length) && length > 0) {
    width = (s) => (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0);
    along = (s) => (w0 * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0))) / rho2 / u1;
  } else {
    // Nowhere to go but down: the zoom alone.
    length = Math.abs(Math.log(w1 / w0)) / rho;
    const sign = w1 < w0 ? -1 : 1;
    width = (s) => w0 * Math.exp(sign * rho * s);
    along = () => 1;
  }

  const duration = Math.min(FLY_MAX_MS, Math.max(FLY_MIN_MS, (1000 * length) / FLY_SPEED));
  const start = performance.now();
  let frame = requestAnimationFrame(function step(now) {
    const t = Math.min(1, (now - start) / duration);
    if (t >= 1) {
      map.moveCamera({ center: to, zoom });
      onDone();
      return;
    }
    const s = easeInOut(t) * length;
    const f = along(s);
    map.moveCamera({
      center: unproject(p0.x + dx * f, p0.y + dy * f),
      zoom: Math.log2(screen / (256 * width(s))),
    });
    frame = requestAnimationFrame(step);
  });

  return () => cancelAnimationFrame(frame);
}

type CameraProps = {
  followCenter: Coords | null;
  focusToken: number;
  /** See VenueMapProps.focusRadiusMeters. */
  focusRadiusMeters: number;
  programmaticRef: React.RefObject<boolean>;
  /** True while a fly is stepping the camera, when its idles mean nothing yet. */
  flyingRef: React.RefObject<boolean>;
};

/**
 * Nudges the map's box until its tiles have drawn.
 *
 * Google's map draws no tiles until its box changes size after the map has
 * finished setting itself up. Under a tab bar that takes a row of its own -
 * Basic's, Material's - that happens by accident: the bar arrives a render
 * after the map, and the map's box shrinks to make room. Under one that floats
 * over the map, as Chenfeng's does, nothing moves and the map stayed blank.
 *
 * So until Google says tiles have loaded, the box alternates between its full
 * height and a pixel less, twice a second: each change is a resize, and the
 * first to land after the map is ready starts the tiles. No fixed delay: how
 * long the setting up takes depends on the network, and a tab opened in the
 * background renders nothing until it is shown. Stops at the first tiles, or
 * after half a minute, and always ends at full height.
 */
function SizeNudge() {
  const map = useMap();
  // Only under Chenfeng's floating bar; the others' maps are left as they were.
  const floating = useSkin().skin === 'chenfeng';

  React.useEffect(() => {
    if (!map || !floating) return;
    const box = map.getDiv();
    let tries = 0;
    const stop = () => {
      clearInterval(timer);
      box.style.height = '100%';
    };
    const loaded = map.addListener('tilesloaded', () => {
      stop();
      loaded.remove();
    });
    const timer = setInterval(() => {
      tries += 1;
      if (tries > 60) {
        stop();
        return;
      }
      box.style.height = tries % 2 === 1 ? 'calc(100% - 1px)' : '100%';
    }, 500);
    return () => {
      clearInterval(timer);
      loaded.remove();
    };
  }, [map, floating]);

  return null;
}

/**
 * Drives the camera imperatively from inside the map.
 *
 * panTo on an uncontrolled map, never a controlled `center` prop: a controlled
 * centre that is not updated on every camera event locks the map, and panTo
 * preserves whatever zoom the user chose, which is exactly what the native side
 * gets from animateCamera with a partial camera. An explicit move from further
 * out than its own view flies there instead, zooming in on the way.
 */
function Camera({
  followCenter,
  focusToken,
  focusRadiusMeters,
  programmaticRef,
  flyingRef,
}: CameraProps) {
  const map = useMap();
  // The token the last move was issued for. A new one is an explicit move -
  // Locate, a search result, the locate button - and may zoom; a GPS fix under
  // the same token is a follow step and never does.
  const issuedTokenRef = React.useRef(focusToken);
  const cancelFlightRef = React.useRef<(() => void) | null>(null);
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Taking hold of the map ends a fly where it is: the pan after it is theirs.
  React.useEffect(() => {
    if (!map) return;
    const box = map.getDiv();
    const takeOver = () => {
      if (!cancelFlightRef.current) return;
      cancelFlightRef.current();
      cancelFlightRef.current = null;
      flyingRef.current = false;
      programmaticRef.current = false;
    };
    box.addEventListener('pointerdown', takeOver);
    box.addEventListener('wheel', takeOver, { passive: true });
    return () => {
      box.removeEventListener('pointerdown', takeOver);
      box.removeEventListener('wheel', takeOver);
      cancelFlightRef.current?.();
      cancelFlightRef.current = null;
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [map, programmaticRef, flyingRef]);

  React.useEffect(() => {
    if (!map || !followCenter) return;

    // Only marked issued here, past the guard: a locate press before the first
    // fix arrives still zooms when that fix does.
    const explicit = focusToken !== issuedTokenRef.current;
    issuedTokenRef.current = focusToken;
    // A fix arriving mid-fly would stop it half way down; the next one after
    // it lands catches up.
    if (!explicit && flyingRef.current) return;

    const settle = () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        programmaticRef.current = false;
      }, PROGRAMMATIC_SETTLE_MS);
    };

    programmaticRef.current = true;
    const zoom = map.getZoom();
    const wanted = zoomForRadius(followCenter.latitude, focusRadiusMeters);
    if (explicit && zoom !== undefined && zoom < wanted - Math.log2(ZOOM_IN_SLACK)) {
      cancelFlightRef.current?.();
      flyingRef.current = true;
      cancelFlightRef.current = flyTo(map, followCenter, wanted, () => {
        cancelFlightRef.current = null;
        flyingRef.current = false;
        settle();
      });
      return;
    }

    cancelFlightRef.current?.();
    cancelFlightRef.current = null;
    flyingRef.current = false;
    map.panTo({ lat: followCenter.latitude, lng: followCenter.longitude });
    settle();
    // focusToken re-runs the move even when the target has not changed, so
    // pressing recentre while already centred still does something.
  }, [map, followCenter, focusToken, focusRadiusMeters, programmaticRef, flyingRef]);

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
  /** How much ground to show around `center` when the map opens. */
  initialRadiusMeters?: number;
  /** Native only: the web map draws no position dot. Accepted so both share one call site. */
  showsUser: boolean;
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
  /** See the native VenueMap: the least ground an explicit move shows. */
  focusRadiusMeters?: number;
  /** Fires only for a pan or zoom the user performed, never our own moves. */
  onUserPannedTo: (region: MapRegion) => void;
  /** The visible span whenever it changes by more than a little, whatever changed it. */
  onSpanChanged?: (region: MapRegion) => void;
  /**
   * Unused here: Google's credits on the website cannot be moved, so the tab
   * bar sits above them instead (tab-bar.tsx).
   */
  bottomInset?: number;
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
  initialRadiusMeters = VIEW_RADIUS_METERS,
  onSelectPoi,
  onDismiss,
  venues,
  onSelectVenue,
  onDismissVenue,
  searchResult,
  onSelectSearchResult,
  followCenter,
  focusToken,
  focusRadiusMeters = VIEW_RADIUS_METERS,
  onUserPannedTo,
  onSpanChanged,
}: VenueMapProps) {
  const programmaticRef = React.useRef(false);
  const flyingRef = React.useRef(false);
  // The span last handed to onSpanChanged.
  const reportedSpanRef = React.useRef<number | null>(null);
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
          defaultZoom={zoomForRadius(center.latitude, initialRadiusMeters)}
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
            const region = regionOf(event.map);
            if (!region) return;
            // Every cause but a fly still under way: what loads follows the
            // zoom even when it was ours, or a locate press from the whole
            // world would land on a street and load nothing.
            const reported = reportedSpanRef.current;
            if (
              !flyingRef.current &&
              (reported === null || Math.abs(region.latitudeDelta / reported - 1) > SPAN_CHANGE)
            ) {
              reportedSpanRef.current = region.latitudeDelta;
              onSpanChanged?.(region);
            }
            if (programmaticRef.current) return;
            onUserPannedTo(region);
          }}
          // Strip Google's default chrome - this is our UI, not theirs.
          mapTypeControl={false}
          fullscreenControl={false}
          streetViewControl={false}
          cameraControl={false}
          rotateControl={false}
          zoomControl={false}>
          <SizeNudge />
          <Camera
            followCenter={followCenter}
            focusToken={focusToken}
            focusRadiusMeters={focusRadiusMeters}
            programmaticRef={programmaticRef}
            flyingRef={flyingRef}
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
