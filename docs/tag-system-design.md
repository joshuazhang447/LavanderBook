# Tags, questionnaires, venue notes and the admin reviews queue — technical design

Written 2026-09-11.

**Status — steps 1 and 2 of §12 are built and applied.** `tags`, `venue_tags`, `questions`,
`question_tags`, `question_options`, `review_answers` and `venue_notes` all exist, seeded
with the ten tags in §12, along with the admin RPCs of §7. Four panel sections are built:
Users, Tags, Custom fields and Places. See `20260911152000_tag_system.sql` and the five
migrations after it.

Two things changed shape along the way and are corrected below: questions became a bank
shared across tags (§10), and tag colour became content rather than schema (§4).
`venues_near` / `venues_search` now also return each venue's tags, so the map can say
*Listed* instead of inventing a rating.

Still proposal: `submit_review`, the reviews queue, and showing notes in the app itself.
Where the built schema differs from what was first proposed here, this document has been
corrected to match what shipped.

## 1. What exists today

- `venues` — one row per place, keyed by our own uuid, deduped on `google_place_id`.
  Name/address/lat/lng are a cache of Google Places, refreshed via `last_synced_at`.
- `reviews` — one per author per venue (`unique (venue_id, author_id)`), carrying
  `stars` (LGBTQ friendliness, 1–5), `trans_bathroom` (`yes|no|unsure`), optional `body`.
- `venue_ratings` — a view aggregating the above per venue.
- `venues_near` / `venues_search` — the map's two read paths. **Both filter
  `review_count > 0`.**
- Admin — `public.admins` + `is_admin()`, every admin call a `security definer` RPC that
  checks it. Panel at `/admin` (web only), Users section built, Reviews section a stub.

## 2. What we are adding

1. **Tags.** An admin searches any place through the existing Places integration and tags
   it — `shelter`, `hub`, and so on. A venue may carry several tags.
2. **Questionnaires.** Each tag owns a short list of admin-defined questions, editable
   without a deploy. Reviewers answer them.
3. **Answers.** A review of a tagged venue also answers that tag's questions. Untagged
   venues are unchanged: stars, bathroom, body.
4. **Venue notes.** A per-venue list of admin-written bullet points, unlimited in number
   and ordered by hand.
5. **Four admin sections** — Users (built), Venues, Tags, Reviews.

### Two kinds of information, deliberately separate

This is the distinction the whole design hangs on, and conflating them would be the easiest
way to get this wrong:

| | Questionnaire answers | Venue notes (bullets) |
| --- | --- | --- |
| Written by | Reviewers, the public | Admins |
| Scope | Identical for every venue carrying the tag | Unique to one venue |
| Shape | Typed, structured, aggregatable | Free text, ordered |
| Meaning | *What visitors report* | *What we assert* |
| Mutability | **Immutable once answered** (§3) | **Freely editable** (§5.3) |

They share exactly one thing — both are gated on the venue being tagged. Beyond that they
do not interact, live in different tables, and are built in different steps.

### What "real time" means here

An admin's change takes effect for the **next** review sheet opened — no deploy, no
release. It does not mutate a form someone already has open. That distinction matters for
§8.

## 3. The governing constraint (questions only)

> **A question becomes immutable the moment it has an answer.**

Editing "Is there step-free access?" into "Is there a ramp?" in place silently rewrites the
meaning of every answer ever given, and turns the admin panel into a machine for displaying
wrong data confidently.

So: an unanswered question may be edited freely. An answered one may only be **superseded**
— archived, with a new question created that points back at it. The old row is never
updated.

This is enforced at the schema level, not by convention: `review_answers.question_id` is a
plain foreign key with no `on delete cascade`, so an answered question cannot be deleted,
and the revise RPC (§7) is the only thing that writes questions.

**This rule does not apply to venue notes.** Nothing points at a note; correcting one is
the whole point of having them. See §5.3.

## 4. Schema

