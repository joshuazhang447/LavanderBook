-- LavenderBook initial schema: profiles, venues, reviews.
--
-- Notes for future readers:
--   * "Automatically expose new tables" is OFF on this project, so every table
--     needs an explicit GRANT at the bottom of this file or the API cannot see it.
--   * RLS and GRANT are different things. GRANT says "this role may touch this
--     table at all"; RLS says "these are the rows it may touch". Both are needed.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- Three-state answer. 'unsure' is load-bearing: a reviewer who never checked the
-- bathroom must not be recorded as reporting "no". For a safety app, guessed
-- data is worse than absent data.
create type public.answer as enum ('yes', 'no', 'unsure');


-- ---------------------------------------------------------------------------
-- profiles - public identity for an account
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (char_length(display_name) between 3 and 40)
);

-- Auth email and identity stay in auth.users, which is not exposed to the API.
-- Only this row is public, and it deliberately holds nothing identifying.
comment on table public.profiles is
  'Public identity for an account. Display names are auto-generated so nobody can deanonymise themselves by typing a real name or a handle they reuse elsewhere.';


-- ---------------------------------------------------------------------------
-- Auto-generated display names
-- ---------------------------------------------------------------------------

create or replace function public.generate_display_name()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  adjectives text[] := array[
    'Quiet','Brave','Gentle','Bright','Kind','Swift','Calm','Bold',
    'Lucky','Sunny','Wild','Clever','Merry','Noble','Warm','Keen'
  ];
  nouns text[] := array[
    'Heron','Fox','Willow','Otter','Sparrow','Cedar','Robin','Lynx',
    'Maple','Finch','Badger','Hazel','Wren','Poppy','Marten','Aspen'
  ];
  candidate text;
  attempts int := 0;
begin
  loop
    candidate :=
      adjectives[1 + floor(random() * array_length(adjectives, 1))::int] ||
      nouns[1 + floor(random() * array_length(nouns, 1))::int] ||
      (100 + floor(random() * 900))::int::text;

    exit when not exists (
      select 1 from public.profiles where display_name = candidate
    );

    -- 16 x 16 x 900 is about 230k combinations, so collisions are rare, but
    -- never let signup spin forever if the space fills up.
    attempts := attempts + 1;
    if attempts > 20 then
      candidate := left('Guest' || replace(gen_random_uuid()::text, '-', ''), 24);
      exit;
    end if;
  end loop;

  return candidate;
end;
$$;

-- Every new auth user gets a profile automatically. security definer so it can
-- write to public.profiles even though the signing-up user has no INSERT policy.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.generate_display_name());
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------

-- Own UUID key rather than using place_id directly: reviews keep pointing at the
-- same venue even if Google merges or retires a place ID.
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint venues_name_length check (char_length(name) between 1 and 200),
  constraint venues_lat_range check (lat is null or lat between -90 and 90),
  constraint venues_lng_range check (lng is null or lng between -180 and 180)
);

comment on column public.venues.google_place_id is
  'Source of truth for identity. Nullable so venues absent from Google can still be reviewed. Unique so the same place cannot be added twice.';

comment on column public.venues.last_synced_at is
  'When name/address/lat/lng were last refreshed from Google. Those columns are a cache, not the source of truth: Google terms limit how long Places content may be stored, while place_id may be kept indefinitely.';

create index venues_name_idx on public.venues (lower(name));


-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  lgbtq_friendly public.answer not null default 'unsure',
  trans_bathroom public.answer not null default 'unsure',
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_body_length check (body is null or char_length(body) <= 2000),
  -- One review per person per venue. A venue still gets unlimited reviews from
  -- different people; this only stops one account voting twice on the same place.
  constraint reviews_one_per_author_per_venue unique (venue_id, author_id)
);

comment on column public.reviews.body is
  'Optional: a rating with no words is still a useful data point, and requiring prose suppresses submissions.';

create index reviews_venue_id_idx on public.reviews (venue_id);
create index reviews_author_id_idx on public.reviews (author_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- Aggregated ratings
-- ---------------------------------------------------------------------------

-- security_invoker so the view runs with the caller's permissions and the RLS
-- policies below still apply. Without it a view silently bypasses them.
create view public.venue_ratings
with (security_invoker = true)
as
select
  v.id                                                as venue_id,
  count(r.id)                                         as review_count,
  round(avg(r.stars), 2)                              as avg_stars,
  count(*) filter (where r.lgbtq_friendly = 'yes')    as lgbtq_friendly_yes,
  count(*) filter (where r.lgbtq_friendly = 'no')     as lgbtq_friendly_no,
  count(*) filter (where r.lgbtq_friendly = 'unsure') as lgbtq_friendly_unsure,
  count(*) filter (where r.trans_bathroom = 'yes')    as trans_bathroom_yes,
  count(*) filter (where r.trans_bathroom = 'no')     as trans_bathroom_no,
  count(*) filter (where r.trans_bathroom = 'unsure') as trans_bathroom_unsure
from public.venues v
left join public.reviews r on r.venue_id = v.id
group by v.id;

comment on view public.venue_ratings is
  'Counts are kept per answer rather than as a single percentage so the UI can distinguish "nobody knows" from "people say no" - they mean very different things.';


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.venues   enable row level security;
alter table public.reviews  enable row level security;

-- profiles: readable by all, written only by the signup trigger above.
create policy "Profiles are readable by everyone"
  on public.profiles for select
  using (true);

-- venues: readable by all; any signed-in user may add one they want to review.
-- No UPDATE/DELETE policy on purpose - cache refreshes run as the service role,
-- which bypasses RLS, so users cannot rename or remove a venue.
create policy "Venues are readable by everyone"
  on public.venues for select
  using (true);

create policy "Signed-in users can add a venue"
  on public.venues for insert
  to authenticated
  with check (true);

-- reviews: readable by all; writable only by their own author.
-- (select auth.uid()) rather than auth.uid() so Postgres evaluates it once per
-- query instead of once per row.
create policy "Reviews are readable by everyone"
  on public.reviews for select
  using (true);

create policy "Authors can create their own review"
  on public.reviews for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "Authors can edit their own review"
  on public.reviews for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Authors can delete their own review"
  on public.reviews for delete
  to authenticated
  using (author_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- Grants (required: this project does not auto-expose new tables)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select                 on public.profiles      to anon, authenticated;
grant select                 on public.venues        to anon, authenticated;
grant insert                 on public.venues        to authenticated;
grant select                 on public.reviews       to anon, authenticated;
grant insert, update, delete on public.reviews       to authenticated;
grant select                 on public.venue_ratings to anon, authenticated;

-- Helper functions are called by triggers running as the definer, never directly.
revoke execute on function public.generate_display_name() from public, anon, authenticated;
revoke execute on function public.handle_new_user()       from public, anon, authenticated;
revoke execute on function public.set_updated_at()        from public, anon, authenticated;
