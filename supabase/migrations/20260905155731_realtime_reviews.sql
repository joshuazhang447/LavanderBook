-- Broadcast review changes so open maps update without waiting for a pan or a
-- 50m walk.
--
-- The subscription is on `reviews`, not `venue_ratings`: logical replication
-- replicates tables, and a view never emits change events. Clients refetch the
-- aggregate when a review event arrives.
--
-- Reviews are already publicly SELECTable, so every connected client - signed in
-- or not - receives every review event. That is intended for a public directory,
-- but it does mean review text reaches all listeners the moment it is written.

do $$
begin
  -- Supabase creates this publication on every project; guard anyway so the
  -- migration is safe to run against a database that lacks it.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;
end
$$;