```sql
-- Fourteen, because the useful question at a shelter ("what time is the
-- curfew?") and the useful question at a clinic ("how long is the waitlist?")
-- want genuinely different inputs, and forcing either into a text box loses the
-- ability to aggregate it.
create type public.question_kind as enum (
  'yes_no', 'yes_no_unsure',               -- two toggles, see below
  'single_select', 'multi_select',
  'scale', 'rating',
  'number', 'currency', 'duration',
  'time_of_day', 'time_range', 'date',
  'short_text', 'long_text'
);

create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- 'shelter'
  label       text not null,                 -- 'Shelter'
  description text,
  color       text not null,                 -- '#6D0FF0'
  text_color  text,                          -- null = computed
  sort_order  int  not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
```

### Colour is content, not schema

This started as a `tag_color` enum of ten hues plus a unique index so no two live
tags shared one. Between them those capped the system at **ten tags forever** — an
eleventh needed `ALTER TYPE ... ADD VALUE`, which needs a migration, which needs a
developer. Wrong constraint, wrong place, for a system whose premise is that organisers
add categories without waiting on code. Replaced in
`20260911160000_tag_colour_freeform.sql`.

What the enum was really protecting was legibility. That protection moved rather than
vanished: a tag stores **one** colour and `src/lib/tag-colors.ts` derives the other three,
**solving for a text lightness that clears WCAG 4.5:1** rather than trusting a fixed one.
Perceived lightness varies enormously by hue — a fixed value passes for some and fails
badly for others — so solving for it is what makes an unreadable chip unreachable by
accident. Verified across the ten presets plus pure yellow, cyan, green, blue, white,
black and mid-grey: worst case 4.54:1 in light, 4.55:1 in dark.

Two modes, answering two different intentions:

- **Automatic** (`text_color` null) — the stored colour is a hue, rendered as a pale tint
  in light and a deep one in dark, text solved per theme. *Make this look right.*
- **Manual** (`text_color` set) — both colours used exactly as given, identical in both
  themes. *Do what I said.* The background stops being tinted, because someone who typed a
  text colour meant it to sit on the colour they picked, not a pale derivative.

The chip uses inline `style`, which is the documented exception rather than an oversight:
Tailwind cannot emit a class for a string it has never seen, so `bg-[${color}]` is
invisible to the scanner and renders nothing — the same trap as `bg-tag-${slug}`.

```sql
create table public.venue_tags (
  venue_id uuid not null references public.venues (id)   on delete cascade,
  -- restrict, not cascade: untagging is an admin action with consequences for
  -- what a venue displays, never a side effect of tidying a tag list.
  tag_id   uuid not null references public.tags (id)     on delete restrict,
  added_by uuid          references public.profiles (id),  -- audit: which admin
  added_at timestamptz not null default now(),
  primary key (venue_id, tag_id)
);

-- A question belongs to no tag, one, or many - see question_tags below. It
-- carries no tag_id and no sort_order of its own: position is a property of a
-- question WITHIN a tag, and a shared question sits differently in each.
create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  prompt        text not null,
  kind          public.question_kind not null,
  -- kind-specific: {min,max,step,unit} for number/scale, {max_length} for text,
  -- {min_label,max_label} for scale. Deliberately not columns - every kind would
  -- add three nullable ones that mean nothing to the other six.
  config        jsonb not null default '{}',
  required      boolean not null default false,
  sort_order    int not null default 0,
  supersedes_id uuid references public.questions (id),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id)
);

-- The bank, wired to the tags that ask from it. Both sides cascade: deleting a
-- tag drops its assignments and the questions survive, so nothing is lost and
-- refusing would only be obstruction.
create table public.question_tags (
  question_id uuid not null references public.questions (id) on delete cascade,
  tag_id      uuid not null references public.tags (id)      on delete cascade,
  sort_order  integer not null default 0,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (question_id, tag_id)
);

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label       text not null,
  sort_order  int  not null default 0
);

create table public.review_answers (
  review_id        uuid not null references public.reviews (id) on delete cascade,
  -- No cascade, deliberately: this FK is what makes an answered question undeletable.
  question_id      uuid not null references public.questions (id),
  value_text       text,
  value_number     numeric,
  value_bool       boolean,
  value_option_ids uuid[],            -- single_select holds exactly one
  answered_at      timestamptz not null default now(),
  primary key (review_id, question_id),
  constraint review_answers_exactly_one_value check (
    num_nonnulls(value_text, value_number, value_bool, value_option_ids) = 1
  )
);

-- Admin-written bullet points about one specific venue.
create table public.venue_notes (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  body       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  -- A bullet is a bullet. Long enough for a real fact, short enough that the
  -- venue sheet cannot be turned into an essay by one paste.
  constraint venue_notes_body_length check (char_length(body) between 1 and 280)
);

create index venue_notes_venue_idx on public.venue_notes (venue_id, sort_order);

-- Reuse the trigger function reviews already uses rather than adding a second one.
create trigger venue_notes_set_updated_at
  before update on public.venue_notes
  for each row execute function public.set_updated_at();

alter table public.reviews add column hidden_at timestamptz;
```

