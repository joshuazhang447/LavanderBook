-- How to reach a place: its website, phone, text line, email and a few other
-- links, kept as data rather than written into its notes.
--
-- Until now a contact lived inside a note's prose ("Phone 613-563-4818 to
-- check...") and the app found it with linkify. That works for reading, but a
-- place's card cannot offer "Call" or "Website" as a button when the number is
-- somewhere in a sentence, an admin cannot tell which places have no way to
-- reach them, and a changed number has to be hunted down in prose. So:
--
--   venue_contacts   one row per way to reach the place, in the order shown
--     kind           website | phone | text | email | link
--     value          an https URL, a phone number as written, or an address
--     label          optional: "Toll-free", "Trans ID Clinic", "Instagram"
--
-- Public, like the notes: a contact is published to be used. No time columns
-- are granted (AGENTS.md, Hidden dates rule 3) and the table is not in the
-- realtime publication.
--
-- Written only through admin_set_venue_contacts, which replaces a place's whole
-- list in one statement. Nothing references a contact and nothing is counted
-- from one, so replacing is as safe as editing, and it keeps the panel's form
-- to one save: what the admin sees is what is stored, in that order.
--
-- An organisation's own published contacts only. Never a private person's
-- number or address - the same rule as the notes (.claude/skills/city-directory).


create table public.venue_contacts (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  kind       text not null,
  value      text not null,
  label      text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,

  constraint venue_contacts_kind
    check (kind in ('website', 'phone', 'text', 'email', 'link')),
  constraint venue_contacts_value_length
    check (char_length(value) between 3 and 300),
  constraint venue_contacts_label_length
    check (label is null or char_length(label) between 1 and 40),

  -- What each kind must look like, so the app can hand it straight to the
  -- browser, the dialler or the mail app. Phone and text: 10 or 11 digits,
  -- North American, as every place listed so far is; widen it with the list.
  constraint venue_contacts_value_shape check (
    case kind
      when 'website' then value ~ '^https?://[^\s]+\.[^\s]+$'
      when 'link'    then value ~ '^https?://[^\s]+\.[^\s]+$'
      when 'email'   then value ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
      else value ~ '^\+?[0-9 ().-]+$'
        and char_length(regexp_replace(value, '[^0-9]', '', 'g')) between 10 and 11
    end
  ),
  -- A link with no words is just a URL; say what it is.
  constraint venue_contacts_link_label
    check (kind <> 'link' or label is not null)
);

comment on table public.venue_contacts is
  'How to reach a place: its own website, phone, text line, email and up to a few labelled links, in display order. Admin-written through admin_set_venue_contacts; public to read. Organisations'' published contacts only, never a person''s.';

create index venue_contacts_venue_idx on public.venue_contacts (venue_id, sort_order);

alter table public.venue_contacts enable row level security;

create policy "Venue contacts are readable by everyone"
  on public.venue_contacts for select
  using (true);

-- Named columns: updated_at and updated_by are the panel's business.
grant select (id, venue_id, kind, value, label, sort_order)
  on public.venue_contacts to anon, authenticated;


/*
 * Replace a place's contacts with the list given, in that order.
 *
 * p_contacts is a JSON array of { kind, value, label? }. Each value is tidied
 * before it is checked: surrounding space trimmed, a website or link given
 * without a scheme gets https://, an email is lower-cased. An empty array
 * clears the list. The table's constraints are the validation; a bad entry
 * fails the whole call with Postgres's own message, so nothing half-saves.
 */
create or replace function public.admin_set_venue_contacts(p_venue_id uuid, p_contacts jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_entry jsonb;
  v_kind  text;
  v_value text;
  v_label text;
  v_order integer := 0;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if not exists (select 1 from public.venues where id = p_venue_id) then
    raise exception 'no such place' using errcode = 'P0002';
  end if;

  if p_contacts is null or jsonb_typeof(p_contacts) <> 'array' then
    raise exception 'contacts must be a list' using errcode = '22023';
  end if;

  if jsonb_array_length(p_contacts) > 12 then
    raise exception 'a place takes at most 12 contacts' using errcode = '22023';
  end if;

  delete from public.venue_contacts where venue_id = p_venue_id;

  for v_entry in select value from jsonb_array_elements(p_contacts) loop
    v_kind  := lower(btrim(coalesce(v_entry ->> 'kind', '')));
    v_value := btrim(coalesce(v_entry ->> 'value', ''));
    v_label := nullif(btrim(coalesce(v_entry ->> 'label', '')), '');

    if v_kind in ('website', 'link') and v_value !~* '^https?://' then
      v_value := 'https://' || v_value;
    elsif v_kind = 'email' then
      v_value := lower(v_value);
    end if;

    v_order := v_order + 1;
    insert into public.venue_contacts (venue_id, kind, value, label, sort_order, updated_by)
    values (p_venue_id, v_kind, v_value, v_label, v_order, (select auth.uid()));
  end loop;
end;
$$;

comment on function public.admin_set_venue_contacts(uuid, jsonb) is
  'Admin only: replaces a place''s contacts with the given list of {kind, value, label}, in that order. Websites without a scheme get https://; an empty list clears them.';

revoke execute on function public.admin_set_venue_contacts(uuid, jsonb) from public;
grant execute on function public.admin_set_venue_contacts(uuid, jsonb) to authenticated;


-- To check afterwards (read-only): every listed place and how it can be reached.
--
--   select v.name, c.kind, c.label, c.value
--   from public.venues v
--   left join public.venue_contacts c on c.venue_id = v.id
--   where exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
--   order by v.name, c.sort_order;
