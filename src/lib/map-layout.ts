import { isMapped, type NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags } from '@/lib/venue-tags';

/**
 * Where each place goes on the map, and which places get a label.
 *
 * Every place used to be a 168-point card floating 35 points above its spot,
 * with an x to close it. Downtown the cards piled on top of each other: the
 * ones underneath could not be read or pressed, the card did not point at
 * anything, so which building it meant was a guess, and the x was there only
 * to clear the pile by hand.
 *
 * Map apps solve this with two rules, and these are theirs:
 *
 * 1. A small pin at the exact spot, always. Pins that would touch become one
 *    numbered group (Apple's clustering, Google's marker clusterer). Pressing
 *    a group zooms in until its places stand apart. Places sharing one
 *    building never stand apart, so their group fans out around the spot
 *    instead (the "spiderfier" pattern).
 * 2. A label beside a pin only where it fits. Labels never overlap a pin or
 *    another label (Google's collision behaviour, Apple's display priority).
 *    The most important places are labelled first. A place whose label does
 *    not fit keeps its pin, and gets the label once you zoom in. With room to
 *    spare, a reviewed place's label grows a line to quote its latest review.
 *
 * The layout is worked out in world pixels at one zoom: panning moves
 * everything together, so only a change of zoom changes it. Shared by the
 * phone map and the website's, so both lay out the same.
 */

/** The pin's round head. */
export const PIN_SIZE = 30;
/** The point under the head, whose tip sits on the place's exact spot. */
export const PIN_TAIL = 6;
/** From the tip up to the head's centre. */
const HEAD_LIFT = PIN_TAIL + PIN_SIZE / 2;

/**
 * A group's circle, a little larger as it holds more, so a city's worth of
 * places reads as more than a street's when the map is zoomed out.
 */
export function groupSize(count: number): number {
  return count < 10 ? 34 : count < 100 ? 40 : 46;
}
export const LABEL_GAP = 4;
export const COMPACT_HEIGHT = 34;
export const FULL_HEIGHT = 50;
export const FULL_WIDTH = 176;
/** Room around a marker's drawing for its shadow, which Android would clip. */
export const SHADOW_MARGIN = 4;
const LABEL_MIN_WIDTH = 64;
const LABEL_MAX_WIDTH = 160;
const LABEL_PADDING = 8;
/** Pins closer than this, centre to centre, are drawn as one group. */
const GROUP_DISTANCE = PIN_SIZE + 2;
/** Space kept between two labels, or a label and a pin. */
const CLEARANCE = 2;
/** Past this zoom a group is fanned out instead: zooming no longer helps. */
export const MAX_GROUP_ZOOM = 19;
/** Quotes only from street level in: further out a quote is noise over a city. */
const QUOTE_FROM_ZOOM = 14;
const QUOTE_CHARS = 40;

export type LabelSide = 'right' | 'left' | 'bottom' | 'top';
export type LabelSize = 'compact' | 'full';
/** Tried in this order: beside the pin first, as map apps do. */
const SIDES: readonly LabelSide[] = ['right', 'left', 'bottom', 'top'];

export type PlaceLabel = { side: LabelSide; size: LabelSize; width: number };

export type PlaceItem = {
  kind: 'place';
  key: string;
  venue: NearbyVenue;
  label: PlaceLabel | null;
  /** How far the pin is drawn from the place's true spot: non-zero only in a fanned-out group. */
  offset: { x: number; y: number };
  /** Higher draws on top. */
  z: number;
};

export type GroupItem = {
  kind: 'group';
  key: string;
  venues: NearbyVenue[];
  lat: number;
  lng: number;
  z: number;
};

export type MapItem = PlaceItem | GroupItem;

// ---------------------------------------------------------------------------
// What a label says
// ---------------------------------------------------------------------------

/** "★ 4.5 (3)", or null before anyone has reviewed it - never "0.0". */
export function ratingText(venue: NearbyVenue): string | null {
  if (venue.review_count === 0) return null;
  return `★ ${Number(venue.avg_stars ?? 0).toFixed(1)} (${venue.review_count})`;
}

/** The latest review, cut to a line. The server masks it. */
export function quoteText(venue: NearbyVenue): string | null {
  const body = venue.latest_review_body?.trim();
  if (!body || venue.review_count === 0) return null;
  return body.length > QUOTE_CHARS ? `${body.slice(0, QUOTE_CHARS).trimEnd()}…` : body;
}

