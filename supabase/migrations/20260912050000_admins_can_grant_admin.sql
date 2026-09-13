-- Granting and revoking admin access from the panel.
--
-- 20260911061500 said membership of public.admins is added and removed with the
-- service role only, so that a compromised admin session could not promote
-- anyone. That is strictly safer and it is being given up here on purpose: the
-- alternative is that every new admin is a trip to the SQL editor, which in
-- practice means the founder's account gets shared instead - and a shared
-- account loses the one thing the table bought us, which is knowing which admin
-- did what.
--
-- So the blast radius of a stolen admin session grows from "everything an admin
-- can do until we notice" to "...and they can leave a second door open". The
-- mitigation is that the door is visible: an admin shows up in this very list
-- with a badge, and revoking is one click.
--
-- Two things this does NOT do:
--
--   * It does not let you revoke yourself. Not paternalism - it is what stops
--     the panel reaching a state with no admins left in it, which no admin
--     could then undo.
--   * It does not create accounts. The target must already be a signed-up user
--     with a profile; promoting a uuid nobody has ever authenticated as would
--     leave a row that is either dead or waiting for someone to claim it.


-- ---------------------------------------------------------------------------
-- admin_set_admin
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_admin(p_user uuid, p_is_admin boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  -- The errcode matters. 42501 is the one the panel rewrites into "this account
  -- is not an administrator", and this refusal is not that, so it goes out as
  -- P0001 and the message reaches the person as written.
  if p_user = v_actor and not p_is_admin then
    raise exception 'You cannot remove your own administrator access. Ask another administrator to do it.'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'no such profile' using errcode = 'P0002';
  end if;

  if p_is_admin then
    insert into public.admins (user_id, note)
    values (p_user, 'granted by ' || coalesce(v_actor::text, 'unknown') || ' from the admin panel')
    -- Already an admin is success rather than a conflict, and the existing note
    -- - which records who let them in first - is the one worth keeping.
    on conflict (user_id) do nothing;
  else
    delete from public.admins a where a.user_id = p_user;
  end if;

  -- Read back rather than echo the argument, so the answer is what the table
  -- says and not what was asked of it.
  return exists (select 1 from public.admins a where a.user_id = p_user);
end;
$$;

comment on function public.admin_set_admin(uuid, boolean) is
  'Adds or removes one row in public.admins, and nothing else. Returns the membership as it stands afterwards. Admin only, and refuses to remove the caller''s own access.';


-- ---------------------------------------------------------------------------
-- admin_list_profiles, now carrying who is an admin
-- ---------------------------------------------------------------------------

-- The panel has to know before it can offer the action, and the row is where
-- that belongs - same as banned_at. A separate lookup would be a second round
-- trip that can disagree with the page it is decorating.
--
-- Dropped rather than replaced: create or replace cannot change a function's
-- return type, and this adds a column to it.
drop function if exists public.admin_list_profiles(
  text, text, integer, integer, timestamptz, text, boolean, integer, integer
);

create function public.admin_list_profiles(
  p_search text default null,
  -- 'all' | 'active' | 'banned' | 'admin'
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
  is_admin boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
  -- RETURNS TABLE names share a namespace with column names. Everything below is
  -- qualified anyway; this makes the ambiguous case resolve to the column rather
  -- than silently to the output variable. The new output column called is_admin
  -- does not shadow public.is_admin() - a call is not a reference - but every
  -- call to it below stays schema-qualified regardless.
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
      coalesce(c.n, 0) as review_count,
      (ad.user_id is not null) as is_admin
    from public.profiles p
    left join counted c on c.author_id = p.id
    -- A join rather than an exists() per row: the table is tiny, and this way
    -- the same fact also filters (p_status = 'admin') without a second lookup.
    left join public.admins ad on ad.user_id = p.id
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
        or (p_status = 'admin'  and ad.user_id is not null)
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
    f.is_admin,
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
) is 'One page of the admin users list, with each profile''s review count, whether it is an administrator, and the size of the whole filtered set. Admin only.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon. The
-- drop above took the old function's grants with it, so admin_list_profiles has
-- to be granted again as well as revoked again.
revoke execute on function public.admin_set_admin(uuid, boolean) from public;
revoke execute on function public.admin_list_profiles(
  text, text, integer, integer, timestamptz, text, boolean, integer, integer
) from public;

-- Granted to every signed-in user because a grant is not finer-grained than a
-- role. The is_admin() check at the top of each function is what refuses.
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_list_profiles(
  text, text, integer, integer, timestamptz, text, boolean, integer, integer
) to authenticated;
