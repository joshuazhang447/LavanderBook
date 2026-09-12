-- Tags, and the questions each tag asks.
--
-- A tag says what KIND of place a venue is - a shelter, a crisis service, a
-- community hub - and every tag owns a short questionnaire that only appears on
-- venues carrying it. Someone reviewing a shelter gets asked about curfews and
-- beds; someone reviewing a cafe does not.
--
-- What is deliberately NOT here: the bullet points an admin writes about a
-- specific venue. Those belong to the venue, not to the tag - two shelters carry
-- the same tag and the same questions but entirely different notes. They land in
-- their own migration as public.venue_notes.
--
-- See docs/tag-system-design.md for the whole picture.
--
-- ---------------------------------------------------------------------------
-- The rule this schema exists to enforce
-- ---------------------------------------------------------------------------
--
-- A QUESTION BECOMES IMMUTABLE THE MOMENT IT HAS AN ANSWER.
--
-- Editing "Is there step-free access?" into "Is there a ramp?" in place would
-- silently rewrite the meaning of every answer already given. The answers would
-- still be there, still counted, now attached to a question nobody was asked.
--
-- So public.review_answers is created here rather than with the review-writing
-- work, even though nothing writes to it yet: its foreign key to questions
-- carries no ON DELETE clause, and that single omission is what makes an
-- answered question undeletable. Shipping the questions without it would leave
-- the rule as a comment instead of a constraint.


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

-- Chips need to be told apart at a glance, and the app's theme is otherwise
-- entirely greyscale, so these are the first real colours in it. Named by hue
-- rather than by purpose: a colour outlives the tag that first used it, and
-- `color = 'shelter'` on some future nightlife tag would read as a bug.
--
-- Hues live in src/global.css as --tag-<colour> / --tag-<colour>-fg pairs, with
-- a dark variant for each. Nothing stores a hex; this enum stores the name and
-- the stylesheet owns the value.
--
-- 340-10 degrees is deliberately absent - that is --destructive, and a tag chip
-- that looks like the "Banned" badge sitting next to it in the reviews queue is
-- a misreading waiting to happen.
--
-- Reserved for later, unclaimed: yellow (60), emerald (120), blue (250).
-- Note for whoever adds one: ALTER TYPE ... ADD VALUE cannot be used in the same
-- transaction that adds it, so a new colour needs its own migration before the
-- migration that uses it.
create type public.tag_color as enum (
  'orange',   --  18  crisis
  'amber',    --  45  food and essentials
  'lime',     --  85  youth
  'green',    -- 150  affirming healthcare
  'teal',     -- 182  mental health
  'sky',      -- 205  trans healthcare
  'indigo',   -- 235  legal aid
  'violet',   -- 265  shelter
  'purple',   -- 295  community hub
  'pink'      -- 325  support group
);

-- The answer control a question renders. Fourteen kinds, because the useful
-- question at a shelter ("what time is the curfew?") and the useful question at
-- a clinic ("how long is the waitlist?") want genuinely different inputs, and
-- forcing either into a text box loses the ability to aggregate it.
create type public.question_kind as enum (
  -- Two toggles, not one. 'yes_no_unsure' matches the reasoning already written
  -- into public.answer: for a safety directory, a reviewer who never checked
  -- must not be recorded as reporting "no". Guessed data is worse than absent
  -- data. Use plain 'yes_no' only where not knowing is impossible.
  'yes_no',            -- Yes / No
  'yes_no_unsure',     -- Yes / No / Not sure

  'single_select',     -- one of a list        (radio group / segmented buttons)
  'multi_select',      -- any number of a list (checkbox list / chips)

  'scale',             -- min..max slider with labelled ends
  'rating',            -- stars, reusing the existing StarRating control

  'number',            -- integer or decimal, optional unit  ("12 beds")
  'currency',          -- an amount plus a currency code      ("$15")
  'duration',          -- an amount plus a time unit          ("6 weeks")

  'time_of_day',       -- a clock time                        ("11pm curfew")
  'time_range',        -- an opening window                   ("9am - 5pm")
  'date',              -- a calendar date

  'short_text',        -- one line
  'long_text'          -- a paragraph
);


-- ---------------------------------------------------------------------------
-- Config validation
-- ---------------------------------------------------------------------------

