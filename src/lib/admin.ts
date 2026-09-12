import type { PostgrestError } from '@supabase/supabase-js';
import * as React from 'react';

import { useAuth } from '@/lib/auth';
import type { Database, Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

/**
 * The admin panel's data layer.
 *
 * There is no admin API key, no admin token and no admin edge function here, and
 * that is the point. An admin is an ordinary Supabase Auth user who happens to
 * have a row in `public.admins`; every call below is the same authenticated
 * request any other screen makes, and Postgres decides whether to answer it.
 *
 * So nothing in this file is a security boundary either - it cannot be. Reading
 * `useIsAdmin` and rendering the panel is a decision made on the client, and the
 * client can be made to decide anything. The refusals that count are the
 * `is_admin()` checks at the top of the functions themselves; see
 * supabase/migrations/20260911061500_admin_roles_and_moderation.sql.
 */

/** One row of the users table. */
export type AdminUser = {
  id: string;
  displayName: string;
  createdAt: string;
  /** Null means active. */
  bannedAt: string | null;
  reviewCount: number;
};

export type AdminUserStatus = 'all' | 'active' | 'banned';

/** The sortable columns, matching the whitelist inside admin_list_profiles. */
export type AdminUserSort = 'id' | 'display_name' | 'created_at' | 'review_count';

export type AdminUserQuery = {
  search: string;
  status: AdminUserStatus;
  minReviews: number | null;
  maxReviews: number | null;
  /** ISO timestamp, or null for any time. */
  joinedAfter: string | null;
  sort: AdminUserSort;
  descending: boolean;
  limit: number;
  offset: number;
};

export type AdminUserPage = {
  rows: AdminUser[];
  /** Size of the whole filtered set, not of this page. */
  total: number;
};

/**
 * Turns a Postgres error into something worth showing a person.
 *
 * 42501 is what the `is_admin()` guard raises, and it is the one case where the
 * cause is worth naming: it means the account is signed in and simply is not an
 * admin, which looks identical to a bug unless we say so.
 */
function describe(error: PostgrestError): string {
  if (error.code === '42501') return 'This account is not an administrator.';
  // Everything else these functions raise is already written for a person - "no
  // such tag", "that tag is in use by 3 venue(s) and 1 question(s) - archive it
  // instead". Passing it through beats inventing a second, vaguer vocabulary for
  // the same failure.
  return error.message;
}

/**
 * Whether the signed-in account is an admin.
 *
 * `undefined` while the answer is still in flight, so the panel can tell "not an
 * admin" apart from "we have not asked yet" - showing the refusal during the
 * gap would blame the user for a round trip.
 */
export function useIsAdmin(): { isAdmin: boolean | undefined } {
  const { session } = useAuth();
  const userId = session?.user.id;
  // Stored with the account it is about, so switching users cannot briefly show
  // the previous account's answer while the new one is still being fetched.
  const [answer, setAnswer] = React.useState<{ userId: string; isAdmin: boolean } | null>(null);

  React.useEffect(() => {
    if (!userId) return;

    let active = true;

    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!active) return;
      // An error here is a network failure or a missing grant, never a refusal:
      // the function returns false for a non-admin rather than throwing. Either
      // way the honest answer is no.
      setAnswer({ userId, isAdmin: !error && data === true });
    });

    return () => {
      active = false;
    };
  }, [userId]);

  // Derived rather than stored, so there is no render in which the three states
  // disagree with each other.
  const isAdmin = !userId ? false : answer?.userId === userId ? answer.isAdmin : undefined;

  return { isAdmin };
}

