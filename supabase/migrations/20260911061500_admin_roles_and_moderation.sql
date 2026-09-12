-- Admin access, and a ban that actually stops something.
--
-- This replaces the arrangement in the previous commit, where an admin was
-- whoever knew one shared name and password held in a Supabase secret. That was
-- honest about being a door rather than a wall, but a door is not enough once
-- there is real data and a real destructive action behind it, and the scheme had
-- no answer for the things that matter: which admin did this, how do I revoke
-- one, how does a session survive a reload without parking a bearer token in
-- storage, where is the password reset, where is MFA.
--
-- So we stop running a second authentication system. An admin is an ordinary
-- Supabase Auth user - GoTrue already hashes the password, rate limits the
-- attempts, rotates the refresh token and can do TOTP - and the only new fact is
-- WHICH users are admins. That fact belongs in the database, checked by Postgres
-- on every call, not asserted by a screen the client controls.
--
-- Creating the first admin (once, by hand - there is deliberately no way to do
-- it from the app):
--
--   1. Dashboard > Authentication > Providers > Email: enabled, and turn OFF
--      "Allow new users to sign up" so the app stays Google-only for everyone
--      else. (Locally that is [auth.email] enable_signup in config.toml.)
--   2. Dashboard > Authentication > Users > Add user: an email and a long
--      password, auto-confirm.
--   3. Here, in the SQL editor:
--        insert into public.admins (user_id, note)
--        select id, 'founder' from auth.users where email = 'you@example.com';
--
-- The signup trigger gives that account a generated display name and a profile
-- like anyone else, so an admin also shows up in their own users list. That is
-- intended: there is no hidden class of account.


-- ---------------------------------------------------------------------------
-- admins - who may use the admin panel
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  note text
);

comment on table public.admins is
  'Membership is the whole authorisation model. There is no INSERT/UPDATE/DELETE policy or grant on purpose: rows are added and removed with the service role, so a compromised admin session cannot promote anyone.';

-- security definer so it reads public.admins regardless of that table's own
-- policy - which is also what stops the SELECT policy below recursing into
-- itself. stable so the planner evaluates it once per query, not once per row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

comment on function public.is_admin() is
  'Deliberately a table lookup rather than a JWT claim. A claim is one less query, but it lives in an issued token until that token expires - an hour here - so removing an admin would not take effect for an hour. This revokes on the next request.';

alter table public.admins enable row level security;

-- Enough for the panel to ask "am I one?", and for an admin to see the list.
-- Nothing here can change it.
create policy "Admins are visible to themselves and to other admins"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

grant select on public.admins to authenticated;


-- ---------------------------------------------------------------------------
-- Banning
-- ---------------------------------------------------------------------------

alter table public.profiles add column banned_at timestamptz;

comment on column public.profiles.banned_at is
  'Null means active. Readable by everyone, like the rest of the row: display names are generated precisely so a profile identifies nobody, and the app needs to read this to tell a banned user why their review was refused rather than showing them an opaque failure.';

create or replace function public.is_banned(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = p_user and p.banned_at is not null
  );
$$;

-- A ban that only coloured a badge in the admin panel would be theatre, so it is
-- enforced where it cannot be argued with: the policies that let a review be
-- written in the first place.
--
-- Note which policies are NOT touched. SELECT is untouched, so a banned user's
-- existing reviews stay on the map - taking those down is a separate decision
-- with its own screen, not a side effect of this one. DELETE is untouched too:
-- removing your own words is not something a ban should prevent.
drop policy "Authors can create their own review" on public.reviews;
create policy "Authors can create their own review"
  on public.reviews for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and not public.is_banned((select auth.uid()))
  );

drop policy "Authors can edit their own review" on public.reviews;
create policy "Authors can edit their own review"
  on public.reviews for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and not public.is_banned((select auth.uid()))
  );


-- ---------------------------------------------------------------------------
-- The admin panel's two calls
-- ---------------------------------------------------------------------------

-- Both are security definer and both open by checking is_admin(), which is the
-- only check that counts. The sign-in screen in front of the panel decides what
-- to render, and the client decides what the client renders; these decide what
-- the database will actually do.