-- Kind-specific settings live in questions.config as jsonb rather than as
-- columns, because every kind would otherwise add three nullable columns that
-- mean nothing to the other thirteen. The cost of that choice is that nothing
-- checks the shape - so this does.
--
-- It validates the invariants that would actually break a control at render
-- time (a scale with no bounds, a max below a min, a step of zero) and the types
-- of the keys it knows. It does NOT reject unknown keys: config will grow, and a
-- validator that has to be edited before any new setting can be tried is a
-- validator people route around.
--
-- immutable so a CHECK constraint may call it. Note that changing this function
-- later does NOT re-validate rows already stored.
create or replace function public.question_config_valid(
  p_kind public.question_kind,
  p_config jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with c as (select coalesce(p_config, '{}'::jsonb) as j)
  select jsonb_typeof((select j from c)) = 'object' and (select
    case p_kind

      when 'number' then
            (not j ? 'min'  or jsonb_typeof(j -> 'min')  = 'number')
        and (not j ? 'max'  or jsonb_typeof(j -> 'max')  = 'number')
        and (not j ? 'step' or (jsonb_typeof(j -> 'step') = 'number'
                                and (j ->> 'step')::numeric > 0))
        and (not j ? 'unit' or jsonb_typeof(j -> 'unit') = 'string')
        and (not (j ? 'min' and j ? 'max')
             or (j ->> 'min')::numeric <= (j ->> 'max')::numeric)

      -- A slider with no ends cannot be drawn, so these two are required.
      when 'scale' then
            jsonb_typeof(j -> 'min') = 'number'
        and jsonb_typeof(j -> 'max') = 'number'
        and (j ->> 'min')::numeric < (j ->> 'max')::numeric
        and (not j ? 'min_label' or jsonb_typeof(j -> 'min_label') = 'string')
        and (not j ? 'max_label' or jsonb_typeof(j -> 'max_label') = 'string')

      when 'rating' then
        (not j ? 'max' or (jsonb_typeof(j -> 'max') = 'number'
                           and (j ->> 'max')::numeric between 3 and 10))

      when 'currency' then
        -- ISO 4217. Stored per question rather than per answer: a venue does not
        -- quote two currencies, and asking the reviewer to pick one is noise.
        jsonb_typeof(j -> 'code') = 'string' and j ->> 'code' ~ '^[A-Z]{3}$'

      when 'duration' then
        j ->> 'unit' in ('minutes', 'hours', 'days', 'weeks', 'months')

      when 'multi_select' then
            (not j ? 'min_choices' or (jsonb_typeof(j -> 'min_choices') = 'number'
                                       and (j ->> 'min_choices')::numeric >= 0))
        and (not j ? 'max_choices' or (jsonb_typeof(j -> 'max_choices') = 'number'
                                       and (j ->> 'max_choices')::numeric >= 1))
        and (not (j ? 'min_choices' and j ? 'max_choices')
             or (j ->> 'min_choices')::numeric <= (j ->> 'max_choices')::numeric)

      when 'short_text' then
        (not j ? 'max_length' or (jsonb_typeof(j -> 'max_length') = 'number'
                                  and (j ->> 'max_length')::numeric between 1 and 200))

      when 'long_text' then
        (not j ? 'max_length' or (jsonb_typeof(j -> 'max_length') = 'number'
                                  and (j ->> 'max_length')::numeric between 1 and 2000))

      -- yes_no, yes_no_unsure, single_select, time_of_day, time_range, date take
      -- no settings. Anything passed is ignored rather than refused, so adding a
      -- setting to one of them later is a change to this function alone.
      else true
    end
  from c);
$$;

comment on function public.question_config_valid(public.question_kind, jsonb) is
  'Shape check for questions.config, called from a CHECK constraint. Validates the invariants that would break a control at render time; tolerates unknown keys so config can grow without a migration.';


-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  label       text not null,
  description text,
  color       public.tag_color not null,
  sort_order  integer not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,

  -- The slug is what the client keys behaviour off, so keep it to one shape.
  constraint tags_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint tags_slug_length check (char_length(slug) between 2 and 40),
  constraint tags_label_length check (char_length(label) between 2 and 40),
  constraint tags_description_length
    check (description is null or char_length(description) <= 200)
);

