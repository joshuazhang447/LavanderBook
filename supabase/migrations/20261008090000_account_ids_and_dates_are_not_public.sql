-- Account ids and account dates leave the public API.
--
-- Until now anyone holding the anon key - which ships inside the app, so
-- anyone at all - could list every account:
--
--   GET /rest/v1/profiles?select=*        every id, sign-up time and ban time
--   GET /rest/v1/reviews?select=author_id the same id, on every review
--
-- and the admin-attribution columns (tags.created_by, venue_tags.added_by,
-- questions.created_by, question_tags.assigned_by, venue_notes.created_by and
-- updated_by, reviews.admin_edited_by) named the admin account behind every
-- tag, note and moderation edit. None of it is a credential. But none of it is
-- needed by anyone except the account itself and the admins, and an id that is
-- never handed out is one nobody can enumerate, correlate or build on.
--
-- Two mechanisms, chosen by what each table's public read still has to do:
--
--   profiles     RLS. An account reads its own row and nobody else's. The app
--                only ever shows someone else's display name beside their
--                review or their answer, and both now arrive through a
--                function that joins the name in server-side.
--   the others   Column grants. The rows stay public - venue_ratings,
--                venues_near and the realtime feed all read reviews as the
--                caller - but the account columns are no longer granted.
--                Postgres checks a column grant on every route into the
--                table, and realtime leaves columns the subscriber cannot
--                select out of the events it sends, so there is no side door.
--
-- Admins lose nothing. Every admin read is a security definer function running
-- as the table owner, which no grant here reaches.
--
-- WHAT IT COSTS, for whoever touches these tables next:
--
--   * A column grant is an allowlist. A column added later to reviews, tags,
--     venue_tags, questions, question_tags or venue_notes is private until it
--     is added to that table's grant below.
--   * select=* on those tables now fails outright: Postgres refuses a query
--     that touches any ungranted column rather than returning less. Name the
--     columns.
--   * Nothing on the client can filter or embed through author_id any more.
--     The venue sheet's list comes from venue_reviews(), the caller's own
--     reviews from my_reviews() and delete_my_review(), and
--     my_new_question_count becomes security definer for the same reason.


-- ---------------------------------------------------------------------------
-- venue_reviews - the venue sheet's list
-- ---------------------------------------------------------------------------

