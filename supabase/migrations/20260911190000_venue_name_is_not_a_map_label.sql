-- A map label is not a name.
--
-- react-native-maps' onPoiClick hands back the POI label exactly as Google drew
-- it on the tile: broken onto however many lines fitted under the icon, and cut
-- short with an ellipsis when it still did not. Tapping St. Clair College on
-- Android stored, literally:
--
--   'St. Clair
--    College of
--    Applied
--    Arts and…'
--
-- which every list then rendered faithfully, four words tall, because
-- react-native-web's Text is white-space: pre-wrap. Four of twenty-four venues
-- arrived that way before a screen existed that showed them side by side.
--
-- The client that captures the POI is fixed too (normalizePlaceName in
-- src/lib/venues.ts), but the trigger is what actually holds the invariant:
-- venues are inserted straight from the client under an RLS policy, so there is
-- no RPC to put this in, and every Android build already on a phone will go on
-- sending wrapped labels for as long as it stays installed. Doing it here means
-- an old client cannot reintroduce it.
--
-- Whitespace only. The ellipsis stays, because the label really was truncated:
-- the rest of that name is not recoverable from the label, and 'Arts and…' at
-- least admits it, where trimming the … would leave a name that looks complete
-- and is wrong.

create or replace function public.normalize_venue_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  return new;
end;
$$;

comment on function public.normalize_venue_name() is
  'Collapses runs of whitespace in venues.name to single spaces. Names arrive from map labels, which are line-wrapped.';

create trigger venues_normalize_name
  before insert or update of name on public.venues
  for each row execute function public.normalize_venue_name();

-- The ones already stored. Written out rather than left to the trigger so this
-- says what it does when read, and so it works in either order.
update public.venues
   set name = btrim(regexp_replace(name, '\s+', ' ', 'g'))
 where name <> btrim(regexp_replace(name, '\s+', ' ', 'g'));