comment on table public.tags is
  'What kind of place a venue is. Each tag owns a questionnaire; a venue may carry several. Tags are archived, never deleted - venue_tags and questions both reference them with ON DELETE RESTRICT, so a tag that has ever been used cannot be removed and take its history with it.';

-- Two live tags in the same colour defeats the point of having colours, and it
-- happens by accident the moment someone adds an eleventh tag to a palette of
-- ten. Refusing it turns that into a deliberate decision: extend tag_color
-- first. Archived tags are exempt so a colour is released when a tag retires.
create unique index tags_color_unique_when_live
  on public.tags (color)
  where archived_at is null;

create index tags_live_idx on public.tags (sort_order) where archived_at is null;


-- ---------------------------------------------------------------------------
-- venue_tags
-- ---------------------------------------------------------------------------

create table public.venue_tags (
  venue_id uuid not null references public.venues (id) on delete cascade,
  -- restrict, not cascade: untagging is an admin action with consequences for
  -- what a venue displays. It must not be a side effect of tidying a tag list.
  tag_id   uuid not null references public.tags (id) on delete restrict,
  -- Who applied it. A tag changes what the app asks and shows, so it is worth
  -- being able to ask who decided.
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (venue_id, tag_id)
);

comment on table public.venue_tags is
  'Which tags a venue carries. The primary key is (venue_id, tag_id), so applying a tag twice is a no-op rather than a duplicate.';

-- The reverse lookup - every venue carrying this tag - which the map and the
-- Tags section both need and which the primary key cannot serve.
create index venue_tags_tag_idx on public.venue_tags (tag_id);


-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  tag_id        uuid not null references public.tags (id) on delete restrict,
  prompt        text not null,
  -- Optional clarification under the prompt. Where "does this place have a
  -- curfew?" needs "we mean a time you must be back inside by", this is where
  -- that goes - rather than growing the prompt until it stops being a question.
  help_text     text,
  kind          public.question_kind not null,
  config        jsonb not null default '{}'::jsonb,
  required      boolean not null default false,
  sort_order    integer not null default 0,

  -- Set on the replacement, pointing back at what it replaced. unique, so a
  -- retired question has at most one successor and the chain cannot fork.
  supersedes_id uuid unique references public.questions (id) on delete restrict,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null,

  constraint questions_prompt_length check (char_length(prompt) between 3 and 200),
  constraint questions_help_length
    check (help_text is null or char_length(help_text) <= 300),
  constraint questions_config_valid
    check (public.question_config_valid(kind, config)),
  constraint questions_no_self_supersede
    check (supersedes_id is null or supersedes_id <> id)
);

comment on table public.questions is
  'One question on one tag''s questionnaire. Immutable once answered: see the header of this migration. Editing an answered question archives it and creates a successor carrying supersedes_id, so the admin panel can always render a stored answer in the wording it was actually given under.';

comment on column public.questions.config is
  'Kind-specific settings, shape-checked by question_config_valid. number: {min,max,step,unit}. scale: {min,max,min_label,max_label} - min and max required. rating: {max}. currency: {code} required, ISO 4217. duration: {unit} required. multi_select: {min_choices,max_choices}. short_text/long_text: {max_length}.';

-- Building one tag's live questionnaire, in order - the single hottest read.
create index questions_live_idx
  on public.questions (tag_id, sort_order)
  where archived_at is null;


create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label       text not null,
  sort_order  integer not null default 0,

  constraint question_options_label_length check (char_length(label) between 1 and 60),
  -- The same choice twice is always a mistake, and an unremarkable one to make
  -- while typing a long list.
  unique (question_id, label)
);

comment on table public.question_options is
  'Choices for single_select and multi_select. Cascades from its question because an option has no meaning without one - but note that the question itself is protected from deletion by review_answers, so this cascade only ever fires for a question nobody has answered.';

create index question_options_question_idx
  on public.question_options (question_id, sort_order);


-- ---------------------------------------------------------------------------
-- review_answers
-- ---------------------------------------------------------------------------
--
-- Nothing writes this yet - submit_review arrives with the review-sheet work.
-- It is created now because its foreign key to questions is what enforces the
-- rule at the top of this file. See that header.