/** Sign in an admin. Ordinary Supabase Auth; the session is the app's own. */
export async function adminSignIn(
  email: string,
  password: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // GoTrue already says "Invalid login credentials" without revealing which
    // half was wrong, and already rate limits. Pass it through rather than
    // inventing a second vocabulary for the same failures.
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

/** One page of profiles, with its review count and the filtered total. */
export async function listAdminUsers(query: AdminUserQuery): Promise<AdminUserPage> {
  const { data, error } = await supabase.rpc('admin_list_profiles', {
    p_search: query.search.trim(),
    p_status: query.status,
    p_min_reviews: query.minReviews ?? undefined,
    p_max_reviews: query.maxReviews ?? undefined,
    p_joined_after: query.joinedAfter ?? undefined,
    p_sort: query.sort,
    p_desc: query.descending,
    p_limit: query.limit,
    p_offset: query.offset,
  });

  if (error) throw new Error(describe(error));

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    createdAt: row.created_at,
    // The generator cannot see that a RETURNS TABLE column is nullable, so it
    // types this as string. It is null for every account that is not banned.
    bannedAt: (row.banned_at as string | null) ?? null,
    reviewCount: Number(row.review_count),
  }));

  // total_count rides on every row, so an empty page is genuinely an empty set.
  return { rows, total: data?.length ? Number(data[0].total_count) : 0 };
}

/** Ban or unban one account. Returns the new banned_at. */
export async function setUserBanned(id: string, banned: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_set_banned', {
    p_user: id,
    p_banned: banned,
  });

  if (error) throw new Error(describe(error));

  return (data as string | null) ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Tags                                                                      */
/* -------------------------------------------------------------------------- */

/** One row of the Tags section. */
export type AdminTag = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  /** #rrggbb. The chip's other three colours are derived from it. */
  color: string;
  /** Null means the text colour is computed. See @/lib/tag-colors. */
  textColor: string | null;
  sortOrder: number;
  archivedAt: string | null;
  /** Both are why a tag can be archived but not deleted. */
  venueCount: number;
  questionCount: number;
};

/** The editable half of a tag. Slug is absent on purpose - see updateTag. */
export type TagDraft = {
  label: string;
  description: string;
  color: string;
  textColor: string | null;
};

export async function listAdminTags(includeArchived = true): Promise<AdminTag[]> {
  const { data, error } = await supabase.rpc('admin_list_tags', {
    p_include_archived: includeArchived,
  });

  if (error) throw new Error(describe(error));

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: (row.description as string | null) ?? null,
    color: row.color,
    textColor: (row.text_color as string | null) ?? null,
    sortOrder: row.sort_order,
    archivedAt: (row.archived_at as string | null) ?? null,
    venueCount: Number(row.venue_count),
    questionCount: Number(row.question_count),
  }));
}

export async function createTag(slug: string, draft: TagDraft): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_tag', {
    p_slug: slug,
    p_label: draft.label,
    p_color: draft.color,
    p_text_color: draft.textColor ?? undefined,
    p_description: draft.description || undefined,
  });

  if (error) throw new Error(describe(error));
  return data as string;
}

/**
 * The slug is not a parameter, and the server will not accept one either.
 *
 * It is the stable handle anything holding a reference keys off, so renaming it
 * breaks those silently. Retire the tag and make a new one instead.
 */
export async function updateTag(id: string, draft: TagDraft): Promise<void> {
  const { error } = await supabase.rpc('admin_update_tag', {
    p_id: id,
    p_label: draft.label,
    p_color: draft.color,
    p_text_color: draft.textColor ?? undefined,
    p_description: draft.description || undefined,
  });

  if (error) throw new Error(describe(error));
}

/** Retires a tag without touching anything that references it. Reversible. */
export async function setTagArchived(id: string, archived: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_set_tag_archived', {
    p_id: id,
    p_archived: archived,
  });

  if (error) throw new Error(describe(error));
  return (data as string | null) ?? null;
}

/** Only succeeds for a tag no venue and no question references. Not reversible. */
export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_tag', { p_id: id });
  if (error) throw new Error(describe(error));
}

export async function reorderTags(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_reorder_tags', { p_ids: ids });
  if (error) throw new Error(describe(error));
}

