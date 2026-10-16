-- Reviews are written only through functions.
--
-- 20261009120000 narrowed authenticated's INSERT and UPDATE on reviews to the
-- author's own columns, and kept them as "the direct routes the reviews
-- policies still allow". Nothing takes those routes. The app writes through
-- submit_review and delete_my_review, the panel through admin_update_review
-- and admin_delete_review, and the per-place names switch through
-- set_per_place_names - all security definer, none of them touched by a grant.
--
-- They go now because the next migrations put a word list in front of every
-- review, and the list is applied in submit_review. A direct INSERT or UPDATE
-- would be the way around it: the same words, written straight into the table
-- and pushed to every open map by realtime before anyone had read them. With
-- the grants gone, submit_review is the only way in for an author, as it
-- already is for review_answers.
--
-- DELETE stays. Removing your own words needs no screening, and a ban was never
-- meant to stop it (20260911061500).
--
-- Venues get a lighter version of the same treatment. The app inserts a place
-- straight from the map (src/lib/review-form.ts), and installed builds will go
-- on doing so for as long as they are installed, so the route stays open. What
-- changes:
--
--   * a banned account can no longer add places. It could not review them, and
--     a place with nothing on it is still a name on the map's search;
--   * INSERT names the five columns the app sends, so nothing else - address,
--     created_at, or the pending_name column 20261016100300 adds - can arrive
--     from a client.


-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

-- Revoking a table privilege revokes its column grants with it, so this takes
-- the column grants of 20261009120000 too.
revoke insert, update on public.reviews from authenticated;

-- Policies that no grant reaches any more. Left in place they would read as a
-- route that still exists.
drop policy "Authors can create their own review" on public.reviews;
drop policy "Authors can edit their own review" on public.reviews;

comment on table public.reviews is
  'One review per author per venue. Written only by security definer functions: submit_review for authors (which screens the words first), admin_update_review and the admin_decide_* functions for the panel, set_per_place_names for aliases. authenticated has SELECT on some columns and DELETE on its own rows, and no INSERT or UPDATE: a grant here would be a way around the word list.';


-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------

-- is_banned is executable by authenticated, and this policy applies to nobody
-- else, so every role it is evaluated for can evaluate it (20260911200000).
drop policy "Signed-in users can add a venue" on public.venues;
create policy "Signed-in users can add a venue"
  on public.venues for insert
  to authenticated
  with check (not public.is_banned((select auth.uid())));

-- Exactly what review-form.ts sends. RETURNING id still works: id is in the
-- SELECT grant.
revoke insert on public.venues from authenticated;
grant insert (google_place_id, name, lat, lng, last_synced_at)
  on public.venues to authenticated;
