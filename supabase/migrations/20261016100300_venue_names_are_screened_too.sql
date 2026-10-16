-- Venue names are screened too.
--
-- The app adds a place straight from the map: whatever name the client sends
-- is the name every reader sees (src/lib/review-form.ts, and 20261016100000).
-- Google's labels are innocent, but a modified client can send anything, and
-- a place shows on the map as soon as it has a review.
--
-- A name with a hold-tier word, while enforcing, never reaches the public. The
-- name goes into pending_name, which nobody but the panel can read, and the
-- place is listed as "Name being checked" until a person publishes the name or
-- gives the place a better one. The place itself stays: google_place_id still
-- finds it, so the next person reviewing it lands on the same row instead of a
-- duplicate, and nothing they write is lost.
--
-- In shadow mode, and for watch-tier words, the name stays as it was and an
-- item goes to "Worth a look".
--
-- Admins are not screened: their names come from Google through
-- admin_upsert_venue, or are the decision itself.
--
-- The placeholder is English. Place names are shown as they are, untranslated,
-- everywhere else too.


alter table public.venues
  add column pending_name text
  constraint venues_pending_name_length
  check (pending_name is null or char_length(pending_name) between 1 and 200);

-- Not granted: SELECT on venues names its columns (20261009180000), and the
-- INSERT grant from 20261016100000 does not include it.
comment on column public.venues.pending_name is
  'A name the app sent that contained a hold-tier word, waiting for a person. While it is set, name holds a placeholder. Not granted to anon or authenticated; the panel reads it through admin_list_cases.';


-- Sorts after venues_normalize_name ('n' < 's'), so it sees the name with its
-- whitespace already collapsed. Same-event BEFORE triggers fire in name order.
create or replace function public.venues_screen_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits uuid[];
begin
  if public.is_admin() then
    return new;
  end if;

  new.pending_name := null;

  -- A broken list must never stop somebody adding a place.
  begin
    v_hits := public.moderation_screen(array[new.name]);
  exception when others then
    return new;
  end;

  if public.moderation_enforced() and exists (
    select 1 from public.moderation_terms t
    where t.id = any(v_hits) and t.tier = 'hold'
  ) then
    new.pending_name := new.name;
    new.name := 'Name being checked';
  end if;

  return new;
end;
$$;

comment on function public.venues_screen_name() is
  'BEFORE INSERT OR UPDATE OF name on venues: while enforcing, a name containing a hold-tier word is moved to pending_name and the place is listed under a placeholder until a person decides. Skips admins.';

create trigger venues_screen_name
  before insert or update of name on public.venues
  for each row execute function public.venues_screen_name();


-- AFTER, because the queue item points at the venue row, which has to exist.
create or replace function public.venues_screen_name_case()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits  uuid[];
  v_hold  boolean;
  v_watch boolean;
begin
  if public.is_admin() then
    return null;
  end if;

  begin
    v_hits := public.moderation_screen(array[coalesce(new.pending_name, new.name)]);
  exception when others then
    return null;
  end;

  if coalesce(cardinality(v_hits), 0) = 0 then
    return null;
  end if;

  select bool_or(t.tier = 'hold'), bool_or(t.tier = 'watch')
    into v_hold, v_watch
  from public.moderation_terms t
  where t.id = any(v_hits);

  -- The account that added the place is the only record of who did.
  if new.pending_name is not null then
    perform public.moderation_note_case('venue_name', null, new.id, (select auth.uid()),
                                        'venue_name', 'decide', 80, v_hits);
  elsif coalesce(v_hold, false) then
    perform public.moderation_note_case('venue_name', null, new.id, (select auth.uid()),
                                        'shadow_hold', 'look', 10, v_hits);
  elsif coalesce(v_watch, false) then
    perform public.moderation_note_case('venue_name', null, new.id, (select auth.uid()),
                                        'watch', 'look', 20, v_hits);
  end if;

  return null;
end;
$$;

comment on function public.venues_screen_name_case() is
  'AFTER INSERT on venues: opens a queue item for a place name that matched the word list - to decide when the name is held, to look at otherwise. Skips admins.';

create trigger venues_screen_name_case
  after insert on public.venues
  for each row execute function public.venues_screen_name_case();


revoke execute on function public.venues_screen_name()      from public, anon, authenticated;
revoke execute on function public.venues_screen_name_case() from public, anon, authenticated;