create table public.review_answers (
  review_id        uuid not null references public.reviews (id) on delete cascade,
  -- No ON DELETE clause, deliberately. This is the whole mechanism: once a row
  -- here points at a question, Postgres will refuse to delete that question.
  question_id      uuid not null references public.questions (id),

  value_text       text,
  value_number     numeric,
  value_bool       boolean,
  -- single_select holds exactly one. An array rather than a join table because
  -- an answer is read whole, never queried a choice at a time.
  value_option_ids uuid[],

  answered_at      timestamptz not null default now(),

  primary key (review_id, question_id),
  -- Exactly one value column, so "answered" and "which control was this" can
  -- never disagree.
  constraint review_answers_exactly_one_value check (
    num_nonnulls(value_text, value_number, value_bool, value_option_ids) = 1
  )
);

comment on table public.review_answers is
  'A reviewer''s answer to one tag question. The question_id foreign key carries no ON DELETE clause on purpose - it is what makes an answered question undeletable, and therefore what makes a stored answer permanently readable in the wording it was given under.';

-- Every answer to one question, for the per-question distribution in the Tags
-- section. The primary key leads with review_id and cannot serve this.
create index review_answers_question_idx on public.review_answers (question_id);


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
--
-- All four tables are readable and none is writable. Writes go through the
-- admin functions in the next migration, which check is_admin() themselves -
-- per the second rule in AGENTS.md, an admin capability gets a function rather
-- than a policy, because a policy would grant the whole row.
--
-- On whether tags should be public at all: they have to be. A venue's
-- questionnaire is fetched by anyone writing a review, and "Is there a curfew?"
-- identifies a shelter as plainly as the chip does. Hiding the tag while showing
-- its questions would be theatre, so the honest thing is to show both.

alter table public.tags            enable row level security;
alter table public.venue_tags      enable row level security;
alter table public.questions       enable row level security;
alter table public.question_options enable row level security;
alter table public.review_answers  enable row level security;

-- Live tags to everyone; archived ones to admins, who need them to read back
-- historical answers.
create policy "Live tags are readable by everyone"
  on public.tags for select
  using (archived_at is null or public.is_admin());

create policy "Venue tags are readable by everyone"
  on public.venue_tags for select
  using (true);

create policy "Live questions are readable by everyone"
  on public.questions for select
  using (archived_at is null or public.is_admin());

-- Not gated on the parent question: an option label on its own discloses
-- nothing the question does not, and the join would cost a subquery per row on
-- the hottest read in the schema.
create policy "Question options are readable by everyone"
  on public.question_options for select
  using (true);

-- Matching reviews, which are already world-readable.
create policy "Review answers are readable by everyone"
  on public.review_answers for select
  using (true);


-- ---------------------------------------------------------------------------
-- Grants (required: this project does not auto-expose new tables)
-- ---------------------------------------------------------------------------

grant select on public.tags             to anon, authenticated;
grant select on public.venue_tags       to anon, authenticated;
grant select on public.questions        to anon, authenticated;
grant select on public.question_options to anon, authenticated;
grant select on public.review_answers   to anon, authenticated;

-- Called only from the CHECK constraint above, which runs as the table owner.
revoke execute on function public.question_config_valid(public.question_kind, jsonb) from public;


-- ---------------------------------------------------------------------------
-- A tagged venue must appear on the map
-- ---------------------------------------------------------------------------
--
-- Both read paths currently end with `review_count > 0`, which was right when a
-- venue had nothing to say until somebody reviewed it. It is now exactly wrong:
-- the entire point of tagging a shelter is that people can find it BEFORE anyone
-- has reviewed it.
--
-- Changed here, in the migration that introduces tags, rather than left for the
-- step that starts using them - with no venue tagged yet this is a no-op, and
-- the alternative is discovering it later as a venue that mysteriously will not
-- appear.