/** Read out for the whole marker. */
export function spokenPlace(venue: NearbyVenue): string {
  const tag = venueTags(venue)[0];
  const parts = [venue.name];
  if (tag) parts.push(tag.label);
  parts.push(
    venue.review_count === 0
      ? 'listed, not yet reviewed'
      : `${Number(venue.avg_stars ?? 0).toFixed(1)} of 5, ${venue.review_count} ${
          venue.review_count === 1 ? 'review' : 'reviews'
        }`
  );
  return parts.join(', ');
}

/**
 * How wide a two-line label is, from its words. Estimated, since nothing can
 * be measured before it is drawn, and on the generous side: a short guess
 * cuts the name, a long one only wastes a little map.
 */
function compactWidth(venue: NearbyVenue): number {
  const name = venue.name.length * 7;
  const rating = ratingText(venue);
  const tag = venueTags(venue)[0];
  const chip = tag ? Math.min(tag.label.length * 5.6 + 8, 84) : 0;
  const meta = (rating ? rating.length * 6 : 0) + chip + (rating && tag ? 4 : 0);
  return Math.min(
    LABEL_MAX_WIDTH,
    Math.max(LABEL_MIN_WIDTH, Math.ceil(Math.max(name, meta) + LABEL_PADDING * 2 + 2))
  );
}

// ---------------------------------------------------------------------------
// Geometry of one marker
// ---------------------------------------------------------------------------

export type MarkerGeometry = {
  /** The marker's whole drawing, shadow room included. */
  width: number;
  height: number;
  /** The pin's top-left corner within it. */
  pin: { x: number; y: number };
  label: { x: number; y: number; width: number; height: number } | null;
  /** Where in the drawing the place's true spot is. Android's anchor, iOS's centre offset, the website's translate. */
  anchor: { x: number; y: number };
};

function labelHeight(label: PlaceLabel): number {
  return label.size === 'full' ? FULL_HEIGHT : COMPACT_HEIGHT;
}

/**
 * The label's box relative to the pin's tip: beside, under or over the head,
 * centred on it. Under means under the point as well.
 */
function labelBox(label: PlaceLabel): { x: number; y: number; width: number; height: number } {
  const h = labelHeight(label);
  const w = label.width;
  const half = PIN_SIZE / 2;
  switch (label.side) {
    case 'right':
      return { x: half + LABEL_GAP, y: -HEAD_LIFT - h / 2, width: w, height: h };
    case 'left':
      return { x: -half - LABEL_GAP - w, y: -HEAD_LIFT - h / 2, width: w, height: h };
    case 'bottom':
      return { x: -w / 2, y: LABEL_GAP, width: w, height: h };
    case 'top':
      return { x: -w / 2, y: -PIN_TAIL - PIN_SIZE - LABEL_GAP - h, width: w, height: h };
  }
}

/** The pin, head and point, relative to its tip. */
const PIN_BOX = { x: -PIN_SIZE / 2, y: -PIN_SIZE - PIN_TAIL, width: PIN_SIZE, height: PIN_SIZE + PIN_TAIL };

export function placeGeometry(item: Pick<PlaceItem, 'label' | 'offset'>): MarkerGeometry {
  const label = item.label ? labelBox(item.label) : null;
  const left = Math.min(PIN_BOX.x, label?.x ?? Infinity);
  const top = Math.min(PIN_BOX.y, label?.y ?? Infinity);
  const right = Math.max(PIN_BOX.x + PIN_BOX.width, label ? label.x + label.width : -Infinity);
  const bottom = Math.max(PIN_BOX.y + PIN_BOX.height, label ? label.y + label.height : -Infinity);
  // The tip, in the drawing.
  const tx = -left + SHADOW_MARGIN;
  const ty = -top + SHADOW_MARGIN;

  return {
    width: right - left + SHADOW_MARGIN * 2,
    height: bottom - top + SHADOW_MARGIN * 2,
    pin: { x: tx + PIN_BOX.x, y: ty + PIN_BOX.y },
    label: label ? { ...label, x: tx + label.x, y: ty + label.y } : null,
    anchor: { x: tx - item.offset.x, y: ty - item.offset.y },
  };
}

