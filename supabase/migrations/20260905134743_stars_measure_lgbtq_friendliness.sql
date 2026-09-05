-- Stars now measure LGBTQ friendliness directly, so the separate yes/no/unsure
-- column is redundant: 1 = hostile, 5 = actively welcoming. Whether a venue
-- counts as "friendly" is derived from the average rather than asked twice.

-- The view reads the column being dropped, so it has to go first.
drop view if exists public.venue_ratings;

alter table public.reviews drop column lgbtq_friendly;

comment on column public.reviews.stars is
  'How LGBTQ friendly this place is: 1 = hostile, 5 = actively welcoming. Not a general quality rating.';

-- Every review must state a bathroom answer. With a default, an insert that
-- simply omits the field would silently record "unsure" - which is a real
-- answer a person can choose, not a value the client should be able to skip
-- into. Dropping the default makes omission an error instead.
alter table public.reviews alter column trans_bathroom drop default;

create view public.venue_ratings
with (security_invoker = true)
as
select
  v.id                                                as venue_id,
  count(r.id)                                         as review_count,
  round(avg(r.stars), 2)                              as avg_stars,
  count(*) filter (where r.trans_bathroom = 'yes')    as trans_bathroom_yes,
  count(*) filter (where r.trans_bathroom = 'no')     as trans_bathroom_no,
  count(*) filter (where r.trans_bathroom = 'unsure') as trans_bathroom_unsure
from public.venues v
left join public.reviews r on r.venue_id = v.id
group by v.id;

comment on view public.venue_ratings is
  'avg_stars is the LGBTQ friendliness score. Bathroom counts stay split per answer so the UI can tell "nobody knows" apart from "people say no".';

grant select on public.venue_ratings to anon, authenticated;