Further indexes: `review_answers (question_id)` for distributions, `venue_tags (tag_id)`
for "every venue with this tag", and a partial `questions (tag_id) where archived_at is
null` for building a questionnaire.

**Option labels have the same problem as prompts.** Renaming "Sometimes" to "Occasionally"
on an answered question rewrites history exactly as editing the prompt would, so options
are immutable on the same terms — changing one supersedes the whole question.

### Notes are scoped to the venue, not to (venue, tag)

The workflow is "tag it, open it, write bullets", and nothing in that suggests the author
is thinking per-tag. A flat ordered list per venue is simpler to write, simpler to read,
and matches what was asked for.

If per-tag grouping is ever wanted, the additive fix is a nullable `tag_id` on
`venue_notes` — null meaning a general note, set meaning it renders under that tag's
heading. One migration, no client change, no data rewrite. Do not build it now.

### Why answers are relational rather than `reviews.custom_answers jsonb`

A blob is faster to write and makes every read expensive: the answer filter (§5.4), the
per-question distribution, and any aggregate ("7 of 9 said there is a curfew") all become
application-side scans over every review. It also gives up the foreign key that enforces
§3. The join cost is trivial at this scale; the lost integrity is not recoverable later.

### Kind → column

| Kind | Column | Config |
| --- | --- | --- |
| `yes_no` | `value_bool` | — |
| `yes_no_unsure` | `value_answer` (`public.answer`) | — |
| `single_select` | `value_option_ids` (exactly one) | — |
| `multi_select` | `value_option_ids` | `min_choices`, `max_choices` |
| `scale` | `value_number` | `min`, `max` **required**, `min_label`, `max_label` |
| `rating` | `value_number` | `max` (3–10) |
| `number` | `value_number` | `min`, `max`, `step`, `unit` |
| `currency` | `value_number` | `code` **required**, ISO 4217 |
| `duration` | `value_number` | `unit` **required** |
| `time_of_day` | `value_text` as `HH:MM` | — |
| `time_range` | `value_text` as `HH:MM-HH:MM` | — |
| `date` | `value_text` as `YYYY-MM-DD` | — |
| `short_text` | `value_text` | `max_length` (≤200) |
| `long_text` | `value_text` | `max_length` (≤2000) |

**Two toggles, not one.** `yes_no_unsure` reuses `public.answer` and exists for the reason
already written into the initial schema: for a safety directory, a reviewer who never
checked the bathroom must not be recorded as reporting "no". Null already means *not
answered*; "answered, but they did not know" is a different and equally real thing.
`yes_no` is for the rare question where not knowing is impossible.

**Times and dates are ISO-8601 text**, not three more nullable columns. `HH:MM` and
`YYYY-MM-DD` sort and compare correctly as text, and three more columns would repeat
exactly the problem `config` jsonb exists to avoid.

`config` is shape-checked in the database by `question_config_valid`, called from a CHECK
constraint on `questions`. A CHECK cannot reach another table, so kind↔column agreement and
"these option ids belong to this question" are validated in `submit_review` (§8) instead.

> **A CHECK constraint treats NULL as a pass.** The first version of that validator
> returned NULL rather than false for a missing required setting — `jsonb_typeof(j->'min')
> = 'number'` is NULL when the key is absent, and NULL propagates through the whole AND
> chain — so a `scale` question with no bounds, the precise thing it was written to catch,
> would have been stored happily and then failed to render. Any predicate built from jsonb
> lookups must end in `coalesce(..., false)`. Fixed in
> `20260911153000_question_config_valid_null_is_not_valid.sql`.

## 5. The admin panel

