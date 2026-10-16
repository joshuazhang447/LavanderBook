-- Terms say whether they can be deleted.
--
-- admin_delete_term refuses a term that any review's screening or any queue
-- item still names - a past decision included - so the history of what was
-- held and why keeps making sense (20261016100400). The panel decided whether
-- to offer Delete from review_count alone, the reviews matching the term right
-- now. A term whose only trace is a closed item (the review since edited or
-- deleted) read "Matched 0 reviews", offered Delete, and was refused.
--
-- in_use is the delete function's own test, so the two cannot disagree again.

-- Dropped rather than replaced: a new column changes the return type.
drop function if exists public.admin_list_terms(boolean);

create function public.admin_list_terms(p_include_archived boolean default true)
returns table (
  id              uuid,
  term            text,
  language        text,
  tier            text,
  category        text,
  match_mode      text,
  allow           text[],
  note            text,
  archived_at     timestamptz,
  created_at      timestamptz,
  created_by_name text,
  updated_at      timestamptz,
  -- Reviews it matched at their last scan, and how many of those are held now.
  review_count    bigint,
  held_count      bigint,
  -- Named by any screening or queue item, past ones included: archive, never delete.
  in_use          boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
  #variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
  select
    t.id,
    t.term,
    t.language,
    t.tier,
    t.category,
    t.match_mode,
    t.allow,
    t.note,
    t.archived_at,
    t.created_at,
    cp.display_name,
    t.updated_at,
    (select count(*) from public.review_screening s where t.id = any(s.hits)),
    (select count(*)
       from public.review_screening s
       join public.reviews r on r.id = s.review_id
      where t.id = any(s.hits) and r.moderation = 'held'),
    -- The same test admin_delete_term applies.
    exists (select 1 from public.review_screening s where t.id = any(s.hits) or t.id = any(s.cleared))
      or exists (select 1 from public.moderation_cases c where t.id = any(c.term_ids))
  from public.moderation_terms t
  left join public.profiles cp on cp.id = t.created_by
  where coalesce(p_include_archived, true) or t.archived_at is null
  order by t.archived_at nulls first, t.tier, lower(t.term), t.id;
end;
$$;

comment on function public.admin_list_terms(boolean) is
  'The word list with how many reviews each term matched, how many of those are held, and whether anything still names it (then it can only be archived). Admin only.';

-- Postgres grants EXECUTE to PUBLIC by default, which would include anon. The
-- drop took the old grants with it.
revoke execute on function public.admin_list_terms(boolean) from public, anon;
grant execute on function public.admin_list_terms(boolean) to authenticated;
