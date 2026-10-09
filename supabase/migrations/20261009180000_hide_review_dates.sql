-- Hidden dates: no exact review time leaves the database, and by default a
-- review shows only roughly when it was posted.
--
-- Location data is bought and sold. Weather and shopping apps, ad networks and
-- phone companies record where a phone was and when. A review stamped "posted
-- Friday 23:14" at a bar can be matched against that and narrowed to the few
-- phones that were there - no account, no name and no hacking needed, only the
-- public review list and a dataset anyone can buy.
--
-- Until now the public API carried those times to the microsecond, whatever
-- the app chose to show, and kept them readable forever after:
--
--   reviews.created_at, updated_at     granted to anon in 20261008090000, and
--                                      so also inside every realtime event
--   review_answers.answered_at         the whole table was granted, and
--                                      venue_answer_summary repeated it
--   venues.created_at, last_synced_at  a place nobody had listed is created by
--                                      the app the moment it is first reviewed,
--                                      so these were that review's time
--
-- All of them are gone from public view. Times stay in the database for the
-- panel, which reads them through definer functions as it always has, and is
-- the only place an exact time can be seen.
--
-- What readers get instead, per review:
--
--   hide_date = true (the default)  a period: recent, a few weeks, a few
--                                   months, over six months, over a year
--   hide_date = false               the day it was posted, in UTC. Never the
--                                   time of day, either way.
--
-- Two details carry the weight, because a rough label can still leak the time:
--
--   * Periods are counted in whole UTC weeks, Monday to Monday, never from the
--     exact time. A label worked out from the exact time flips at an exact
--     moment - "recent" turning into "a few weeks ago" 336 hours after posting
--     - and anyone checking every minute would read the posting time off the
--     flip. Counted in weeks, every review from the same week flips together
--     at Monday 00:00 UTC, and the most a patient watcher learns is the week.
--   * Lists are ordered by that week, then by review id, which is random. Kept
--     newest first, a hidden-date review sitting between one dated Sep 3 and
--     one dated Sep 5 would have been posted between those days. The same
--     goes for the free-text quotes and the newest review a map marker shows.
--
-- The switch is profiles.hide_dates, set through set_hide_dates(). A review's
-- setting is decided when it is posted, by the author's switch and nobody's
-- argument, and is never changed afterwards - in either direction:
--
--   * Turning it off cannot show the date of a review posted while it was on.
--     That would publish exactly what hiding it kept back.
--   * Turning it on does not hide the dates of reviews already showing one.
--     This is where it differs from per-place names, and on purpose. Hiding
--     them would change several of one author's reviews at the same moment -
--     pushed live to every map by realtime, and visible to anyone comparing
--     two snapshots - and reviews that change together are reviews by the
--     same person. With per-place names on, that link is the one thing the
--     aliases exist to prevent. (The per-place names sweep does not have this
--     problem: the reviews it renames all showed the same account name, so
--     they were already linked.) Every review posted before this migration is
--     hidden by it, all at once, for every author alike, which links nobody.
--
-- What this cannot do. A review still appears the moment it is posted - the
-- map updates live, by design, and the realtime event that drives it is sent
-- when the review is committed. Anyone watching can note when a new one shows
-- up, and no label can take that back. The account tab says so, and suggests
-- posting after leaving rather than while there. What is gone is the record:
-- once the moment has passed, nothing public says when a review was written.
--
-- Costs, for whoever touches this next:
--
--   * reviews, review_answers and venues are now column grants. select=* on
--     any of them fails; name the columns. A column added to one of them later
--     is private until it is granted.
--   * venues_near and venues_search no longer return latest_review_at. Nothing
--     read it.


-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column hide_dates boolean not null default true;

comment on column public.profiles.hide_dates is
  'When true, each review this account posts from then on shows readers only a rough period instead of its date (reviews.hide_date). Changing it never changes a review already posted. Readable only by the account itself. Changed through set_hide_dates(), never directly.';

-- Default true: every review already posted is hidden, because every account
-- starts with the switch on - the same reasoning as the alias backfill, and
-- safe for the reason in the header: it happens to everyone at once.
alter table public.reviews
  add column hide_date boolean not null default true;