### 5.1 Sections

The nav gains two entries beside the built Users section:

| Section | Does |
| --- | --- |
| **Users** | Built — search, filter, ban |
| **Venues** | Search any place, tag it, open it, write its bullets |
| **Tags** | Manage tags, edit their questions, see answer distributions |
| **Reviews** | The moderation queue |

### 5.2 Venues section

A search box over the existing `places-search` edge function, plus a list of venues we
already hold. Selecting a result opens **venue detail**, which is where both admin-authored
things live:

```
┌────────────────────────────────────────────────┐
│ Le Prince Shawarma                             │
│ 123 Somewhere St · 4 reviews · ★★★★☆           │
│                                                │
│ Tags   [shelter ×] [hub ×]  [+ add tag]        │
│                                                │
│ Notes                                          │
│  ⠿ • Open 24 hours, staffed overnight     ✎ ✕  │
│  ⠿ • Accessible entrance on the side door ✎ ✕  │
│  ⠿ • Ask for Marie at reception           ✎ ✕  │
│  [+ add a bullet]                              │
│                                                │
│ Questionnaire preview (shelter, hub)  ▸        │
│ Reviews (4)                           ▸        │
└────────────────────────────────────────────────┘
```

- Tagging a Places result that we do not hold yet creates the `venues` row first, from the
  `google_place_id`, inside the same RPC.
- `⠿` is a drag handle. Reordering rewrites `sort_order` for the whole list in one
  statement:

```sql
-- inside admin_reorder_venue_notes(p_venue_id uuid, p_ids uuid[])
update public.venue_notes n
   set sort_order = o.ord
  from unnest(p_ids) with ordinality as o(id, ord)
 where n.id = o.id and n.venue_id = p_venue_id;
```

  At tens of bullets a full rewrite is cheaper and far simpler than fractional ranking.
  Revisit only if a venue ever carries hundreds.
- The notes editor is offered only for tagged venues, enforced in the RPC and the UI —
  **not** in the schema. See §11.2 for what happens on untagging.

### 5.3 Venue notes are editable; questions are not

Worth stating plainly, because §3 commits hard in the other direction and someone will ask.

A question is a **container**: change its wording and hundreds of stored answers silently
start meaning something else. A note is a **statement we are making ourselves**. Nothing
points at it, nothing is aggregated from it, and if it becomes wrong the correct response
is to fix it.

So notes are edited in place, with `updated_by` and `updated_at` recording who last
touched one. Full revision history is not proposed for v1; if the org wants it, a
`venue_note_revisions` table is additive.

### 5.4 Reviews section

**One table, fixed columns, permanently:**

```
☐ · Venue · Author · Stars · Body excerpt · Tags · Answers · Posted · Status · ⋯
```

`Tags` renders chips; `Answers` is a single integer. That is the entire footprint the
questionnaire system takes in the table, whether there are two tags or fifty.

**Rejected: rendering each tag's questions as columns.** It only works while exactly one
tag is filtered, and it gets worse the more successful the tag system is — ten tags of
eight questions is eighty potential columns. A design that degrades as it succeeds is the
wrong design.

Row click opens a right-hand drawer; the list stays in place on the left.

```
┌──────────────────────────┬───────────────────────────┐
│ reviews list (stays)     │ KeenRobin845  · 2 Sep      │
│  ▸ St. George School     │ Le Prince Shawarma         │
│  ▸ McDonald's            │ ★★★★☆   Bathroom: unsure   │
│  ▪ Le Prince Shawarma ◀──│                            │
│  ▸ …                     │ "Staff were kind…"         │
│                          │ ── shelter ─────────────   │
│                          │ Accepts pets?        No    │
│                          │ Curfew?              11pm  │
│                          │ Beds available?      12    │
│                          │ ⚠ prompt since revised     │
│                          │ [Hide] [Delete]      ‹ ›   │
└──────────────────────────┴───────────────────────────┘
```

- Answers render grouped by tag, each **in the wording that was asked** — a superseded
  question carries a quiet marker, not a silent substitution.
- `‹ ›` steps through the list without closing. Moderation is sequential: check, act, next.
- Author and venue are links; the author link returns to Users filtered to them, closing
  the loop the Users → Posted link already opens. The venue link goes to §5.2.