create or replace function public.admin_list_profiles(
  p_search text default null,
  -- 'all' | 'active' | 'banned'
  p_status text default 'all',
  p_min_reviews integer default null,
  p_max_reviews integer default null,
  p_joined_after timestamptz default null,
  -- 'id' | 'display_name' | 'created_at' | 'review_count'
  p_sort text default 'created_at',
  p_desc boolean default true,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  created_at timestamptz,
  banned_at timestamptz,
  review_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
  -- RETURNS TABLE names share a namespace with column names. Everything below is
  -- qualified anyway; this makes the ambiguous case resolve to the column rather
  -- than silently to the output variable.
  #variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  -- One grouped pass over reviews rather than a subquery per row, so filtering
  -- and sorting on the count are correct rather than only cosmetic. Served by
  -- reviews_author_id_idx.
  with counted as (
    select r.author_id, count(*) as n
    from public.reviews r
    group by r.author_id
  ),
  filtered as (
    select
      p.id             as id,
      p.display_name   as display_name,
      p.created_at     as created_at,
      p.banned_at      as banned_at,
      coalesce(c.n, 0) as review_count
    from public.profiles p
    left join counted c on c.author_id = p.id
    where (
        p_search is null or p_search = ''
        -- % and _ reach ilike as wildcards. This is an admin-only box and that
        -- is useful more often than it is surprising.
        or p.display_name ilike '%' || p_search || '%'
        -- Pasting a whole uuid should find exactly one row, and typing the first
        -- few characters of one should narrow to it.
        or p.id::text like lower(p_search) || '%'
      )
      and (
        p_status is null or p_status = 'all'
        or (p_status = 'banned' and p.banned_at is not null)
        or (p_status = 'active' and p.banned_at is null)
      )
      and (p_min_reviews is null or coalesce(c.n, 0) >= p_min_reviews)
      and (p_max_reviews is null or coalesce(c.n, 0) <= p_max_reviews)
      and (p_joined_after is null or p.created_at >= p_joined_after)
  )
  select
    f.id,
    f.display_name,
    f.created_at,
    f.banned_at,
    f.review_count,
    -- The size of the whole filtered set, carried on every row, so the paginator
    -- costs no second round trip.
    count(*) over () as total_count
  from filtered f
  -- p_sort is matched, never interpolated: a sort column arriving from the
  -- client is a string, and a string spliced into SQL is an injection. The cost
  -- is that no index can serve this, so it is always a sort - which at any
  -- profile count this app will plausibly reach is a couple of milliseconds.
  order by
    case when p_sort = 'display_name' and not p_desc then f.display_name end asc,
    case when p_sort = 'display_name' and p_desc     then f.display_name end desc,
    case when p_sort = 'created_at'   and not p_desc then f.created_at end asc,
    case when p_sort = 'created_at'   and p_desc     then f.created_at end desc,
    case when p_sort = 'review_count' and not p_desc then f.review_count end asc,
    case when p_sort = 'review_count' and p_desc     then f.review_count end desc,
    case when p_sort = 'id'           and not p_desc then f.id end asc,
    case when p_sort = 'id'           and p_desc     then f.id end desc,
    -- Breaks ties, so a row cannot land on two pages or on neither.
    f.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.admin_list_profiles(
  text, text, integer, integer, timestamptz, text, boolean, integer, integer
) is 'One page of the admin users list, with each profile''s review count and the size of the whole filtered set. Admin only.';

create or replace function public.admin_set_banned(p_user uuid, p_banned boolean)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_banned_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  update public.profiles
  -- coalesce so re-banning an already-banned account keeps the original date
  -- rather than quietly restarting it.
  set banned_at = case when p_banned then coalesce(banned_at, now()) else null end
  where id = p_user
  returning banned_at into v_banned_at;

  if not found then
    raise exception 'no such profile' using errcode = 'P0002';
  end if;

  return v_banned_at;
end;
$$;

-- A function rather than an UPDATE policy on profiles, because a policy grants
-- the whole row: an admin who could update profiles could also rename people.
-- This is the only column the panel can write.
comment on function public.admin_set_banned(uuid, boolean) is
  'Sets or clears profiles.banned_at, and nothing else. Returns the new value. Admin only.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon.
revoke execute on function public.is_admin()      from public;
revoke execute on function public.is_banned(uuid) from public;
revoke execute on function public.admin_set_banned(uuid, boolean) from public;
revoke execute on function public.admin_list_profiles(
  text, text, integer, integer, timestamptz, text, boolean, integer, integer
) from public;

grant execute on function public.is_admin() to authenticated;

-- Needed by the review policies above: a policy expression runs as the role
-- doing the query, so without this every review insert fails on permission
-- denied rather than on the check it was meant to fail.
grant execute on function public.is_banned(uuid) to authenticated;

-- Granted to every signed-in user because a grant is not finer-grained than a
-- role. The is_admin() check at the top of each function is what refuses.
grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;
grant execute on function public.admin_list_profiles(
  text, text, integer, integer, timestamptz, text, boolean, integer, integer
) to authenticated;
