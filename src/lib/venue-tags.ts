import type { NearbyVenue } from '@/lib/use-nearby-venues';

/**
 * A tag on a venue, as the map functions hand it over.
 *
 * `venues_near` and `venues_search` build these with jsonb_build_object, so the
 * column is jsonb and what arrives is whatever the database put there. The slug
 * is the stable identity - labels are editable prose.
 */
export type VenueTag = {
  slug: string;
  label: string;
  /** #rrggbb as an admin stored it. */
  color: string;
  /** Null means the text colour is computed from the background. */
  textColor: string | null;
};

/** Neutral grey, for a tag stored with a colour we cannot read. */
const FALLBACK_COLOR = '#E5E5E5';

/**
 * The tags on a venue, narrowed once rather than in each place that draws them.
 *
 * A tag missing its slug or label is dropped rather than rendered blank: this
 * comes back as untyped jsonb, and a chip with no words in it is worse than no
 * chip at all.
 */
export function venueTags(venue: Pick<NearbyVenue, 'tags'>): VenueTag[] {
  const rows = Array.isArray(venue.tags) ? venue.tags : [];

  return rows.flatMap((row) => {
    const tag = row as Record<string, unknown> | null;
    if (typeof tag?.slug !== 'string' || typeof tag.label !== 'string') return [];

    return [
      {
        slug: tag.slug,
        label: tag.label,
        color: typeof tag.color === 'string' ? tag.color : FALLBACK_COLOR,
        textColor: typeof tag.text_color === 'string' ? tag.text_color : null,
      },
    ];
  });
}