A drawer over the alternatives: an expanding row shoves the list down and becomes
unreadable with a long questionnaire; a modal hides the queue you are working through.

**Filters** are flat and few at the top — Venue, Author, Tag, Stars, Status, Date. The
answer filter is **tucked**: choosing a tag reveals a Question selector, and choosing a
question reveals a value control typed to its kind. Three controls that are usually absent,
rather than N columns that always are.

### 5.5 Where cross-review comparison went

Scanning answers across many reviews is analytics, not moderation. It belongs in the
**Tags** section as a per-question distribution (`admin_question_distribution`, §7), which
is where you would look for it anyway, and which answers the question better than a column
of raw values would.

## 6. The app side

**Built.** A tagged venue's sheet shows its tag pills beside the name. Tapping one slides to
the **tag page**, which has two sections, in this order, with a rule between them:

1. **What we checked** — *"Written by LavenderBook, not by visitors."* The admin bullets, in
   `sort_order`.
2. **What visitors reported** — *"Answers from N of M reviews. Visitors' own accounts, not
   checked by LavenderBook."* One card per answered question, grouped under the tag that
   currently asks it, each kind summarised its own way (`src/components/answer-summary.tsx`):
   yes/no as the majority word with a split bar and "7 of 9 said yes"; choices as counted
   rows; scales as an average with a small distribution; stars as stars; amounts as a
   median with the range; times and dates as the most common value; free text as the latest
   few, quoted, with the handle they were posted under.

Keeping 1 and 2 visually distinct is a correctness requirement, not decoration — they carry
different authority and a reader must never have to guess which they are looking at. Hence
two headings that each say who is speaking.

**Every tally is out of the people who answered that question, never out of the review
count.** Nothing records what a review was offered when it was written, so "this review
answered 3 of 7" is a number nobody can honestly compute; a review from before a question
existed is not a "no" and not a gap, it is simply absent from that question's denominator.
The coverage line at the top of section 2 is what tells the reader how much of the venue
those tallies speak for.

A question that has been superseded is still shown, under the wording people were actually
asked, marked *earlier wording*. A question nothing here asks any more (the tag was
removed, or the question unassigned) keeps its answers under *No longer asked here*.

The review form, for its part, asks the venue's questions between the bathroom question
and the free text, under *"About this kind of place — because this place is listed as
[Shelter], we ask a few extra questions. Answer what you know and skip the rest."* Required
ones carry a `*` and block posting; free-typed kinds get their format checked inline before
anything is sent.

## 7. RPCs

Every `admin_*` function is `security definer`, `set search_path = ''`, and opens with the
established guard:

```sql
if not public.is_admin() then
  raise exception 'not authorised' using errcode = '42501';
end if;
```

Granted to `authenticated`, because a grant is not finer-grained than a role. The guard is
what refuses. Supabase's linter flags these; that is expected, not an oversight.

| Function | Purpose |
| --- | --- |
| `admin_search_venues(...)` | Venues section list over venues we already hold |
| `admin_set_venue_tags(venue_id_or_place_id, tag_ids[])` | Apply tags, creating the `venues` row from a `google_place_id` if absent |
| `admin_get_venue(venue_id)` | Everything venue detail renders, one round trip |
| `admin_list_venue_notes(venue_id)` | Bullets in order |
| `admin_create_venue_note(venue_id, body)` | Appends at the end |
| `admin_update_venue_note(id, body)` | In-place edit, stamps `updated_by` |
| `admin_delete_venue_note(id)` | Hard delete — nothing references it |
| `admin_reorder_venue_notes(venue_id, ids[])` | The one-statement rewrite in §5.2 |
| `admin_list_tags()` | Tags list, with venue and question counts |
| `admin_upsert_tag(...)` | Create or edit a tag (label/description/colour edit freely — they are not questions) |
| `admin_archive_tag(id)` | Archive; never delete a tag that has been applied |
| `admin_list_questions(tag_id)` | Question editor, active plus optionally archived |
| `admin_create_question(...)` | New question + options |
| `admin_revise_question(id, ...)` | **Edits in place if unanswered, supersedes if answered.** The §3 rule lives here and nowhere else |
| `admin_archive_question(id)` | Stop asking; answers survive |
| `admin_reorder_questions(tag_id, ids[])` | As above |
| `admin_list_reviews(...)` | The queue: fixed columns, `answer_count`, tag chips, `count(*) over ()` total — same shape as `admin_list_profiles` |
| `admin_get_review(review_id)` | Everything the drawer renders, one round trip |
| `admin_set_review_hidden(id, bool)` | Moderation, mirroring `admin_set_banned` |
| `admin_question_distribution(question_id)` | Answer counts for the Tags section |

