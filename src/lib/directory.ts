import * as React from 'react';
import { BackHandler, Platform } from 'react-native';

import { provinceAt } from '@/lib/area-province';
import { DIRECTORY_TEXT } from '@/lib/directory-text';
import { roundForSearch } from '@/lib/location-privacy';
import { useListPlaceName, type ListPlaceName } from '@/lib/area-name';
import { useMapLocation } from '@/lib/map-location';
import { choiceKey, useMapView } from '@/lib/map-view';
import { matchPlaces } from '@/lib/place-match';
import { useSearchDistance } from '@/lib/search-distance';
import { publicSupabase } from '@/lib/supabase';
import { distanceMeters, useCurrentLocation, type Coords } from '@/lib/use-location';
import { isMapped, type NearbyVenue } from '@/lib/use-nearby-venues';
import { venueTags, type VenueTag } from '@/lib/venue-tags';

/**
 * The places of a whole city, rather than of a piece of map.
 *
 * `useNearbyVenues` asks what is on screen, for drawing markers: a small box,
 * and nothing at all once the map is zoomed out past a few kilometres. The
 * list and the Directory tab are not a map. They ask what is around here -
 * every reviewed or listed place within the distance chosen on the meter,
 * nearest first, and the online organisations that serve here: their city, if
 * it is within the distance, their province, or all of Canada
 * (20261114130000).
 *
 * One request per city and distance: the rows come back whole, and choosing a
 * kind or typing a search in the Directory filters them here. A city has tens
 * of listed places, so that is instant where a request per tap would not be.
 */

/**
 * The slug of the tag that marks an organisation with no place to visit. A
 * slug, not a label: labels are editable prose. See 20261018110000.
 */
export const ONLINE_KIND = 'online';

/**
 * How much further the server is asked to look than the meter says.
 *
 * What is sent is the centre of the ~11 km square the origin falls in, never
 * the origin, and that centre can be nearly 8 km away from it (half the
 * square's diagonal). A request for exactly "5 km" around the centre could
 * miss everything actually near the reader. So the request reaches this much
 * further, and the meter's distance is applied here, on the device, from the
 * real point - which is also the only place it can be applied exactly.
 */
const ROUNDING_REACH_METERS = 8_000;

/**
 * The last answer for each place, for the rest of the session. Every screen
 * that asks (the list, the Directory) starts from it, so switching tab or
 * going from Map to List and back draws what was there at once, rather than a
 * spinner and then every row arriving again - and refreshes it behind.
 */
const lastAnswer = new Map<string, { reach: number; venues: NearbyVenue[] }>();

/** PostgREST's "no function with that name takes these arguments". */
const NO_SUCH_FUNCTION = 'PGRST202';

/**
 * Set once a server has turned out not to have venues_directory, so the rest of
 * the session asks the old way straight off instead of failing first each time.
 * The website is deployed separately from the migrations: for a while after a
 * release, this is simply how things are.
 */
let directoryMissing = false;

/**
 * Cleared once a server's venues_directory has turned out not to take
 * p_province (it predates 20261114130000), for the same reason.
 */
let provinceSupported = true;

type Outcome = { ok: true; venues: NearbyVenue[] } | { ok: false };

async function fetchArea(near: Coords, radius: number): Promise<Outcome> {
  if (!directoryMissing) {
    // Which province the rounded point is in, worked out here: organisations
    // that serve a whole province are listed in that province only.
    const province = provinceSupported ? await provinceAt(near) : null;
    // publicSupabase, not supabase: this carries a place, and must not carry
    // the account with it. See @/lib/location-privacy.
    const { data, error } = await publicSupabase.rpc('venues_directory', {
      p_lat: near.latitude,
      p_lng: near.longitude,
      p_radius_meters: radius,
      ...(province === null ? {} : { p_province: province }),
    });
    if (!error) return { ok: true, venues: (data as NearbyVenue[] | null) ?? [] };
    if (error.code !== NO_SUCH_FUNCTION) return { ok: false };
    // A server from before service areas (20261114130000) has venues_directory
    // without p_province: ask it again the way it understands.
    if (province !== null && provinceSupported) {
      provinceSupported = false;
      return fetchArea(near, radius);
    }
    directoryMissing = true;
  }

  // The old way: venues_search matches a name with ILIKE '%query%', and an
  // empty query matches every name. It has no radius and no descriptions, so
  // the radius is applied here and the rows simply carry none.
  const { data, error } = await publicSupabase.rpc('venues_search', {
    p_query: '',
    p_lat: near.latitude,
    p_lng: near.longitude,
    p_limit: 300,
    p_include_online: true,
  });
  if (error) return { ok: false };

  const rows = (data as NearbyVenue[] | null) ?? [];
  return {
    ok: true,
    // The server's distance is from the same rounded point venues_directory
    // would have measured from, so the two ways draw the same circle.
    venues: rows.filter((row) => !isMapped(row) || row.distance_meters <= radius),
  };
}