/* -------------------------------------------------------------------------- */
/*  Custom fields (public.questions)                                          */
/* -------------------------------------------------------------------------- */
//
// "Custom field" in the panel, `questions` in the schema. The two names mean the
// same thing; the tables were not renamed because it is three tables and eleven
// functions of churn for a label.

export type QuestionKind = Database['public']['Enums']['question_kind'];

export type QuestionOption = { id: string; label: string };

/** Just enough of a tag to draw its chip, wherever one is carried. */
export type TagRef = {
  id: string;
  slug: string;
  label: string;
  color: string;
  textColor: string | null;
};

/** One field in the bank. */
export type AdminQuestion = {
  id: string;
  prompt: string;
  helpText: string | null;
  kind: QuestionKind;
  config: Record<string, unknown>;
  required: boolean;
  supersedesId: string | null;
  archivedAt: string | null;
  /** Why a field can be archived but not deleted. */
  answerCount: number;
  options: QuestionOption[];
  /** Empty is legitimate: written, not yet assigned to anything. */
  tags: TagRef[];
};

/** One field as it sits inside a particular tag's questionnaire. */
export type TagQuestion = Omit<AdminQuestion, 'tags' | 'supersedesId' | 'archivedAt'> & {
  /** Position within this tag only. The same field sorts differently elsewhere. */
  sortOrder: number;
};

export type QuestionDraft = {
  prompt: string;
  helpText: string;
  kind: QuestionKind;
  config: Record<string, unknown>;
  required: boolean;
  /** Labels in the order they were typed. Empty for kinds that take no options. */
  options: string[];
};

function toOptions(value: unknown): QuestionOption[] {
  return Array.isArray(value) ? (value as QuestionOption[]) : [];
}

function toConfig(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export async function listAdminQuestions(
  search = '',
  includeArchived = false
): Promise<AdminQuestion[]> {
  const { data, error } = await supabase.rpc('admin_list_questions', {
    p_search: search.trim() || undefined,
    p_include_archived: includeArchived,
  });

  if (error) throw new Error(describe(error));

  return (data ?? []).map((row) => ({
    id: row.id,
    prompt: row.prompt,
    helpText: (row.help_text as string | null) ?? null,
    kind: row.kind,
    config: toConfig(row.config),
    required: row.required,
    supersedesId: (row.supersedes_id as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    answerCount: Number(row.answer_count),
    options: toOptions(row.options),
    // The generator types every jsonb column as Json, which includes null, so
    // each entry is narrowed rather than asserted wholesale.
    tags: (Array.isArray(row.tags) ? row.tags : []).map((entry) => {
      const tag = (entry ?? {}) as Record<string, unknown>;
      return {
        id: tag.id as string,
        slug: tag.slug as string,
        label: tag.label as string,
        color: tag.color as string,
        textColor: (tag.text_color as string | null) ?? null,
      };
    }),
  }));
}

export async function listTagQuestions(tagId: string): Promise<TagQuestion[]> {
  const { data, error } = await supabase.rpc('admin_list_tag_questions', { p_tag_id: tagId });

  if (error) throw new Error(describe(error));

  return (data ?? []).map((row) => ({
    id: row.id,
    prompt: row.prompt,
    helpText: (row.help_text as string | null) ?? null,
    kind: row.kind,
    config: toConfig(row.config),
    required: row.required,
    sortOrder: row.sort_order,
    answerCount: Number(row.answer_count),
    options: toOptions(row.options),
  }));
}

export async function createQuestion(draft: QuestionDraft, tagIds: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_question', {
    p_prompt: draft.prompt,
    p_kind: draft.kind,
    p_config: draft.config as Json,
    p_required: draft.required,
    p_help_text: draft.helpText || undefined,
    p_options: draft.options.length > 0 ? draft.options : undefined,
    p_tag_ids: tagIds.length > 0 ? tagIds : undefined,
  });

  if (error) throw new Error(describe(error));
  return data as string;
}