-- What the sheet used to get by embedding profiles through author_id: the
-- author's display name, joined here, and whether the review is the caller's,
-- decided here. Definer because author_id is exactly the column the caller can
-- no longer read.
--
-- Every review, banned author or not, newest first - the same rows the public
-- SELECT policy shows, which a ban deliberately does not touch.
create or replace function public.venue_reviews(p_venue_id uuid)
returns table (
  id          uuid,
  stars       smallint,
  body        text,
  author_name text,
  is_mine     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.stars,
    r.body,
    p.display_name,
    -- auth.uid() is null for a signed-out caller, and false is the honest
    -- answer to "is this yours" there.
    coalesce(r.author_id = (select auth.uid()), false)
  from public.reviews r
  left join public.profiles p on p.id = r.author_id
  where r.venue_id = p_venue_id
  order by r.created_at desc, r.id desc;
$$;

comment on function public.venue_reviews(uuid) is
  'Every review of one venue, newest first, with the author''s display name and whether it is the caller''s own - in place of author_id, which is not public.';


-- ---------------------------------------------------------------------------
-- my_reviews / delete_my_review - the caller's own
-- ---------------------------------------------------------------------------

-- The account tab's list, and the review sheet's "do I already have one here".
-- The venue rides along because PostgREST cannot embed venues on a function
-- that returns a bare table, and the list needs its name and position.
--
-- admin_edited_by is deliberately not a column: it names the admin who edited
-- the review, which is no more the author's business than anyone else's.
create or replace function public.my_reviews()
returns table (
  id                    uuid,
  venue_id              uuid,
  stars                 smallint,
  trans_bathroom        public.answer,
  body                  text,
  updated_at            timestamptz,
  venue_name            text,
  venue_lat             double precision,
  venue_lng             double precision,
  venue_google_place_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    r.venue_id,
    r.stars,
    r.trans_bathroom,
    r.body,
    r.updated_at,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id
  from public.reviews r
  join public.venues v on v.id = r.venue_id
  where r.author_id = (select auth.uid())
  order by r.updated_at desc, r.id desc;
$$;

comment on function public.my_reviews() is
  'The caller''s own reviews with the venue each is about, most recently saved first. Empty for a caller with no reviews; not callable signed out.';

-- The review sheet's Delete. Scoped to the caller here, in the WHERE, rather
-- than left to the DELETE policy - the client used to say author_id itself and
-- can no longer name the column.
--
-- Not gated on a ban, like the DELETE policy: removing your own words is not
-- something a ban should prevent.
create or replace function public.delete_my_review(p_venue_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.reviews r
  where r.venue_id = p_venue_id
    and r.author_id = (select auth.uid());
$$;

comment on function public.delete_my_review(uuid) is
  'Deletes the caller''s review of one venue, and with it their answers. A no-op when they have none there.';


-- ---------------------------------------------------------------------------
-- my_new_question_count becomes definer
-- ---------------------------------------------------------------------------

-- It finds the caller's review by author_id, which the caller can no longer
-- select. The body is untouched and was already scoped to auth.uid(). As
-- definer it skips the tags and questions policies, whose only effect - hiding
-- archived rows from non-admins - it already applies itself.
alter function public.my_new_question_count(uuid) security definer;

comment on function public.my_new_question_count(uuid) is
  'How many of a venue''s questions the caller has never been shown: added to the venue after their review was last saved, and unanswered. Saving clears it whether or not they answer - skipping an optional question is not something to nag about. Security definer because it finds the caller''s review by author_id, which the caller cannot select.';


-- ---------------------------------------------------------------------------
-- profiles - its own account only
-- ---------------------------------------------------------------------------

drop policy "Profiles are readable by everyone" on public.profiles;

-- auth.tsx reads the caller's own row to show their display name. That is the
-- only read of this table the app still makes.
create policy "A profile is readable by its own account"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- A signed-out caller has no profile, so it loses the table altogether.
revoke select on public.profiles from anon;

comment on table public.profiles is
  'An account''s generated display name. Readable only by the account itself: anyone else sees a display name only beside a review or an answer, joined in server-side by venue_reviews and venue_answer_summary, and admins read the rest through admin_list_profiles. Email and identity stay in auth.users.';

comment on column public.profiles.banned_at is
  'Null means active. Readable by the account itself and, through admin_list_profiles, by admins - nobody else needs to know who is banned, or since when.';


-- ---------------------------------------------------------------------------
-- reviews - everything but who wrote it and who edited it
-- ---------------------------------------------------------------------------

-- revoke-then-grant, because a table-level SELECT covers every column and a
-- column grant underneath it would change nothing. admin_edited_at stays: it is
-- a fact about the review, not about an account.
revoke select on public.reviews from anon, authenticated;
grant select (id, venue_id, stars, trans_bathroom, body, created_at, updated_at, admin_edited_at)
  on public.reviews to anon, authenticated;

comment on column public.reviews.author_id is
  'Not granted to anon or authenticated. The caller''s own reviews come from my_reviews(); everyone else''s from venue_reviews(), which carries the author''s display name and an is_mine flag instead of this id.';

-- Restated without its old comparison to banned_at, which is no longer public.
comment on column public.reviews.admin_edited_at is
  'When an administrator last edited this review through the panel. Readable by everyone: reviews_set_updated_at bumps updated_at on an admin edit exactly as it does on the author''s own, so without this column an edit by someone else is indistinguishable from the author editing their own words. Which admin it was (admin_edited_by) is not public.';


-- ---------------------------------------------------------------------------
-- Admin attribution
-- ---------------------------------------------------------------------------

-- Which admin made or changed something is the panel's business, and the panel
-- reads it through definer functions. Every other column stays exactly as
-- public as it was.

revoke select on public.tags from anon, authenticated;
grant select (id, slug, label, description, color, text_color, sort_order, archived_at, created_at)
  on public.tags to anon, authenticated;

revoke select on public.venue_tags from anon, authenticated;
grant select (venue_id, tag_id, added_at)
  on public.venue_tags to anon, authenticated;

revoke select on public.questions from anon, authenticated;
grant select (id, prompt, help_text, kind, config, required, supersedes_id, archived_at, created_at)
  on public.questions to anon, authenticated;

revoke select on public.question_tags from anon, authenticated;
grant select (question_id, tag_id, sort_order, assigned_at)
  on public.question_tags to anon, authenticated;

revoke select on public.venue_notes from anon, authenticated;
grant select (id, venue_id, body, sort_order, created_at, updated_at)
  on public.venue_notes to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon.
revoke execute on function public.venue_reviews(uuid)    from public;
revoke execute on function public.my_reviews()           from public;
revoke execute on function public.delete_my_review(uuid) from public;

-- Anyone reading a venue needs its reviews, signed in or not.
grant execute on function public.venue_reviews(uuid)    to anon, authenticated;
grant execute on function public.my_reviews()           to authenticated;
grant execute on function public.delete_my_review(uuid) to authenticated;