export function groupGeometry(count: number): MarkerGeometry {
  const size = groupSize(count) + SHADOW_MARGIN * 2;
  return {
    width: size,
    height: size,
    pin: { x: SHADOW_MARGIN, y: SHADOW_MARGIN },
    label: null,
    anchor: { x: size / 2, y: size / 2 },
  };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

/** Web Mercator, in pixels at `zoom`: the world is 256 * 2^zoom wide. */
export function worldPoint(latitude: number, longitude: number, zoom: number): Point {
  const scale = 256 * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((latitude * Math.PI) / 180), -0.9999), 0.9999);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/**
 * What gets a label first: places LavenderBook lists - the reason the map
 * exists - then the most reviewed, then the best rated.
 */
function rank(venue: NearbyVenue): number {
  return (
    (venueTags(venue).length > 0 ? 1e6 : 0) +
    Math.min(venue.review_count, 999) * 1000 +
    Number(venue.avg_stars ?? 0)
  );
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width + CLEARANCE &&
    b.x < a.x + a.width + CLEARANCE &&
    a.y < b.y + b.height + CLEARANCE &&
    b.y < a.y + a.height + CLEARANCE
  );
}

function around(center: Point, size: number): Rect {
  return { x: center.x - size / 2, y: center.y - size / 2, width: size, height: size };
}

/** A pin whose tip is at `tip`. */
function pinAt(tip: Point): Rect {
  return { ...PIN_BOX, x: tip.x + PIN_BOX.x, y: tip.y + PIN_BOX.y };
}

/** Group keys follow their most important place, so a group keeps its key as others join. */
function groupKey(venue: NearbyVenue): string {
  return `group:${venue.id}`;
}

/**
 * Lays out `venues` for the map at `zoom`. `spread` is a group, by key, that
 * was pressed where zooming cannot help: its places are fanned out around it.
 */