/**
 * Rewords a field, or supersedes it.
 *
 * **Returns a different id when the field has been answered.** The old wording is
 * not ours to change once someone has answered under it, so an answered field is
 * archived and a successor created. Use the returned id; do not assume the one
 * you passed in is still the live field.
 */
export async function reviseQuestion(id: string, draft: QuestionDraft): Promise<string> {
  const { data, error } = await supabase.rpc('admin_revise_question', {
    p_question_id: id,
    p_prompt: draft.prompt,
    p_kind: draft.kind,
    p_config: draft.config as Json,
    p_required: draft.required,
    p_help_text: draft.helpText || undefined,
    p_options: draft.options.length > 0 ? draft.options : undefined,
  });

  if (error) throw new Error(describe(error));
  return data as string;
}

/** Replaces the set of tags a field belongs to. */
export async function setQuestionTags(questionId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_set_question_tags', {
    p_question_id: questionId,
    p_tag_ids: tagIds,
  });
  if (error) throw new Error(describe(error));
}

/** Adds fields to one tag, keeping what it already has. */
export async function assignQuestions(tagId: string, questionIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_assign_questions', {
    p_tag_id: tagId,
    p_question_ids: questionIds,
  });
  if (error) throw new Error(describe(error));
}

/** Removes a field from one tag. The field itself, and its answers, survive. */
export async function unassignQuestion(tagId: string, questionId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_unassign_question', {
    p_tag_id: tagId,
    p_question_id: questionId,
  });
  if (error) throw new Error(describe(error));
}

/** Reorders within one tag. Other tags holding the same field are untouched. */
export async function reorderQuestions(tagId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_reorder_questions', {
    p_tag_id: tagId,
    p_ids: ids,
  });
  if (error) throw new Error(describe(error));
}

export async function setQuestionArchived(id: string, archived: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc('admin_set_question_archived', {
    p_id: id,
    p_archived: archived,
  });
  if (error) throw new Error(describe(error));
  return (data as string | null) ?? null;
}

/** Only succeeds for a field nobody has answered. Not reversible. */
export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_question', { p_id: id });
  if (error) throw new Error(describe(error));
}

/* -------------------------------------------------------------------------- */
/*  Places (public.venues) and their notes                                    */
/* -------------------------------------------------------------------------- */

/** One row of the Places list. */
export type AdminVenue = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  createdAt: string;
  reviewCount: number;
  avgStars: number | null;
  noteCount: number;
  tags: TagRef[];
  /**
   * Whether the map would actually show this place: it has coordinates, and it
   * is either reviewed or tagged. Computed in SQL by the same predicate
   * venues_near applies, so the panel cannot claim something the map disagrees
   * with. See venue_is_on_map.
   */
  onMap: boolean;
};

export type VenueTagState = 'any' | 'tagged' | 'untagged';
export type VenueHas = 'any' | 'with' | 'without';
export type VenueVisibility = 'any' | 'on' | 'off';
export type VenueSort = 'name' | 'created_at' | 'review_count' | 'note_count';

export type VenueQuery = {
  search: string;
  /** A specific tag, or null for no tag filter. */
  tagId: string | null;
  tagState: VenueTagState;
  notes: VenueHas;
  reviews: VenueHas;
  visibility: VenueVisibility;
  sort: VenueSort;
  descending: boolean;
  limit: number;
  offset: number;
};

export type AdminVenuePage = {
  rows: AdminVenue[];
  /** Size of the whole filtered set, not of this page. */
  total: number;
};

/** A bullet point about one venue. Admin-written, freely editable. */
export type VenueNote = {
  id: string;
  body: string;
  sortOrder: number;
  updatedAt: string;
  /** Who last touched it - these are statements we make in our own voice. */
  updatedBy: string | null;
};