create or replace function public.venues_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision default 200,
  p_limit integer default 60
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  google_place_id text,
  distance_meters double precision,
  review_count bigint,
  avg_stars numeric,
  latest_review_body text,
  latest_review_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with box as (
    select
      p_radius_meters / 111320.0 as dlat,
      p_radius_meters / (111320.0 * greatest(cos(radians(p_lat)), 0.01)) as dlng
  )
  select
    v.id,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id,
    d.meters as distance_meters,
    vr.review_count,
    vr.avg_stars,
    lr.body as latest_review_body,
    lr.created_at as latest_review_at
  from public.venues v
  cross join box b
  join public.venue_ratings vr on vr.venue_id = v.id
  left join lateral (
    select r.body, r.created_at
    from public.reviews r
    where r.venue_id = v.id
    order by r.created_at desc, r.id desc
    limit 1
  ) lr on true
  cross join lateral (
    select 6371000.0 * 2 * asin(sqrt(
      power(sin(radians(v.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(v.lat))
      * power(sin(radians(v.lng - p_lng) / 2), 2)
    )) as meters
  ) d
  where v.lat is not null
    and v.lng is not null
    and v.lat between p_lat - b.dlat and p_lat + b.dlat
    and v.lng between p_lng - b.dlng and p_lng + b.dlng
    and d.meters <= p_radius_meters
    -- We draw our own box where we have something to say. A review is one way to
    -- have something to say; being tagged is now the other.
    and (
      vr.review_count > 0
      or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
    )
  order by d.meters
  limit p_limit;
$$;

create or replace function public.venues_search(
  p_query text,
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 40
)
returns table (
  id uuid,
  name text,
  lat double precision,
  lng double precision,
  google_place_id text,
  distance_meters double precision,
  review_count bigint,
  avg_stars numeric,
  latest_review_body text,
  latest_review_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    v.id,
    v.name,
    v.lat,
    v.lng,
    v.google_place_id,
    d.meters as distance_meters,
    vr.review_count,
    vr.avg_stars,
    lr.body as latest_review_body,
    lr.created_at as latest_review_at
  from public.venues v
  join public.venue_ratings vr on vr.venue_id = v.id
  left join lateral (
    select r.body, r.created_at
    from public.reviews r
    where r.venue_id = v.id
    order by r.created_at desc, r.id desc
    limit 1
  ) lr on true
  cross join lateral (
    select case
      when v.lat is null or v.lng is null then null::double precision
      else 6371000.0 * 2 * asin(sqrt(
        power(sin(radians(v.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(v.lat))
        * power(sin(radians(v.lng - p_lng) / 2), 2)
      ))
    end as meters
  ) d
  where (
      vr.review_count > 0
      or exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
    )
    and v.name ilike '%' || p_query || '%'
  order by d.meters asc nulls last
  limit p_limit;
$$;


-- ---------------------------------------------------------------------------
-- The starting tags
-- ---------------------------------------------------------------------------
--
-- Ten, chosen by one test: does it need its own questionnaire? A tag that would
-- ask the same things as another tag is a label, not a tag. Questions are
-- deliberately NOT seeded - writing them is the organisers' job, and a default
-- set would be answered before anyone decided it was right.
--
-- sort_order runs by urgency rather than alphabetically: someone opening this
-- list in a hurry is looking for the top of it.
--
-- Not included, on purpose: a "gender-neutral bathroom" tag. That is a facility
-- attribute, not a kind of place, and reviews.trans_bathroom already collects it
-- from visitors. As a tag it would put an admin's assertion and a visitor's
-- report in the same visual slot.

insert into public.tags (slug, label, description, color, sort_order) values
  ('crisis',           'Crisis support',
   'Immediate help in a crisis, by phone or in person.',                'orange', 1),
  ('shelter',          'Shelter',
   'Emergency or short-term accommodation that takes LGBTQ+ people.',   'violet', 2),
  ('food',             'Food & essentials',
   'Free or low-cost food, clothing and other basics.',                 'amber',  3),
  ('healthcare',       'Affirming healthcare',
   'General healthcare from staff who are competent and affirming.',    'green',  4),
  ('trans-healthcare', 'Trans healthcare',
   'Gender-affirming care - hormones, referrals, surgical pathways.',   'sky',    5),
  ('mental-health',    'Mental health',
   'Counselling, therapy and psychiatric support.',                     'teal',   6),
  ('youth',            'Youth service',
   'Services specifically for LGBTQ+ young people.',                    'lime',   7),
  ('legal',            'Legal aid',
   'Help with name changes, discrimination, asylum and housing.',       'indigo', 8),
  ('hub',              'Community hub',
   'A space to drop into - events, groups, company.',                   'purple', 9),
  ('support-group',    'Support group',
   'Regular peer support meetings.',                                    'pink',  10)
on conflict (slug) do nothing;