export function layoutMarkers(
  venues: readonly NearbyVenue[],
  zoom: number,
  spread: string | null = null
): MapItem[] {
  const ranked = venues
    .filter(isMapped)
    .map((venue) => ({ venue, rank: rank(venue), at: worldPoint(venue.lat, venue.lng, zoom) }))
    .sort((a, b) => b.rank - a.rank || a.venue.id.localeCompare(b.venue.id));
  const z = new Map(ranked.map((entry, index) => [entry.venue.id, ranked.length - index]));

  // 1. Groups: each place joins the first group whose leader its pin would
  //    touch, in rank order, so a group's leader is its most important place.
  const clusters: { leader: Point; members: typeof ranked }[] = [];
  for (const entry of ranked) {
    const near = clusters.find(
      (cluster) =>
        Math.hypot(cluster.leader.x - entry.at.x, cluster.leader.y - entry.at.y) < GROUP_DISTANCE
    );
    if (near) near.members.push(entry);
    else clusters.push({ leader: entry.at, members: [entry] });
  }

  const items: MapItem[] = [];
  const occupied: Rect[] = [];
  // Places in the order they are offered a label: a fanned-out group's first,
  // since it was just pressed to be read, then everything by rank.
  const places: { item: PlaceItem; center: Point; first: boolean }[] = [];

  for (const cluster of clusters) {
    const leader = cluster.members[0].venue;
    const center = {
      x: cluster.members.reduce((sum, m) => sum + m.at.x, 0) / cluster.members.length,
      y: cluster.members.reduce((sum, m) => sum + m.at.y, 0) / cluster.members.length,
    };

    if (cluster.members.length === 1) {
      const item: PlaceItem = {
        kind: 'place',
        key: leader.id,
        venue: leader,
        label: null,
        offset: { x: 0, y: 0 },
        z: z.get(leader.id) ?? 0,
      };
      items.push(item);
      places.push({ item, center: cluster.members[0].at, first: false });
      occupied.push(pinAt(cluster.members[0].at));
      continue;
    }

    if (spread === groupKey(leader)) {
      // In a ring around the group's centre, the most important at the top,
      // just far enough apart for pins not to touch.
      const count = cluster.members.length;
      const radius = Math.max(34, (count * (PIN_SIZE + 8)) / (2 * Math.PI));
      cluster.members.forEach((member, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
        const tip = { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
        const item: PlaceItem = {
          kind: 'place',
          key: member.venue.id,
          venue: member.venue,
          label: null,
          offset: { x: tip.x - member.at.x, y: tip.y - member.at.y },
          // Over everything around it while it is open.
          z: ranked.length + 1 + count - index,
        };
        items.push(item);
        places.push({ item, center: tip, first: true });
        occupied.push(pinAt(tip));
      });
      continue;
    }

    const lat = cluster.members.reduce((sum, m) => sum + m.venue.lat, 0) / cluster.members.length;
    const lng = cluster.members.reduce((sum, m) => sum + m.venue.lng, 0) / cluster.members.length;
    items.push({
      kind: 'group',
      key: groupKey(leader),
      venues: cluster.members.map((member) => member.venue),
      lat,
      lng,
      z: z.get(leader.id) ?? 0,
    });
    occupied.push(around(center, groupSize(cluster.members.length)));
  }

  const order = [...places.filter((p) => p.first), ...places.filter((p) => !p.first)];
  const boxAt = (center: Point, label: PlaceLabel): Rect => {
    const box = labelBox(label);
    return { ...box, x: center.x + box.x, y: center.y + box.y };
  };

  // 2. A two-line label for as many places as fit, most important first.
  const labelled: { place: (typeof order)[number]; box: Rect }[] = [];
  for (const place of order) {
    const width = compactWidth(place.item.venue);
    for (const side of SIDES) {
      const label: PlaceLabel = { side, size: 'compact', width };
      const box = boxAt(place.center, label);
      if (occupied.some((other) => overlaps(box, other))) continue;
      place.item.label = label;
      occupied.push(box);
      labelled.push({ place, box });
      break;
    }
  }

  // 3. Then, where there is still room, a third line quoting the latest
  //    review. Only after every place has had its chance at a name: a quote
  //    is worth less than another place's name.
  for (const entry of zoom >= QUOTE_FROM_ZOOM ? labelled : []) {
    const { item, center } = entry.place;
    if (!item.label || !quoteText(item.venue)) continue;
    const others = occupied.filter((rect) => rect !== entry.box);
    const sides = [item.label.side, ...SIDES.filter((side) => side !== item.label?.side)];
    for (const side of sides) {
      const label: PlaceLabel = { side, size: 'full', width: FULL_WIDTH };
      const box = boxAt(center, label);
      if (others.some((other) => overlaps(box, other))) continue;
      item.label = label;
      occupied[occupied.indexOf(entry.box)] = box;
      entry.box = box;
      break;
    }
  }

  return items;
}

/**
 * Where pressing a group takes the camera: onto the group's own ground, as
 * close as fits all of it on screen - as a map app's cluster does. What is in
 * it then lays out afresh: places apart, smaller groups where they still
 * touch, each pressed in turn. Null when even the closest zoom would leave
 * them touching - one building, a few doors - and the group fans out instead.
 */
export function groupTarget(
  venues: readonly NearbyVenue[],
  zoom: number,
  viewport: { width: number; height: number }
): { latitude: number; longitude: number; zoom: number } | null {
  const mapped = venues.filter(isMapped);
  if (mapped.length === 0) return null;
  const points = mapped.map((venue) => worldPoint(venue.lat, venue.lng, zoom));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

  // How far apart they would be at the closest zoom a group goes to.
  if (span * 2 ** (MAX_GROUP_ZOOM - zoom) < GROUP_DISTANCE) return null;

  const room = Math.max(1, Math.min(viewport.width, viewport.height) - 160);
  const fits = zoom + Math.log2(room / Math.max(span, 1));
  const north = Math.max(...mapped.map((v) => v.lat));
  const south = Math.min(...mapped.map((v) => v.lat));
  const east = Math.max(...mapped.map((v) => v.lng));
  const west = Math.min(...mapped.map((v) => v.lng));

  return {
    latitude: (north + south) / 2,
    longitude: (east + west) / 2,
    zoom: Math.max(zoom + 1, Math.min(fits, MAX_GROUP_ZOOM)),
  };
}

/** The zoom a phone map is at, from the degrees it spans across its width in points. */
export function zoomOfRegion(longitudeDelta: number, widthPoints: number): number {
  return Math.log2((360 * widthPoints) / (Math.max(longitudeDelta, 1e-9) * 256));
}

/**
 * Zoom rounded down to a half step for layout. Relaid at every frame of a
 * pinch, the markers would be re-rendered at every frame; at half steps they
 * move a few times a level, which reads as labels making way. Down, never
 * to the nearest: the map is then at least as far in as the layout assumed,
 * so things are only ever further apart than it allowed for.
 */
export function layoutZoom(zoom: number): number {
  return Math.floor(zoom * 2 + 1e-6) / 2;
}