export type AreaVenues = {
  /**
   * Null until the first answer for this place has arrived. After that, what
   * was last loaded for the place - which, just after the meter has moved, may
   * be for the distance before: callers cut the rows to the chosen distance
   * themselves (arrangePlaces), so a shorter distance is right at once and a
   * longer one fills in when its answer lands.
   */
  venues: NearbyVenue[] | null;
  /** The last request for this place failed. */
  failed: boolean;
  retry: () => void;
};

/**
 * Every reviewed or listed venue within about `radius` metres of `origin`, and
 * the online organisations.
 *
 * What is sent is the centre of the ~11 km square `origin` falls in, without
 * the account, and a radius reaching far enough past the meter's to make up
 * for that. So walking around, or panning the map within a city, asks for
 * nothing new, and the distances a screen shows - and the cut at the chosen
 * distance - are worked out on the device, from the real point.
 *
 * Refetches when the square or the radius changes, and when `refreshKey` does
 * (a review was posted, or someone pressed refresh). While a refetch for the
 * same place is in flight the rows already loaded stay put.
 */
export function useAreaVenues(
  origin: Coords | null,
  radius: number,
  refreshKey: string
): AreaVenues {
  const near = origin ? roundForSearch(origin) : null;
  // Strings, so a new `origin` object for the same square is the same
  // dependency and fires nothing.
  const placeKey = near ? `${near.latitude},${near.longitude}` : null;
  const reach = radius + ROUNDING_REACH_METERS;

  const [loaded, setLoaded] = React.useState<{ placeKey: string; venues: NearbyVenue[] } | null>(
    () => {
      const cached = placeKey ? lastAnswer.get(placeKey) : undefined;
      return placeKey && cached ? { placeKey, venues: cached.venues } : null;
    }
  );
  const [failedKey, setFailedKey] = React.useState<string | null>(null);
  const [retries, setRetries] = React.useState(0);

  React.useEffect(() => {
    if (!placeKey) return;
    const [latitude, longitude] = placeKey.split(',').map(Number);
    let active = true;

    fetchArea({ latitude, longitude }, reach).then((outcome) => {
      if (!active) return;
      if (outcome.ok) {
        lastAnswer.set(placeKey, { reach, venues: outcome.venues });
        setLoaded({ placeKey, venues: outcome.venues });
        setFailedKey(null);
      } else {
        setFailedKey(placeKey);
      }
    });

    return () => {
      active = false;
    };
  }, [placeKey, reach, refreshKey, retries]);

  const retry = React.useCallback(() => {
    setFailedKey(null);
    setRetries((count) => count + 1);
  }, []);

  // Another place than the one in state (the map moved to another city):
  // whatever was last loaded for it this session, while it is asked again.
  const venues =
    loaded && loaded.placeKey === placeKey
      ? loaded.venues
      : placeKey
        ? (lastAnswer.get(placeKey)?.venues ?? null)
        : null;

  return {
    venues,
    failed: failedKey !== null && failedKey === placeKey,
    retry,
  };
}

/** One place, ready to draw: its tags narrowed, its distance worked out here. */
export type PlaceRow = {
  venue: NearbyVenue;
  tags: VenueTag[];
  /** From the origin, on the device. Null for an online organisation, or with no origin. */
  distance: number | null;
};

export type ArrangedPlaces = {
  /** Places you can go to, nearest first. */
  nearby: PlaceRow[];
  /** Organisations with no place to visit, by name: none is nearer than another. */
  online: PlaceRow[];
};

/**
 * Venues as two lists: the ones on the map, nearest first, and the online
 * ones. Nearest by the real origin, which the server never had - it ordered
 * them from the middle of a square, and a couple of streets can change places.
 *
 * `within` is the meter's distance in metres: places further than that from
 * the real origin are left out. Omit it for a list with no distance to it (a
 * search by name finds a place wherever it is).
 */