export async function listAdminVenues(query: VenueQuery): Promise<AdminVenuePage> {
  const { data, error } = await supabase.rpc('admin_list_venues', {
    p_search: query.search.trim() || undefined,
    p_tag_id: query.tagId ?? undefined,
    p_tag_state: query.tagState,
    p_notes: query.notes,
    p_reviews: query.reviews,
    p_visibility: query.visibility,
    p_sort: query.sort,
    p_desc: query.descending,
    p_limit: query.limit,
    p_offset: query.offset,
  });

  if (error) throw new Error(describe(error));

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    address: (row.address as string | null) ?? null,
    lat: (row.lat as number | null) ?? null,
    lng: (row.lng as number | null) ?? null,
    googlePlaceId: (row.google_place_id as string | null) ?? null,
    createdAt: row.created_at,
    reviewCount: Number(row.review_count),
    avgStars: row.avg_stars === null ? null : Number(row.avg_stars),
    noteCount: Number(row.note_count),
    onMap: row.on_map,
    tags: (Array.isArray(row.tags) ? row.tags : []).map((entry) => {
      const tag = (entry ?? {}) as Record<string, unknown>;
      return {
        id: tag.id as string,
        slug: tag.slug as string,
        label: tag.label as string,
        color: tag.color as string,
        textColor: (tag.text_color as string | null) ?? null,
      };
    }),
  }));

  // total_count rides on every row, so an empty page is genuinely an empty set.
  return { rows, total: data?.length ? Number(data[0].total_count) : 0 };
}

/**
 * Add a place, or fold into the one we already hold for it.
 *
 * `created` is false when the place was already known - usually because someone
 * reviewed it - and the panel says so rather than pretending it made something.
 * Tags are added to whatever the venue already carries, never replacing them.
 */
export async function upsertVenue(
  place: {
    name: string;
    googlePlaceId: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  },
  tagIds: string[]
): Promise<{ venueId: string; created: boolean }> {
  const { data, error } = await supabase.rpc('admin_upsert_venue', {
    p_name: place.name,
    p_google_place_id: place.googlePlaceId ?? undefined,
    p_address: place.address ?? undefined,
    p_lat: place.lat ?? undefined,
    p_lng: place.lng ?? undefined,
    p_tag_ids: tagIds.length > 0 ? tagIds : undefined,
  });

  if (error) throw new Error(describe(error));

  const row = (data ?? [])[0];
  return { venueId: row.venue_id, created: row.created };
}

/**
 * Delete a place. Refuses when anyone has reviewed it.
 *
 * reviews.venue_id cascades, so without that refusal this would quietly destroy
 * other people's accounts of whether somewhere was safe.
 */
export async function deleteVenue(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_venue', { p_id: id });
  if (error) throw new Error(describe(error));
}

export async function listVenueNotes(venueId: string): Promise<VenueNote[]> {
  const { data, error } = await supabase.rpc('admin_list_venue_notes', { p_venue_id: venueId });
  if (error) throw new Error(describe(error));

  return (data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
    updatedBy: (row.updated_by as string | null) ?? null,
  }));
}

export async function createVenueNote(venueId: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_venue_note', {
    p_venue_id: venueId,
    p_body: body,
  });
  if (error) throw new Error(describe(error));
  return data as string;
}

export async function updateVenueNote(id: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('admin_update_venue_note', { p_id: id, p_body: body });
  if (error) throw new Error(describe(error));
}

export async function deleteVenueNote(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_venue_note', { p_id: id });
  if (error) throw new Error(describe(error));
}

export async function reorderVenueNotes(venueId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_reorder_venue_notes', {
    p_venue_id: venueId,
    p_ids: ids,
  });
  if (error) throw new Error(describe(error));
}

/**
 * Replaces the set of tags a place carries.
 *
 * Removing the last tag from a place nobody has reviewed takes it off the map:
 * venues_near only draws somewhere reviewed or tagged. The panel warns before
 * saving that, because nothing else would.
 */
export async function setVenueTags(venueId: string, tagIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_set_venue_tags', {
    p_venue_id: venueId,
    p_tag_ids: tagIds,
  });
  if (error) throw new Error(describe(error));
}