Public read paths, granted to `anon` + `authenticated`:

- `venue_questionnaire(venue_id)` — `security invoker`. Active questions for the venue's
  tags, grouped by tag.
- `venue_answer_summary(venue_id)` — **`security definer`**, narrowly: the `questions`
  policy hides archived rows from non-admins, and a superseded question is archived, yet
  its answers must be shown under the wording they were given. The function reads that
  wording and exposes only questions with at least one answer at the venue asked about —
  nothing a reader of the public `review_answers` rows could not already infer.
- `venue_notes` — plain `select` policy `using (true)`, **no insert/update/delete policy or
  grant**, exactly as `public.admins` is handled. The RPCs above are the only writers.

And one for signed-in authors, `security invoker`, granted to `authenticated`:

- `my_new_question_count(venue_id)` — how many of the venue's questions were added after
  the caller last saved their review here and are unanswered. Drives the "Answer N new
  questions" button on the sheet; see §11, decision 4.

## 8. Review submission has to become an RPC

A review and its answers must land together or not at all, and today the client inserts
into `reviews` directly under RLS. Two separate client writes can leave a review with half
its answers.

So: `submit_review(p_venue_id, p_stars, p_trans_bathroom, p_body, p_answers jsonb)`.
**Built**, in `20260912040000`, and **`security definer`** — not invoker, as an earlier
draft of this section said. Invoker could not have worked: `authenticated` has no insert
grant on `review_answers`, and must not get one, because a direct PostgREST insert would
skip every check below. The table stays RPC-only; the function restates the two things the
`reviews` policies check (a caller exists, and is not banned) and does everything in one
transaction, so a failed edit never half-applies.

It also resolves the in-flight problem. The client submits the question ids it actually
rendered. The RPC accepts any non-archived question belonging to the venue's current tags
and ignores the rest, rather than rejecting a whole review because an admin added a
question thirty seconds ago. A question archived mid-session simply drops. A *required*
question added mid-session raises `23514` naming it, and the form fetches again so it
appears, marked.