-- Not granted, like alias: readers get the result through venue_reviews().
comment on column public.reviews.hide_date is
  'When true, readers see only the period this review was posted in (posting_period); when false, the day (UTC). Never the time. Set from the author''s profiles.hide_dates when the review is first posted, and never changed afterwards: see the header of 20261009180000.';

comment on column public.reviews.created_at is
  'Exact. Not granted to anon or authenticated: readers get posting_period() or, when hide_date is false, the UTC day, through venue_reviews(). Admins read it through admin_list_reviews().';

comment on column public.reviews.updated_at is
  'Exact. Not granted to anon or authenticated. The author reads their own through my_reviews(), admins through admin_list_reviews().';


-- ---------------------------------------------------------------------------
-- Weeks and periods
-- ---------------------------------------------------------------------------

-- The week a moment falls in, as the Monday that starts it, in UTC. UTC rather
-- than any one reader's zone: it has to be the same for everyone, or two
-- readers in different zones would see a review change period at different
-- moments and the gap between them would say something.
create or replace function public.posting_week(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('week', p_at at time zone 'UTC')::date;
$$;

comment on function public.posting_week(timestamptz) is
  'The Monday (UTC) starting the week p_at falls in. Every public sense of "when" for a review is counted in these weeks, so anything worked out from it changes for a whole week''s reviews at once.';

-- Whole weeks back from this week, so a review moves from one period to the
-- next only at Monday 00:00 UTC, together with everything posted that week.
--
--   0-1 weeks back    recent        this week or last
--   2-4               weeks
--   5-25              months
--   26-51             half_year
--   52 and more       year
create or replace function public.posting_period(p_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when w.weeks_back <= 1  then 'recent'
    when w.weeks_back <= 4  then 'weeks'
    when w.weeks_back <= 25 then 'months'
    when w.weeks_back <= 51 then 'half_year'
    else 'year'
  end
  from (
    -- date - date is a whole number of days; both are Mondays, so this divides.
    select (public.posting_week(now()) - public.posting_week(p_at)) / 7 as weeks_back
  ) w;
$$;

comment on function public.posting_period(timestamptz) is
  'How long ago p_at was, as one of recent | weeks | months | half_year | year, counted in whole UTC weeks so that it changes only at Monday 00:00 UTC.';


-- ---------------------------------------------------------------------------
-- The author's settings, applied when a review is posted
-- ---------------------------------------------------------------------------

-- reviews_assign_alias grows a second job, and gets a name that says so. One
-- trigger reading the profile once, under one lock, rather than two triggers
-- each racing the author's two switches separately.
drop trigger if exists reviews_assign_alias on public.reviews;
drop function if exists public.reviews_assign_alias();

create or replace function public.reviews_apply_author_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per_place  boolean;
  v_hide_dates boolean;
begin
  -- FOR SHARE so this cannot interleave with set_per_place_names(), which
  -- updates the profile row before it renames the author's reviews: either it
  -- waits for this review to commit (and then renames it too), or this waits
  -- for it (and reads its new value). Without it, a review posted while the
  -- switch was being turned on could land after the sweep, still under the
  -- account name. set_hide_dates() sweeps nothing, so for the date this only
  -- means a review takes the switch as it stood when the review was posted.
  select p.per_place_names, p.hide_dates
    into v_per_place, v_hide_dates
  from public.profiles p
  where p.id = new.author_id
  for share;

  -- Both overwrite whatever the caller sent. No profile means the foreign key
  -- is about to refuse the row; if it somehow did not, protect by default.
  new.alias := case
    when coalesce(v_per_place, true) then public.generate_display_name()
  end;
  new.hide_date := coalesce(v_hide_dates, true);

  return new;
end;
$$;

comment on function public.reviews_apply_author_privacy() is
  'BEFORE INSERT on reviews: applies the author''s privacy switches to the new review - draws its alias when per-place names are on, and hides its date when hidden dates are on - overwriting anything the caller supplied.';

-- Also fires, and draws a name it then throws away, on submit_review's upsert
-- of a review that already exists; see 20261009120000 for why that is left so.
create trigger reviews_apply_author_privacy
  before insert on public.reviews
  for each row execute function public.reviews_apply_author_privacy();

-- Restated only because it named the trigger this replaces.
comment on column public.reviews.alias is
  'The name this review is shown under in place of its author''s display name. Null means it is shown under the display name. Set once, server-side, when the review is first posted (reviews_apply_author_privacy) or when its author turns per-place names on; an edit keeps it. Not granted to anon or authenticated: venue_reviews() and venue_answer_summary() show it, admin_list_reviews() shows it beside the account.';

-- Nothing to grant for writes: the INSERT and UPDATE column grants from
-- 20261009120000 are an allowlist, and hide_date is not on it.


-- ---------------------------------------------------------------------------
-- set_hide_dates - the account tab's switch
-- ---------------------------------------------------------------------------

-- A function rather than an UPDATE grant on profiles, as set_per_place_names
-- is, and not gated on a ban. Unlike it, this sweeps nothing in either
-- direction: see the header for why turning it on must not touch reviews
-- already posted.
create or replace function public.set_hide_dates(p_enabled boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Sign in to change this.' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'Choose on or off.' using errcode = '22023';
  end if;

  update public.profiles p
  set hide_dates = p_enabled
  where p.id = v_uid;

  if not found then
    raise exception 'no such profile' using errcode = 'P0002';
  end if;

  return p_enabled;
end;
$$;

comment on function public.set_hide_dates(boolean) is
  'Turns the caller''s hidden dates on or off for reviews they post afterwards, and returns the new setting. Never changes a review already posted.';


-- ---------------------------------------------------------------------------
-- Read grants - no exact times
-- ---------------------------------------------------------------------------

-- revoke-then-grant, as in 20261008090000. Revoking SELECT on a table revokes
-- its column grants with it, so each list below is the whole of what the
-- public may read.

-- admin_edited_at stays. It is when a moderator acted, which says nothing
-- about when the author was anywhere, and it is what keeps an admin's edit
-- from passing as the author's own.
revoke select on public.reviews from anon, authenticated;
grant select (id, venue_id, stars, trans_bathroom, body, admin_edited_at)
  on public.reviews to anon, authenticated;

-- answered_at is the moment the review was saved, by another name.
-- fetchMyAnswers already names its columns and never asked for it.
revoke select on public.review_answers from anon, authenticated;
grant select (review_id, question_id, value_text, value_number, value_bool, value_answer, value_option_ids)
  on public.review_answers to anon, authenticated;

comment on column public.review_answers.answered_at is
  'Exact. Not granted to anon or authenticated - it is the time the review was saved. Admins read it through admin_review_answers().';

-- The app reads id, name, lat and lng here and nothing else.
revoke select on public.venues from anon, authenticated;
grant select (id, google_place_id, name, address, lat, lng)
  on public.venues to anon, authenticated;

comment on column public.venues.created_at is
  'Not granted to anon or authenticated: for a place first added by a reviewer, it is the time of that first review.';

comment on column public.venues.last_synced_at is
  'Not granted to anon or authenticated, for the same reason as created_at - the app sets it when a reviewer adds the place.';


-- ---------------------------------------------------------------------------
-- What the public sees
-- ---------------------------------------------------------------------------

-- Dropped rather than replaced: two new columns change the return type.
drop function if exists public.venue_reviews(uuid);

create function public.venue_reviews(p_venue_id uuid)
returns table (
  id            uuid,
  stars         smallint,
  body          text,
  author_name   text,
  is_mine       boolean,
  -- recent | weeks | months | half_year | year. Always set.
  posted_period text,
  -- The UTC day it was posted, when its author shows dates. Null otherwise.
  posted_on     date
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
    coalesce(r.alias, p.display_name),
    -- auth.uid() is null for a signed-out caller, and false is the honest
    -- answer to "is this yours" there.
    coalesce(r.author_id = (select auth.uid()), false),
    public.posting_period(r.created_at),
    case when not r.hide_date then (r.created_at at time zone 'UTC')::date end
  from public.reviews r
  left join public.profiles p on p.id = r.author_id
  where r.venue_id = p_venue_id
  -- The week, then the id, which is random: within a week the order says
  -- nothing about who posted first. See the header.
  order by public.posting_week(r.created_at) desc, r.id;
$$;

comment on function public.venue_reviews(uuid) is
  'Every review of one venue, newest week first and in no meaningful order within a week, with the name it is shown under, whether it is the caller''s own, its posting period, and its UTC posting day when its author shows dates. Never an exact time.';

-- Free-text quotes: the latest few by week, not by the second, and without
-- answered_at. Installed clients used answered_at only as a list key and fall
-- back to the index. Same signature and return type, so a replace.
create or replace function public.venue_answer_summary(p_venue_id uuid)
returns table (
  question_id      uuid,
  prompt           text,
  help_text        text,
  kind             public.question_kind,
  config           jsonb,
  options          jsonb,
  archived         boolean,
  tag_id           uuid,
  tag_slug         text,
  tag_label        text,
  tag_color        text,
  tag_text_color   text,
  respondents      integer,
  answered_reviews integer,
  summary          jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with answered as (
    select ra.*, r.author_id, r.alias
    from public.review_answers ra
    join public.reviews r on r.id = ra.review_id
    where r.venue_id = p_venue_id
  ),
  per_question as (
    select a.question_id, count(*)::integer as n
    from answered a
    group by a.question_id
  ),
  coverage as (
    select count(distinct a.review_id)::integer as answered_reviews
    from answered a
  )
  select
    q.id,
    q.prompt,
    q.help_text,
    q.kind,
    q.config,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label)
                       order by o.sort_order, o.label)
      from public.question_options o
      where o.question_id = q.id
    ), '[]'::jsonb),
    q.archived_at is not null,
    tg.id,
    tg.slug,
    tg.label,
    tg.color,
    tg.text_color,
    pq.n,
    coverage.answered_reviews,
    case
      when q.kind = 'yes_no' then (
        select jsonb_build_object(
          'yes', count(*) filter (where a.value_bool),
          'no',  count(*) filter (where not a.value_bool))
        from answered a where a.question_id = q.id)

      when q.kind = 'yes_no_unsure' then (
        select jsonb_build_object(
          'yes',    count(*) filter (where a.value_answer = 'yes'),
          'no',     count(*) filter (where a.value_answer = 'no'),
          'unsure', count(*) filter (where a.value_answer = 'unsure'))
        from answered a where a.question_id = q.id)

      -- Every option, including the ones nobody picked: a zero is information.
      when q.kind in ('single_select', 'multi_select') then (
        select jsonb_build_object('options', coalesce(jsonb_agg(
          jsonb_build_object(
            'option_id', o.id,
            'label',     o.label,
            'count',     (select count(*) from answered a
                          where a.question_id = q.id and o.id = any(a.value_option_ids)))
          order by o.sort_order, o.label), '[]'::jsonb))
        from public.question_options o where o.question_id = q.id)

      when q.kind = 'scale' then (
        select jsonb_build_object(
          'avg', round(avg(a.value_number), 2),
          'min', min(a.value_number),
          'max', max(a.value_number),
          'distribution', (
            select jsonb_agg(jsonb_build_object(
              'value', s,
              'count', (select count(*) from answered a2
                        where a2.question_id = q.id and a2.value_number = s))
              order by s)
            from generate_series((q.config ->> 'min')::numeric::integer,
                                 (q.config ->> 'max')::numeric::integer) s))
        from answered a where a.question_id = q.id)

      when q.kind = 'rating' then (
        select jsonb_build_object('avg', round(avg(a.value_number), 2))
        from answered a where a.question_id = q.id)

      -- Median rather than mean for the headline: one person typing 1200 beds
      -- should not move "about 12" to "about 250".
      when q.kind in ('number', 'currency', 'duration') then (
        select jsonb_build_object(
          'median', round((percentile_cont(0.5) within group (order by a.value_number))::numeric, 2),
          'min',    min(a.value_number),
          'max',    max(a.value_number),
          'avg',    round(avg(a.value_number), 2))
        from answered a where a.question_id = q.id)

      when q.kind in ('time_of_day', 'time_range', 'date') then jsonb_build_object(
        'mode', (
          select jsonb_build_object('value', a.value_text, 'count', count(*))
          from answered a where a.question_id = q.id
          group by a.value_text
          order by count(*) desc, a.value_text
          limit 1),
        'distinct', coalesce((
          select jsonb_agg(d.x)
          from (
            select jsonb_build_object('value', a.value_text, 'count', count(*)) as x
            from answered a where a.question_id = q.id
            group by a.value_text
            order by count(*) desc, a.value_text
            limit 5) d), '[]'::jsonb))

      -- Free text is shown, not counted: the latest few, with the name their
      -- review is shown under. "Latest" by week, then by review id, which is
      -- random - the same order venue_reviews uses, for the same reason.
      when q.kind in ('short_text', 'long_text') then jsonb_build_object(
        'recent', coalesce((
          select jsonb_agg(jsonb_build_object(
            'text', x.value_text,
            'display_name', coalesce(x.alias, p.display_name))
            order by x.week desc, x.review_id)
          from (
            select a.value_text, a.author_id, a.alias, a.review_id,
                   public.posting_week(a.answered_at) as week
            from answered a where a.question_id = q.id
            order by public.posting_week(a.answered_at) desc, a.review_id
            limit 5) x
          join public.profiles p on p.id = x.author_id), '[]'::jsonb))
    end
  from per_question pq
  join public.questions q on q.id = pq.question_id
  cross join coverage
  -- The first of the venue's current live tags that asks this question. Null
  -- means nothing here asks it any more - the tag was removed or the question
  -- unassigned - and the sheet says so rather than hiding the answers.
  left join lateral (
    select t.id, t.slug, t.label, t.color, t.text_color,
           t.sort_order as tag_sort, qt.sort_order as question_sort
    from public.venue_tags vt
    join public.tags t on t.id = vt.tag_id and t.archived_at is null
    join public.question_tags qt on qt.tag_id = t.id and qt.question_id = q.id
    where vt.venue_id = p_venue_id
    order by t.sort_order, t.label
    limit 1
  ) tg on true
  order by tg.tag_sort nulls last, tg.label nulls last, tg.question_sort, lower(q.prompt);
$$;

comment on function public.venue_answer_summary(uuid) is
  'Aggregated tag-question answers for one venue, one row per answered question. Every count is out of the people who answered that question, never the review count. Free-text quotes carry the name their review is shown under (in the display_name key), are chosen by posting week rather than exact time, and carry no time. Security definer only so that a superseded question''s wording can still be read; exposes nothing beyond questions answered at this venue.';


-- ---------------------------------------------------------------------------
-- The map's latest-review line
-- ---------------------------------------------------------------------------

-- venues_near and venues_search run as the caller, and picked "the latest
-- review" by created_at - which the caller can no longer read. They stay
-- invoker, so the tag policies keep applying exactly as before, and ask this
-- for the line instead.
--
-- "Latest" by week, then by id: a random review from the newest week. Picking
-- the truly newest would tell a reader which review came last, and so put a
-- hidden-date review after every dated one at the same place.
create or replace function public.venue_latest_review_body(p_venue_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.body
  from public.reviews r
  where r.venue_id = p_venue_id
  order by public.posting_week(r.created_at) desc, r.id
  limit 1;
$$;

comment on function public.venue_latest_review_body(uuid) is
  'The body of one review from the venue''s most recent posting week (null if that review has no words, or the venue no reviews). For the map marker''s quote. Chosen within the week by review id, so it does not single out the newest review.';

-- Dropped, not replaced, because latest_review_at leaves the return type.
-- Dropping also discards the grants; they are restated at the bottom.
drop function if exists public.venues_near(double precision, double precision, double precision, integer);
drop function if exists public.venues_search(text, double precision, double precision, integer);

create function public.venues_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision default 200,
  p_limit integer default 60
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  google_place_id text,
  distance_meters double precision,
  review_count bigint,
  avg_stars numeric,
  latest_review_body text,
  tags jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with box as (
    select
      p_radius_meters / 111320.0 as dlat,
      p_radius_meters / (111320.0 * greatest(cos(radians(p_lat)), 0.01)) as dlng
  )
  select
    v.id,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id,
    d.meters as distance_meters,
    vr.review_count,
    vr.avg_stars,
    case when vr.review_count > 0 then public.venue_latest_review_body(v.id) end as latest_review_body,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', t.slug, 'label', t.label,
               'color', t.color, 'text_color', t.text_color)
             order by t.sort_order, t.label)
      from public.venue_tags vt
      join public.tags t on t.id = vt.tag_id and t.archived_at is null
      where vt.venue_id = v.id
    ), '[]'::jsonb) as tags
  from public.venues v
  cross join box b
  join public.venue_ratings vr on vr.venue_id = v.id
  cross join lateral (
    select 6371000.0 * 2 * asin(sqrt(
      power(sin(radians(v.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(v.lat))
      * power(sin(radians(v.lng - p_lng) / 2), 2)
    )) as meters
  ) d
  where v.lat is not null
    and v.lng is not null
    and v.lat between p_lat - b.dlat and p_lat + b.dlat
    and v.lng between p_lng - b.dlng and p_lng + b.dlng
    and d.meters <= p_radius_meters
    and (
      vr.review_count > 0
      or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
    )
  order by d.meters
  limit p_limit;
$$;

create function public.venues_search(
  p_query text,
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 40
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  google_place_id text,
  distance_meters double precision,
  review_count bigint,
  avg_stars numeric,
  latest_review_body text,
  tags jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    v.id,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id,
    d.meters as distance_meters,
    vr.review_count,
    vr.avg_stars,
    case when vr.review_count > 0 then public.venue_latest_review_body(v.id) end as latest_review_body,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', t.slug, 'label', t.label,
               'color', t.color, 'text_color', t.text_color)
             order by t.sort_order, t.label)
      from public.venue_tags vt
      join public.tags t on t.id = vt.tag_id and t.archived_at is null
      where vt.venue_id = v.id
    ), '[]'::jsonb) as tags
  from public.venues v
  join public.venue_ratings vr on vr.venue_id = v.id
  cross join lateral (
    select case
      when v.lat is null or v.lng is null then null::double precision
      else 6371000.0 * 2 * asin(sqrt(
        power(sin(radians(v.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(v.lat))
        * power(sin(radians(v.lng - p_lng) / 2), 2)
      ))
    end as meters
  ) d
  where (
      vr.review_count > 0
      or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
    )
    and v.name ilike '%' || p_query || '%'
  order by d.meters asc nulls last
  limit p_limit;
$$;


-- ---------------------------------------------------------------------------
-- my_reviews - what readers see of each, dates included
-- ---------------------------------------------------------------------------

-- The author is shown what their reviews show, so "hidden" is something they
-- can check rather than take on trust. updated_at stays exact: it is their own.
drop function if exists public.my_reviews();

create function public.my_reviews()
returns table (
  id                    uuid,
  venue_id              uuid,
  stars                 smallint,
  trans_bathroom        public.answer,
  body                  text,
  updated_at            timestamptz,
  alias                 text,
  hide_date             boolean,
  posted_period         text,
  posted_on             date,
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
    r.alias,
    r.hide_date,
    public.posting_period(r.created_at),
    case when not r.hide_date then (r.created_at at time zone 'UTC')::date end,
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
  'The caller''s own reviews with the venue each is about, the alias each is shown under (null: their display name), and the date readers see - the posting period, plus the UTC day when the date is not hidden. Most recently saved first. Empty for a caller with no reviews; not callable signed out.';


-- ---------------------------------------------------------------------------
-- admin_list_reviews - whether readers see the date
-- ---------------------------------------------------------------------------

-- The panel keeps the exact times. What it gains is what readers see instead,
-- so a moderator quoting a review back to someone can tell which date that
-- person was shown. Dropped rather than replaced, for the return type.
drop function if exists public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
);

create function public.admin_list_reviews(
  p_search text default null,
  -- The two link-throughs: Places -> "1 review", Users -> posted count.
  p_venue_id uuid default null,
  p_author_id uuid default null,
  p_min_stars integer default null,
  p_max_stars integer default null,
  -- 'any' | 'with' | 'without'. A rating with no words is legitimate - and is
  -- also the shape bulk ratings take, which is why it is worth filtering on.
  p_body text default 'any',
  -- The only yes/no/unsure column on a review. There is no lgbtq_friendly
  -- filter because there is no such column: 20260905134743 dropped it once the
  -- stars themselves became the friendliness rating (1 hostile, 5 welcoming).
  p_bathroom public.answer default null,
  p_tag_id uuid default null,
  -- 'any' | 'active' | 'banned'. Answers "what did the account I just banned
  -- leave behind", which is the first question after any ban.
  p_author_status text default 'any',
  p_posted_after timestamptz default null,
  -- 'created_at' | 'updated_at' | 'stars' | 'venue_name' | 'author_name'
  p_sort text default 'created_at',
  p_desc boolean default true,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  venue_id uuid,
  venue_name text,
  venue_address text,
  author_id uuid,
  author_name text,
  -- The name readers see. Null: they see author_name.
  alias text,
  author_banned_at timestamptz,
  author_is_admin boolean,
  stars smallint,
  trans_bathroom public.answer,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  admin_edited_at timestamptz,
  -- Readers see posted_period instead of the date when this is true.
  hide_date boolean,
  posted_period text,
  answer_count bigint,
  venue_tags jsonb,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
  -- RETURNS TABLE names share a namespace with column names; this makes the
  -- ambiguous case resolve to the column rather than to the output variable.
  #variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select
      r.id              as id,
      r.venue_id        as venue_id,
      v.name            as venue_name,
      v.address         as venue_address,
      r.author_id       as author_id,
      p.display_name    as author_name,
      r.alias           as alias,
      p.banned_at       as author_banned_at,
      (ad.user_id is not null) as author_is_admin,
      r.stars           as stars,
      r.trans_bathroom  as trans_bathroom,
      r.body            as body,
      r.created_at      as created_at,
      r.updated_at      as updated_at,
      r.admin_edited_at as admin_edited_at,
      r.hide_date       as hide_date,
      public.posting_period(r.created_at) as posted_period,
      (select count(*) from public.review_answers ra where ra.review_id = r.id) as answer_count,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', t.id, 'slug', t.slug, 'label', t.label,
                 'color', t.color, 'text_color', t.text_color)
               order by t.sort_order, t.label)
        from public.venue_tags vt
        join public.tags t on t.id = vt.tag_id
        where vt.venue_id = v.id
      ), '[]'::jsonb) as venue_tags
    from public.reviews r
    join public.venues v on v.id = r.venue_id
    join public.profiles p on p.id = r.author_id
    left join public.admins ad on ad.user_id = p.id
    where (
        p_search is null or p_search = ''
        -- % and _ reach ilike as wildcards. This is an admin-only box and that
        -- is useful more often than it is surprising.
        or r.body ilike '%' || p_search || '%'
        or v.name ilike '%' || p_search || '%'
        or p.display_name ilike '%' || p_search || '%'
        or r.alias ilike '%' || p_search || '%'
        -- Any of the three ids, so a uuid copied from anywhere in the panel
        -- finds what it names.
        or r.id::text        like lower(p_search) || '%'
        or r.venue_id::text  like lower(p_search) || '%'
        or r.author_id::text like lower(p_search) || '%'
      )
      and (p_venue_id  is null or r.venue_id  = p_venue_id)
      and (p_author_id is null or r.author_id = p_author_id)
      and (p_min_stars is null or r.stars >= p_min_stars)
      and (p_max_stars is null or r.stars <= p_max_stars)
      and (
        p_body is null or p_body = 'any'
        -- Whitespace-only prose is not prose. Matching the panel's "Rating
        -- only" to what a person would call empty costs one btrim.
        or (p_body = 'with'    and r.body is not null and btrim(r.body) <> '')
        or (p_body = 'without' and (r.body is null or btrim(r.body) = ''))
      )
      and (p_bathroom is null or r.trans_bathroom = p_bathroom)
      and (
        p_author_status is null or p_author_status = 'any'
        or (p_author_status = 'banned' and p.banned_at is not null)
        or (p_author_status = 'active' and p.banned_at is null)
      )
      and (p_posted_after is null or r.created_at >= p_posted_after)
      and (
        p_tag_id is null
        or exists (
          select 1 from public.venue_tags vt
          where vt.venue_id = r.venue_id and vt.tag_id = p_tag_id
        )
      )
  )
  select
    f.id,
    f.venue_id,
    f.venue_name,
    f.venue_address,
    f.author_id,
    f.author_name,
    f.alias,
    f.author_banned_at,
    f.author_is_admin,
    f.stars,
    f.trans_bathroom,
    f.body,
    f.created_at,
    f.updated_at,
    f.admin_edited_at,
    f.hide_date,
    f.posted_period,
    f.answer_count,
    f.venue_tags,
    -- The size of the whole filtered set, carried on every row, so the
    -- paginator costs no second round trip.
    count(*) over () as total_count
  from filtered f
  -- p_sort is matched, never interpolated: a sort column arriving from the
  -- client is a string, and a string spliced into SQL is an injection.
  order by
    case when p_sort = 'created_at'  and not p_desc then f.created_at end asc,
    case when p_sort = 'created_at'  and p_desc     then f.created_at end desc,
    case when p_sort = 'updated_at'  and not p_desc then f.updated_at end asc,
    case when p_sort = 'updated_at'  and p_desc     then f.updated_at end desc,
    case when p_sort = 'stars'       and not p_desc then f.stars end asc,
    case when p_sort = 'stars'       and p_desc     then f.stars end desc,
    case when p_sort = 'venue_name'  and not p_desc then f.venue_name end asc,
    case when p_sort = 'venue_name'  and p_desc     then f.venue_name end desc,
    case when p_sort = 'author_name' and not p_desc then f.author_name end asc,
    case when p_sort = 'author_name' and p_desc     then f.author_name end desc,
    -- Breaks ties, so a row cannot land on two pages or on neither. Sorting by
    -- stars without this would reshuffle five-star reviews on every request.
    f.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
) is 'One page of the admin reviews list, with each review''s venue, author account, the alias readers see instead (if any), its exact times, whether readers see its date or only its posting period, answer count and the size of the whole filtered set. Search matches aliases too. Admin only.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Internal: reached only from the definer functions above, the trigger, and
-- the two map functions (which call venue_latest_review_body, granted below).
revoke execute on function public.posting_week(timestamptz)          from public, anon, authenticated;
revoke execute on function public.posting_period(timestamptz)        from public, anon, authenticated;
revoke execute on function public.reviews_apply_author_privacy()     from public, anon, authenticated;

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon. The
-- drops above took the old grants with them, so every dropped function is
-- granted again as well as revoked again.
revoke execute on function public.set_hide_dates(boolean)            from public, anon;
revoke execute on function public.venue_reviews(uuid)                from public;
revoke execute on function public.venue_latest_review_body(uuid)     from public;
revoke execute on function public.my_reviews()                       from public, anon;
revoke execute on function public.venues_near(
  double precision, double precision, double precision, integer
) from public;
revoke execute on function public.venues_search(
  text, double precision, double precision, integer
) from public;
revoke execute on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
) from public, anon;

grant execute on function public.set_hide_dates(boolean)             to authenticated;
grant execute on function public.my_reviews()                        to authenticated;
-- Anyone reading a venue needs its reviews and the map, signed in or not.
-- venue_latest_review_body has to be executable by whoever calls the map
-- functions, because they run as the caller.
grant execute on function public.venue_reviews(uuid)                 to anon, authenticated;
grant execute on function public.venue_latest_review_body(uuid)      to anon, authenticated;
grant execute on function public.venues_near(
  double precision, double precision, double precision, integer
) to anon, authenticated;
grant execute on function public.venues_search(
  text, double precision, double precision, integer
) to anon, authenticated;
-- Granted to every signed-in user because a grant is not finer-grained than a
-- role. The is_admin() check at the top of the function is what refuses.
grant execute on function public.admin_list_reviews(
  text, uuid, uuid, integer, integer, text, public.answer, uuid,
  text, timestamptz, text, boolean, integer, integer
) to authenticated;