export function arrangePlaces(
  venues: readonly NearbyVenue[],
  origin: Coords | null,
  within?: number
): ArrangedPlaces {
  const nearby: PlaceRow[] = [];
  const online: PlaceRow[] = [];

  for (const venue of venues) {
    const tags = venueTags(venue);
    if (!isMapped(venue)) {
      online.push({ venue, tags, distance: null });
      continue;
    }
    const distance = origin
      ? distanceMeters(origin, { latitude: venue.lat, longitude: venue.lng })
      : null;
    if (within !== undefined && distance !== null && distance > within) continue;
    nearby.push({ venue, tags, distance });
  }

  nearby.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  online.sort((a, b) => a.venue.name.localeCompare(b.venue.name));
  return { nearby, online };
}

/** How many online rows a folded section shows before "Show all". */
const ONLINE_PREVIEW = 3;

/**
 * The online section, folded: in a list of everything around, the places you
 * can go to come first and the organisations with no public address would
 * otherwise run on for screens after them. Shows the first few and a count;
 * one press opens the rest for as long as the screen is open.
 *
 * Never folded when `open` is true: a search (what was asked for is what is
 * shown) or a single kind (somebody who chose Shelter wants every shelter).
 */
export function useOnlineFold(rows: PlaceRow[], open: boolean) {
  const [expanded, setExpanded] = React.useState(false);
  const folded = !open && !expanded && rows.length > ONLINE_PREVIEW + 1;
  return {
    rows: folded ? rows.slice(0, ONLINE_PREVIEW) : rows,
    /** How many there are in all, when folded; null when everything is showing. */
    hiddenOf: folded ? rows.length : null,
    expand: React.useCallback(() => setExpanded(true), []),
  };
}

/**
 * The tag admins set on a place as a warning (20261018100000: it has no
 * questions, on purpose). A warning belongs on the map, where somebody is about
 * to go; the Directory is a list of where to go, and a "Dangerous" kind among
 * the clinics and centres would read as one more thing on offer.
 */
const WARNING_KIND = 'dangerous';

/**
 * The places LavenderBook lists as somewhere to go: tagged, whether or not
 * anyone has reviewed them, and not marked as a warning.
 */
export function listedOnly(venues: readonly NearbyVenue[]): NearbyVenue[] {
  return venues.filter((venue) => {
    const tags = venueTags(venue);
    return tags.length > 0 && !tags.some((tag) => tag.slug === WARNING_KIND);
  });
}

type TagInfo = { description: string | null; sortOrder: number };

let tagInfoRequest: Promise<Map<string, TagInfo>> | null = null;

/**
 * What each tag means and where admins put it in their order. The venue rows
 * carry a tag's label and colours but not these, and both are needed to lay
 * the kinds out: asked for once a session, publicly readable like the tags on
 * the map. A failure is forgotten, so the next screen asks again.
 */
function loadTagInfo(): Promise<Map<string, TagInfo>> {
  tagInfoRequest ??= (async () => {
    const { data, error } = await publicSupabase
      .from('tags')
      .select('slug, description, sort_order')
      .is('archived_at', null);

    if (error || !data) {
      tagInfoRequest = null;
      return new Map<string, TagInfo>();
    }
    return new Map(
      data.map((row) => [row.slug, { description: row.description, sortOrder: row.sort_order }])
    );
  })();
  return tagInfoRequest;
}

const NO_TAG_INFO = new Map<string, TagInfo>();

