-- A tag's icon: which of the app's symbols its places are drawn with - the pin
-- on the map, the row and badge in the Directory.
--
-- Until now the symbol came from the tag's slug, through a table in the app's
-- code: a tag added later drew a plain tag symbol until someone changed the
-- code. Now an admin picks one, from the tag's window in the panel.
--
--   tags.icon   the key of one of the app's curated symbols (src/lib/kind-icons.ts),
--               kebab-case, or null for the slug's default
--
-- The symbols themselves are in the app, not here: each one is drawn three
-- ways (Lucide, Apple's SF Symbols, Google's Material Symbols) and has to look
-- right in every skin, which an uploaded picture cannot. The column holds a key
-- and the database checks only its shape, so a newer app can offer more
-- symbols without a migration; an app that does not know a key draws the
-- tag's default.
--
-- Public, like the rest of a tag. Read from the tags table rather than added
-- to venues_near and friends: one small query per session gives every screen
-- every tag's icon, and none of those functions had to change.
--
-- Written only through admin_set_tag_icon. Nothing else changes.


alter table public.tags
  add column icon text;

alter table public.tags
  add constraint tags_icon_shape
  check (icon is null or (icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(icon) <= 40));

comment on column public.tags.icon is
  'Key of the symbol the app draws this kind with (src/lib/kind-icons.ts). Null: the slug''s default, else a plain tag. Set through admin_set_tag_icon.';

-- tags is granted by column (20261008090000), so a new column is not readable
-- until it is named here.
grant select (icon) on public.tags to anon, authenticated;


-- The kinds there are keep the symbols they have been drawn with: the same
-- keys the app's slug table gives them. Dangerous, which had none, gets the
-- warning triangle: it marks a warning, not a resource. Only where nothing is
-- set, so running this again changes nothing.
update public.tags t
set icon = d.icon
from (values
  ('dangerous',        'triangle-alert'),
  ('crisis',           'life-buoy'),
  ('shelter',          'bed-double'),
  ('food',             'shopping-basket'),
  ('healthcare',       'stethoscope'),
  ('trans-healthcare', 'heart-pulse'),
  ('mental-health',    'brain'),
  ('youth',            'sprout'),
  ('legal',            'scale'),
  ('hub',              'door-open'),
  ('support-group',    'messages-square'),
  ('nightlife',        'martini'),
  ('queer-owned',      'store'),
  ('sexual-health',    'shield-plus'),
  ('online',           'globe')
) as d(slug, icon)
where t.slug = d.slug
  and t.icon is null;


/*
 * Set a tag's icon, or clear it with null for the slug's default.
 *
 * The key is lower-cased and trimmed, and the column's check is the
 * validation: whether the app knows the key is the app's business, since an
 * older app falls back and a newer one may know more.
 */
create or replace function public.admin_set_tag_icon(p_tag_id uuid, p_icon text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  update public.tags
  set icon = nullif(lower(btrim(coalesce(p_icon, ''))), '')
  where id = p_tag_id;

  if not found then
    raise exception 'no such tag' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_set_tag_icon(uuid, text) is
  'Admin only: sets the symbol a tag''s places are drawn with (a key from the app''s icon set), or null for the slug''s default.';

revoke execute on function public.admin_set_tag_icon(uuid, text) from public;
grant execute on function public.admin_set_tag_icon(uuid, text) to authenticated;


-- To check afterwards (read-only):
--
--   select slug, label, icon from public.tags order by sort_order;