Validation lives here: kind↔column agreement (the question's own kind decides the column;
the client's opinion is never consulted), option ids belonging to the question, `required`
satisfied against what is asked *now*, `config` bounds respected, times and dates in the
formats the table comment fixes. The client mirrors the format rules for the free-typed
kinds so a mistake is pointed out under the field rather than reported as a save failure —
manners, not security.

**What a save rewrites** is deliberately narrow: the answers to the venue's current
questionnaire, plus whatever those questions superseded. Absence from the payload means
"cleared" for those and nothing else — an answer to a question on a tag the venue has since
lost is not the author's to lose by editing their star rating. The supersedes lineage is
included so that answering the successor of a reworded question retires the author's
answer to the old wording; one person, one count.

## 9. What this touches in existing code

1. ~~**`venues_near` and `venues_search` both filter `review_count > 0`.**~~ **Done**, in
   `20260911152000`. But fixing the query only got the venue onto the map; it arrived
   looking wrong. Every renderer used `avg_stars ?? 0`, so a tagged shelter nobody had
   reviewed drew as **`0.0` with `0 reviews`** — not "newly listed" but *rated zero out of
   five*, about a place we had vouched for ourselves. Fixed in four places
   (`venue-marker.tsx`, `venue-map.web.tsx`, `venue-list.tsx`, `venue-sheet.tsx`), which is
   itself the lesson: **an absent rating has to look absent, and `?? 0` is not absent.**
   Both map functions now return `tags` so those renderers can name the tag instead.
2. **`venues` has no UPDATE or DELETE policy**, deliberately. Tagging and notes write to new
   tables so they are unaffected, but any admin edit to a venue's name or address needs its
   own guarded RPC.
3. **`trans_bathroom` stays a column.** It applies to every venue, tagged or not, and it
   feeds `venue_ratings`. Migrating it into the question system would make a universal field
   conditional on a tag. Recommend leaving it; the point is to take that fork deliberately.
4. **Review sheet** gains a questionnaire fetch on open — cacheable, since questions change
   rarely.
5. **Venue sheet** gains notes and the answer summary (§6).
6. **`venue_ratings`** is unaffected.

## 10. Multi-tag venues

A venue tagged both `shelter` and `hub` gets both questionnaires, rendered as two labelled
sections.

**The `question_tags` join table this section once proposed as a later fix is built** — see
`20260911170000_question_bank.sql`. One well-worded question now serves every tag it
applies to, which is what makes its answers comparable across them; writing it once per tag
guaranteed ten slightly different wordings that never could be.

That removes most of the duplication but not all of it: a question genuinely shared by two
of a venue's tags appears once under each. Still **no automatic dedup**, deliberately —
visible duplication is explicable, where a silent merge is not, and the fix is to attach
the shared question to one of the tags rather than both.

Notes are unaffected — one flat list per venue regardless of how many tags it carries.

## 11. Open decisions

1. **Are tags public?** Does a visitor see that a venue is labelled `shelter`, or is that
   internal classification? This decides whether `tags` and `venue_tags` are world-readable,
   and it is a safety question rather than a UI one.
2. **Untagging.** Remove `shelter` from a venue — do the existing answers and notes vanish
   from the venue page, or stay? Recommend keeping the data and gating only display, for
   both, consistently.
3. **Are notes public when tags are not?** They are the useful content, so probably yes even
   if tags are hidden — but that needs confirming rather than assuming.
4. ~~**A `required` question added later** makes every existing review incomplete. Does the
   panel surface that, and do we re-prompt the author?~~ **Settled**, and the premise
   rejected: an old review is never "incomplete", because nothing records what it was
   offered (§6). `required` binds only at write time, so an author editing an old review
   is asked the new questions and nobody who never comes back is. The re-prompt is precise:
   a question is *new to you* when `greatest(question_tags.assigned_at,
   venue_tags.added_at) > reviews.updated_at`, and the sheet's button becomes "Answer N new
   questions". Saving clears it whether or not they answer — skipping an optional question
   is not something to nag about.
5. **Who may tag and write notes** — every admin, or a narrower role? `public.admins` is
   currently flat, and a note is LavenderBook speaking in its own voice.
6. **Note revision history.** `updated_by` alone, or a full audit trail? Safety-critical
   statements may warrant knowing what a bullet said last month.
7. ~~**Free-text answers are user-generated content** and reach every client the moment
   they are written, exactly as `body` does today. Confirm that is acceptable per tag, or
   mark some questions admin-only.~~ **Accepted** as-is: they are shown on the tag page as
   the latest few, quoted, with the handle — the same terms as `body`. Admin-only questions
   can be added later without touching the schema.

Items 1, 3 and 7 needed answering before work started; 1 and 7 are settled above, 3 in
practice (notes are on the public sheet). The rest can be settled as we go.

## 12. Suggested order

1. ~~`tags` + `venue_tags` + the questions schema + the admin RPCs + the `venues_near` /
   `venues_search` fix.~~ **Done** — four migrations, ten tags seeded, no questions seeded
   (writing those is the organisers' job). The UI for it is not built; the functions are.
2. ~~`venue_notes` + the bullet editor.~~ **Done** — the editor lives in the Places
   section rather than a separate venue detail screen. Notes on the public venue sheet are
   still to come; see §6 for why that needs its own pass rather than a line at the end.
3. `questions` + `question_options` + the question editor, including `admin_revise_question`
   and its supersede rule.
4. ~~`review_answers` + `submit_review` + the review sheet rendering questionnaires.~~
   **Done** — plus `venue_answer_summary` and the tag page (§6), which had been step 6's
   public half.
5. The admin Reviews queue: table, drawer, filters, hide.
6. Per-question distributions in the Tags section.

Step 2 is deliberately placed early: it is the smallest independent piece, it has no
dependency on the questionnaire work, and it puts real curated content in front of users
before the harder half begins.