function useTagInfo(): Map<string, TagInfo> {
  const [info, setInfo] = React.useState(NO_TAG_INFO);

  React.useEffect(() => {
    let active = true;
    loadTagInfo().then((loaded) => {
      if (active) setInfo(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return info;
}

/** A kind of place the Directory can be opened on: a tag, and how many carry it here. */
export type Kind = {
  tag: VenueTag;
  count: number;
  /** What the tag means, in admins' words. Null until it has loaded, or if it has none. */
  description: string | null;
};

/**
 * The kinds of place among `rows`, in the order admins keep the tags in. Only
 * kinds something here carries: a kind that would open on an empty list is not
 * offered. Until the tags' order has loaded they fall back to their labels.
 */
function useKinds(rows: readonly PlaceRow[]): Kind[] {
  const info = useTagInfo();

  return React.useMemo(() => {
    const kinds = new Map<string, Kind>();
    for (const row of rows) {
      for (const tag of row.tags) {
        const kind = kinds.get(tag.slug);
        if (kind) kind.count += 1;
        else {
          kinds.set(tag.slug, {
            tag,
            count: 1,
            description: info.get(tag.slug)?.description ?? null,
          });
        }
      }
    }

    const order = (kind: Kind) => info.get(kind.tag.slug)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return [...kinds.values()].sort(
      (a, b) => order(a) - order(b) || a.tag.label.localeCompare(b.tag.label)
    );
  }, [rows, info]);
}

function ofKind(rows: readonly PlaceRow[], slug: string): PlaceRow[] {
  return rows.filter((row) => row.tags.some((tag) => tag.slug === slug));
}

/**
 * The rows a search finds, best first: by a place's name, its kinds and its
 * description, and by what the words mean - "doctor" finds Affirming
 * healthcare, "food bank" Food & essentials - with small words, accents,
 * plurals and typos taken care of. See @/lib/place-match.
 */
export function matching(rows: readonly PlaceRow[], query: string): PlaceRow[] {
  return matchPlaces(rows, query);
}

export type DirectoryOrigin =
  /** The saved choice has not been read yet, or the phone's position is on its way. */
  | { state: 'loading' }
  /** Nobody has said where to look: offer the choice the map offers. */
  | { state: 'unchosen' }
  | {
      state: 'ready';
      origin: Coords;
      /** Whether `origin` is the phone itself rather than a chosen place or the map. */
      onDevice: boolean;
      /** What to call where `origin` is: "you" (in Ottawa), "Ottawa, Ontario". */
      name: ListPlaceName;
    };

/**
 * Where the Directory looks around: wherever the Map tab's list is - the
 * reader while the map follows them, else the middle of the map, so panning
 * the map to another city moves the Directory there too (@/lib/map-view).
 * Before the map has been shown, or once the location choice has changed
 * since, the place the map would start: the phone, or the city or general
 * area chosen on this device (see @/lib/map-location).
 *
 * Like the map, it never asks the OS for anything: useCurrentLocation only
 * reads a permission that "Near me" was given. A phone whose position cannot
 * be read falls back to the chosen place, as the map does.
 */
function useDirectoryOrigin(): DirectoryOrigin {
  const mapLocation = useMapLocation();
  const location = useCurrentLocation(mapLocation.usingDevice);
  const onDevice =
    mapLocation.usingDevice && location.status !== 'denied' && location.status !== 'error';

  const deviceLatitude = location.status === 'granted' ? location.latitude : null;
  const deviceLongitude = location.status === 'granted' ? location.longitude : null;
  const place = mapLocation.place;
  const mapView = useMapView();
  const fromMap = mapView && mapView.choice === choiceKey(mapLocation) ? mapView : null;

  const where = React.useMemo<Exclude<DirectoryOrigin, { state: 'ready' }> | {
    state: 'ready';
    origin: Coords;
    onDevice: boolean;
  }>(() => {
    if (!mapLocation.ready) return { state: 'loading' };
    if (mapLocation.mode === null) return { state: 'unchosen' };

    if (fromMap) {
      return { state: 'ready', origin: fromMap.origin, onDevice: fromMap.following };
    }

    if (onDevice) {
      return deviceLatitude !== null && deviceLongitude !== null
        ? {
            state: 'ready',
            origin: { latitude: deviceLatitude, longitude: deviceLongitude },
            onDevice: true,
          }
        : { state: 'loading' };
    }

    return place
      ? {
          state: 'ready',
          origin: { latitude: place.latitude, longitude: place.longitude },
          onDevice: false,
        }
      : { state: 'unchosen' };
  }, [mapLocation.ready, mapLocation.mode, fromMap, onDevice, deviceLatitude, deviceLongitude, place]);

  const name = useListPlaceName(
    where.state === 'ready' ? where.origin : null,
    where.state === 'ready' && where.onDevice,
    place
  );
  return React.useMemo<DirectoryOrigin>(
    () => (where.state === 'ready' ? { ...where, name } : where),
    [where, name]
  );
}

/** What the Directory is showing. */
export type DirectoryView =
  /** The kinds of place, to choose from: where it opens. */
  | 'kinds'
  /** The places of one kind, or all of them. */
  | 'places'
  /** What a search found, across every kind. */
  | 'search';

/** Opens every listed place rather than one kind. No tag has this slug: slugs have no colon. */
export const EVERY_KIND = 'kind:every';

/**
 * Everything the Directory tab shows, for every skin: the places LavenderBook
 * lists around the reader, the kinds among them, which kind is open, what a
 * search found, and how far it is looking.
 *
 * It opens on the kinds - "what are you looking for?" - each with what it
 * means and how many places it has, because that is the question somebody new
 * to a city arrives with; one press opens a kind, and "back" returns. Typing a
 * search replaces all of that with what matches, whatever kind was open.
 *
 * Listed places only - tagged ones. A cafe somebody reviewed is on the map and
 * in the list, but the Directory is what we list by kind, and a kind is a tag.
 * The kinds come from the places actually within the meter's distance, so a
 * kind never opens on an empty list; one that is gone after the meter moved,
 * or in another city, drops back to the kinds.
 */
export function useDirectory() {
  const where = useDirectoryOrigin();
  const km = useSearchDistance();
  const [refreshes, setRefreshes] = React.useState(0);
  const [selection, setSelection] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const origin = where.state === 'ready' ? where.origin : null;
  const area = useAreaVenues(origin, km * 1000, String(refreshes));

  const all = React.useMemo(
    () => (area.venues ? arrangePlaces(listedOnly(area.venues), origin, km * 1000) : null),
    [area.venues, origin, km]
  );
  const everyRow = React.useMemo(() => (all ? [...all.nearby, ...all.online] : []), [all]);
  const kinds = useKinds(everyRow);

  const trimmed = query.trim();
  const kind =
    selection !== null && selection !== EVERY_KIND
      ? (kinds.find((entry) => entry.tag.slug === selection) ?? null)
      : null;
  const view: DirectoryView =
    trimmed.length > 0
      ? 'search'
      : selection === EVERY_KIND || kind !== null
        ? 'places'
        : 'kinds';

  const places = React.useMemo<ArrangedPlaces | null>(() => {
    if (!all) return null;
    if (view === 'search') {
      return { nearby: matching(all.nearby, trimmed), online: matching(all.online, trimmed) };
    }
    if (view === 'places' && kind) {
      return { nearby: ofKind(all.nearby, kind.tag.slug), online: ofKind(all.online, kind.tag.slug) };
    }
    return all;
  }, [all, view, kind, trimmed]);

  const refresh = React.useCallback(() => setRefreshes((count) => count + 1), []);
  const back = React.useCallback(() => setSelection(null), []);

  // Android's back steps out of a kind, as it would out of a page, before it
  // leaves the tab. A sheet opened over the Directory registers after this
  // and so is closed first.
  const inKind = view === 'places';
  React.useEffect(() => {
    if (Platform.OS !== 'android' || !inKind) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelection(null);
      return true;
    });
    return () => subscription.remove();
  }, [inKind]);

  return {
    where,
    /** The meter's distance. */
    km,
    view,
    /** False until the first answer for this place has arrived. */
    loaded: all !== null,
    /** Every listed place within the distance, whatever is open. */
    total: everyRow.length,
    kinds,
    /** The kind that is open, or null: for every place, the kinds, or a search. */
    kind,
    /** The places of the open kind, of every kind, or that the search found. Null until loaded. */
    places,
    query,
    setQuery,
    /** The search as it is used: trimmed. */
    searched: trimmed,
    /** Open a kind by its slug, or EVERY_KIND. */
    open: setSelection,
    /** Back to the kinds. */
    back,
    /** Nothing to show and the request failed. */
    failed: area.failed && area.venues === null,
    retry: area.retry,
    refresh,
  };
}

export type Directory = ReturnType<typeof useDirectory>;

/** Marks where the place's name sits in the lead, so it can be drawn apart. */
const PLACE_MARK = '\u0001';

/**
 * What the Directory is a list of, in a sentence - "...near you in Ottawa,
 * Ontario..." - in three parts, so a screen can make the place's name stand
 * out: what comes before it, the name (null when there is none to name: "near
 * you", "around the middle of the map"), and what comes after.
 */
export function directoryLead(directory: Directory): {
  before: string;
  place: string | null;
  after: string;
} {
  const name = directory.where.state === 'ready' ? directory.where.name : null;
  const mark = (label: string) => `${PLACE_MARK}${label}${PLACE_MARK}`;
  const where =
    name === null
      ? DIRECTORY_TEXT.nearYou
      : name.kind === 'you'
        ? name.city
          ? DIRECTORY_TEXT.nearYouIn(mark(name.city))
          : DIRECTORY_TEXT.nearYou
        : name.kind === 'named'
          ? DIRECTORY_TEXT.near(mark(name.label))
          : DIRECTORY_TEXT.mapMiddle;
  const [before, place, after] = DIRECTORY_TEXT.lead(where).split(PLACE_MARK);
  return place === undefined
    ? { before, place: null, after: '' }
    : { before, place, after: after ?? '' };
}
