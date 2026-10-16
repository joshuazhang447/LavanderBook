-- The word list lives in the database, and nowhere else.
--
-- LavenderBook keeps slurs off the map without blocking anybody. A review that
-- uses a word on this list is held until a person has read it, because the
-- same word is how a reviewer says what was shouted at them - and that review
-- is the warning the app exists to carry. 20261016100200 does the holding;
-- this migration is the list and the matching.
--
-- Where the list is kept. Only here, in moderation_terms, edited from the admin
-- panel. Never in git: not in a migration, a seed, a test or a comment. Tests
-- use made-up placeholder words, and the reviewers' working copy is a workbook
-- under docs/, which .git/info/exclude keeps out of the repository. So this
-- file describes the matching and contains no words to match.
--
-- How a word becomes a match.
--
--   * Both sides are folded the same way first (moderation_fold): accents and
--     other decorations come off, fullwidth and "fancy" letters become plain
--     ones, lookalike Cyrillic and Greek letters become the Latin letters they
--     imitate, invisible characters disappear, and everything is lowercased by
--     Unicode's rules rather than the database's locale.
--   * Leetspeak is not folded - it is in the pattern instead. A folded "4"
--     would turn every price and phone number into letters; a pattern letter
--     that also accepts a digit does not.
--   * Each term is compiled once, when it is saved, into a regular expression
--     (moderation_compile). A run of k equal letters must match at least k, so
--     a doubled letter never matches its innocent single-letter twin, and
--     longer stretched spellings still do. A second alternative catches the
--     word spelt out with a separator between every letter.
--   * Three modes: word (the usual: the match must stand alone), prefix (for
--     plurals and endings) and anywhere (for scripts written without spaces,
--     refused for short Latin words, which would match inside other words).
--   * Each term can carry an allowlist of innocent phrases - place names,
--     trades - that never count as a hit for it.
--
-- What a hit does is not decided here. A term is either hold (the review waits
-- for a person) or watch (it publishes, and a person looks later); the review
-- functions read the tier. Nothing in this file writes to reviews.
--
-- Masking. A review a person has published may still quote a hold-tier word.
-- Readers see it masked - its first letter, then one bullet per letter - and
-- can choose to show it. Masks are worked out at read time from the review's
-- stored hits (review_screening), never by scanning the whole list on a public
-- read, and only while the system is enforcing: in shadow mode nothing readers
-- see changes.
--
-- Costs, for whoever touches this next:
--
--   * moderation_fold is part of every stored pattern. Change it and every term
--     must be recompiled (update moderation_terms set term = term) and every
--     review rescanned (admin_rescreen_reviews).
--   * The functions pin the pg_c_utf8 collation, so [[:alnum:]] and lower()
--     mean the same thing whatever the database's default locale is. It exists
--     from PostgreSQL 17; the guard below refuses to run without it.


do $$
begin
  if not exists (select 1 from pg_catalog.pg_collation where collname = 'pg_c_utf8') then
    raise exception 'This migration needs the pg_c_utf8 collation, which PostgreSQL 17 provides.';
  end if;
end
$$;


-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

create table public.moderation_settings (
  -- Exactly one row: the key can only be true.
  id         boolean primary key default true
             constraint moderation_settings_one_row check (id),
  -- False is shadow mode: every hit is recorded and nothing is held or masked.
  enforced   boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.moderation_settings (id) values (true);

comment on table public.moderation_settings is
  'One row. enforced = false is shadow mode: hits are recorded as items in the queue, and nothing is held or masked. Changed only through admin_set_moderation_enforced.';

alter table public.moderation_settings enable row level security;
revoke all on public.moderation_settings from anon, authenticated;

create or replace function public.moderation_enforced()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select s.enforced from public.moderation_settings s where s.id), false);
$$;

comment on function public.moderation_enforced() is
  'Whether hold-tier hits hold reviews and mask words, or are only recorded (shadow mode). Internal.';


-- ---------------------------------------------------------------------------
-- Folding
-- ---------------------------------------------------------------------------

create or replace function public.moderation_fold(p_text text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v text := coalesce(p_text, '');
begin
  -- 1. Compatibility decomposition. Fullwidth and mathematical letters,
  --    circled and superscript letters, ligatures and Arabic presentation
  --    forms become plain letters, and accents come apart from their letters.
  v := normalize(v, NFKD);

  -- 2. Drop the marks that came apart: Latin, Cyrillic, Hebrew and Arabic
  --    combining marks. Not every combining mark - Indic vowel signs and kana
  --    voicing marks change which letter it is, and stay. The Hebrew and
  --    Arabic ranges skip what sits among the marks but is not one: the
  --    Hebrew hyphen (maqaf) and punctuation, Arabic small waw and yeh (which
  --    are letters) and the Quranic symbols.
  v := regexp_replace(v,
    '[̀-ͯ҃-҉֑-ֽֿׁ-ׂׄ-ׇׅؐ-ًؚ-ٰٟۖ-ۜ۟-ۤۧ-۪ۨ-ۭ᪰-᫿᷀-᷿⃐-⃿︠-︯]',
    '', 'g');

  -- 3. Recompose what step 2 left alone (Hangul, kana with voicing marks).
  v := normalize(v, NFC);

  -- 4. Lookalikes, from a subset of Unicode's confusables.txt. Before
  --    lowercasing, so each case maps to the Latin letter it looks like: a
  --    Cyrillic capital EN looks like H, its small letter does not look like h.
  v := translate(v,
    -- Cyrillic capitals, then small letters
    U&'\0410\0412\0415\041A\041C\041D\041E\0420\0421\0422\0425\0423\0405\0406\0408\04AE\051A\051C\04BA\04C0'
    || U&'\0430\0435\043E\0440\0441\0443\0445\0455\0456\0458\04BB\0501\04CF\051B\051D\04AF'
    -- Greek capitals, then small letters
    || U&'\0391\0392\0395\0396\0397\0399\039A\039C\039D\039F\03A1\03A4\03A5\03A7'
    || U&'\03B1\03B2\03B5\03B7\03B9\03BA\03BD\03BF\03C1\03C4\03C5\03C7\03C9'
    -- Small capitals
    || U&'\1D00\0299\1D04\1D05\1D07\0262\029C\026A\1D0A\1D0B\029F\1D0D\0274\1D0F\1D18\0280\A731\1D1B\1D1C\1D20\1D21\028F\1D22'
    -- Latin letters with a stroke, which do not decompose
    || U&'\00F8\00D8\0111\0110\0142\0141\0127\0126\0131\0167\0166',
    'ABEKMHOPCTXYSIJYQWHI' || 'aeopcyxsijhdlqwy'
    || 'ABEZHIKMNOPTYX' || 'abenikvoptuxw'
    || 'abcdeghijklmnoprstuvwyz'
    || 'oOdDlLhHitT');

  -- 5. Lowercase by Unicode's rules, whatever the database's own locale.
  v := lower(v collate "pg_c_utf8");

  -- 6. Characters that print as nothing: soft hyphen, grapheme joiner, the
  --    zero-width spaces and joiners, direction marks and overrides,
  --    invisible operators, variation selectors, the byte order mark and the
  --    Hangul fillers.
  v := regexp_replace(v,
    '[­͏؜ᅟᅠ᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]',
    '', 'g');

  -- 7. Letters that stand for two.
  v := replace(v, U&'\00DF', 'ss');
  v := replace(v, U&'\00E6', 'ae');
  v := replace(v, U&'\0153', 'oe');
  v := replace(v, U&'\00FE', 'th');

  -- 8. Arabic spelling variants: alef wasla to alef, teh marbuta to heh, alef
  --    maksura and Farsi yeh to yeh, keheh to kaf. Tatweel, which only
  --    stretches a word, has no counterpart and is deleted.
  v := translate(v, U&'\0671\0629\0649\06CC\06A9\0640', U&'\0627\0647\064A\064A\0643');

  return v;
end;
$$;

comment on function public.moderation_fold(text) is
  'The form both a term and a review are compared in: decomposed, stripped of accents and invisible characters, lookalike letters mapped to Latin, lowercased by Unicode rules. Leetspeak is left alone - patterns handle it. Changing this means recompiling every term and rescanning every review.';


-- ---------------------------------------------------------------------------
-- Compiling a term
-- ---------------------------------------------------------------------------

-- One letter of a term, as the class of characters that may stand for it.
create or replace function public.moderation_char_class(p_char text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_char
    when 'a' then '[a4@]'
    when 'b' then '[b8]'
    when 'e' then '[e3]'
    when 'g' then '[g69]'
    when 'i' then '[i1!|]'
    when 'l' then '[l1|]'
    when 'o' then '[o0]'
    when 's' then '[s5$]'
    when 't' then '[t7+]'
    when 'z' then '[z2]'
    -- A backslash before any other non-alphanumeric character makes it literal.
    else case when p_char collate "pg_c_utf8" ~ '^[[:alnum:]]$' then p_char else '\' || p_char end
  end;
$$;

comment on function public.moderation_char_class(text) is
  'The regular-expression piece for one character of a folded term: a letter with its common leetspeak stand-ins, or the character itself, escaped. Internal.';

create or replace function public.moderation_compile(p_folded text, p_mode text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_term    text := btrim(regexp_replace(coalesce(p_folded, ''), '\s+', ' ', 'g'));
  v_chars   text[];
  v_n       integer;
  v_i       integer := 1;
  v_run     integer;
  v_c       text;
  v_compact text := '';
  v_body    text;
begin
  if v_term = '' then
    return null;
  end if;

  v_chars := regexp_split_to_array(v_term, '');
  v_n := cardinality(v_chars);

  -- The word as written: each run of k equal characters must match at least k
  -- times, and a space between words is any run of non-letters.
  while v_i <= v_n loop
    v_c := v_chars[v_i];
    v_run := 1;
    while v_i + v_run <= v_n and v_chars[v_i + v_run] = v_c loop
      v_run := v_run + 1;
    end loop;

    if v_c = ' ' then
      v_compact := v_compact || '[^[:alnum:]]+';
    else
      v_compact := v_compact || public.moderation_char_class(v_c)
        || case when v_run = 1 then '+' else '{' || v_run || ',}' end;
    end if;

    v_i := v_i + v_run;
  end loop;

  -- The word spelt out with something between every letter. Only for a single
  -- word of three characters or more: shorter, and two unrelated one-letter
  -- words in a row would match.
  if position(' ' in v_term) = 0 and v_n >= 3 then
    v_body := '(?:' || v_compact || '|'
      || array_to_string(array(
           select public.moderation_char_class(c) || '+'
           from unnest(v_chars) with ordinality as x(c, o)
           order by o
         ), '[^[:alnum:]]+')
      || ')';
  else
    v_body := '(?:' || v_compact || ')';
  end if;

  -- Lookarounds rather than \m and \M: a word may start or end with a leetspeak
  -- symbol, which is not a word character.
  return case p_mode
    when 'word'     then '(?<![[:alnum:]])' || v_body || '(?![[:alnum:]])'
    when 'prefix'   then '(?<![[:alnum:]])' || v_body
    when 'anywhere' then v_body
  end;
end;
$$;

comment on function public.moderation_compile(text, text) is
  'The regular expression a folded term is matched with, in word, prefix or anywhere mode. Stored on the term when it is saved, never built during a read. Internal.';

create or replace function public.moderation_compile_allow(p_allow text[])
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_parts text[];
begin
  -- Each phrase folded like the text it will be found in, matched literally
  -- (no leetspeak: an allowlist is for innocent text, written plainly).
  v_parts := array(
    select (
      select string_agg(
               case
                 when c = ' ' then '[^[:alnum:]]+'
                 when c collate "pg_c_utf8" ~ '^[[:alnum:]]$' then c
                 else '\' || c
               end, '' order by o)
      from unnest(regexp_split_to_array(p.folded, '')) with ordinality as x(c, o)
    )
    from (
      select btrim(regexp_replace(public.moderation_fold(a), '\s+', ' ', 'g')) as folded
      from unnest(coalesce(p_allow, '{}')) as a
    ) as p
    -- A phrase of nothing but accents or invisible characters folds to nothing.
    where p.folded <> ''
  );

  if cardinality(v_parts) = 0 then
    return null;
  end if;

  return '(?<![[:alnum:]])(?:' || array_to_string(v_parts, '|') || ')(?![[:alnum:]])';
end;
$$;

comment on function public.moderation_compile_allow(text[]) is
  'One regular expression matching any of a term''s innocent phrases. Text it matches is taken out before the term is looked for. Internal.';


-- ---------------------------------------------------------------------------
-- The list
-- ---------------------------------------------------------------------------

create table public.moderation_terms (
  id            uuid primary key default gen_random_uuid(),
  term          text not null
                constraint moderation_terms_term_length check (char_length(term) between 1 and 100),
  -- A label for curation (en, zh, fr, ru, ar...). Matching ignores it: every
  -- live term is looked for in every review, because slurs cross languages.
  language      text
                constraint moderation_terms_language_valid
                check (language is null or language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  -- Set by moderation_terms_compile from term, match_mode and allow.
  folded        text not null,
  pattern       text not null,
  tier          text not null
                constraint moderation_terms_tier_valid check (tier in ('hold', 'watch')),
  category      text not null
                constraint moderation_terms_category_valid
                check (category in ('transphobic', 'homophobic', 'racist', 'ableist', 'misogynist')),
  match_mode    text not null default 'word'
                constraint moderation_terms_match_mode_valid check (match_mode in ('word', 'prefix', 'anywhere')),
  -- Innocent phrases that never count as this term: a place name, a trade.
  allow         text[] not null default '{}'
                constraint moderation_terms_allow_size check (cardinality(allow) <= 50),
  allow_pattern text,
  note          text
                constraint moderation_terms_note_length check (note is null or char_length(note) <= 500),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles (id) on delete set null
);

-- One live entry per spelling and mode. Archived ones stay for the history of
-- the reviews they matched.
create unique index moderation_terms_live_key
  on public.moderation_terms (folded, match_mode)
  where archived_at is null;

comment on table public.moderation_terms is
  'The word list. Only ever stored here and edited through the admin panel - never committed to git. tier: hold (the review waits for a person) or watch (it publishes, and a person looks later). Readable by nobody but the definer functions.';

alter table public.moderation_terms enable row level security;
revoke all on public.moderation_terms from anon, authenticated;

create or replace function public.moderation_terms_compile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.term := btrim(regexp_replace(coalesce(new.term, ''), '\s+', ' ', 'g'));
  new.folded := btrim(regexp_replace(public.moderation_fold(new.term), '\s+', ' ', 'g'));

  if new.folded = '' then
    raise exception 'That word is empty once accents and spacing are taken out.'
      using errcode = '22023';
  end if;

  if new.match_mode = 'anywhere' and new.folded ~ '^[a-z0-9 ]{1,3}$' then
    raise exception 'A word this short would match inside other words. Use whole word or prefix.'
      using errcode = '22023';
  end if;

  new.allow := array(
    select distinct btrim(regexp_replace(a, '\s+', ' ', 'g'))
    from unnest(coalesce(new.allow, '{}')) as a
    where btrim(coalesce(a, '')) <> ''
  );

  new.pattern := public.moderation_compile(new.folded, new.match_mode);
  new.allow_pattern := public.moderation_compile_allow(new.allow);

  -- Compile both now, so a pattern the regex engine refuses is refused here
  -- rather than on somebody's review.
  begin
    perform '' collate "pg_c_utf8" ~ new.pattern;
    if new.allow_pattern is not null then
      perform '' collate "pg_c_utf8" ~ new.allow_pattern;
    end if;
  exception when others then
    raise exception 'That word could not be turned into a pattern.' using errcode = '22023';
  end;

  return new;
end;
$$;

comment on function public.moderation_terms_compile() is
  'BEFORE INSERT OR UPDATE OF term, match_mode, allow on moderation_terms: tidies the term, folds it, and stores its compiled pattern and allowlist pattern, refusing what cannot be matched.';

create trigger moderation_terms_compile
  before insert or update of term, match_mode, allow on public.moderation_terms
  for each row execute function public.moderation_terms_compile();


-- ---------------------------------------------------------------------------
-- What each review matched
-- ---------------------------------------------------------------------------

-- Kept off reviews on purpose. reviews is in the realtime publication, and a
-- write to it is an event on every open map; a rescan writing hits for every
-- review would be a burst of events, and rows that change together link their
-- authors (Hidden dates, rule 4). Nothing here is ever sent anywhere.
create table public.review_screening (
  review_id  uuid primary key references public.reviews (id) on delete cascade,
  -- Live terms found in the body or a free-text answer at the last scan.
  hits       uuid[] not null default '{}',
  -- Terms a person has already read on this review and left up.
  cleared    uuid[] not null default '{}',
  scanned_at timestamptz not null default now()
);

comment on table public.review_screening is
  'Which terms each review matched when it was last scanned, and which of those an admin has already read and left up. Kept off reviews so that scanning never produces a realtime event. Readable by nobody but the definer functions.';

alter table public.review_screening enable row level security;
revoke all on public.review_screening from anon, authenticated;


-- ---------------------------------------------------------------------------
-- Screening
-- ---------------------------------------------------------------------------

create or replace function public.moderation_screen(p_texts text[])
returns uuid[]
language sql
stable
set search_path = ''
as $$
  with folded as (
    select public.moderation_fold(t) as f
    from unnest(coalesce(p_texts, '{}')) as t
    where t is not null and btrim(t) <> ''
  )
  select coalesce(array_agg(m.id order by m.id), '{}')
  from public.moderation_terms m
  where m.archived_at is null
    and exists (
      select 1
      from folded x
      where (case
               when m.allow_pattern is null then x.f collate "pg_c_utf8"
               else regexp_replace(x.f collate "pg_c_utf8", m.allow_pattern, ' ', 'g') collate "pg_c_utf8"
             end) ~ m.pattern
    );
$$;

comment on function public.moderation_screen(text[]) is
  'The ids of the live terms found in any of the texts, each text folded once and each term''s allowlist taken out first. Internal: called by submit_review, the venue name trigger and the panel''s rescan.';


-- ---------------------------------------------------------------------------
-- Marking, masking, highlighting
-- ---------------------------------------------------------------------------

/*
 * The original text cut into segments, each marked hit or not, for the terms
 * given (only hold-tier ones when p_hold_only).
 *
 * The text is split into whitespace-separated tokens, and each token folded on
 * its own; the folded tokens, joined by single spaces, are what the terms are
 * matched against. A token that overlaps a match is a hit. When a token's fold
 * kept its length, the match lands on exactly the characters it covered - so
 * the comma after a word stays plain, and a match inside a token written
 * without spaces covers only itself. When folding changed the length (a
 * ligature, a zero-width character), the whole token is marked, less its
 * leading and trailing punctuation.
 *
 * keep_first is set on the segment where a match starts, so a mask can keep
 * its first letter, and a word spelt out letter by letter keeps only the first
 * of them.
 */
create or replace function public.moderation_marks(
  p_text      text,
  p_term_ids  uuid[],
  p_hold_only boolean
)
returns table (seg_ord integer, seg_text text, seg_hit boolean, seg_keep_first boolean)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_text      text := coalesce(p_text, '');
  v_joined    text := '';
  v_leads     text[] := '{}';
  v_tokens    text[] := '{}';
  v_starts    integer[] := '{}';
  v_ends      integer[] := '{}';
  v_exact     boolean[] := '{}';
  -- Per token whose fold kept its length, one flag per character: '.' plain,
  -- 'x' hit, 'k' hit where a match starts.
  v_flags     text[] := '{}';
  -- Per token whose fold changed its length: '' plain, 'x' hit, 'k' hit and a
  -- match starts in it.
  v_whole     text[] := '{}';
  v_n         integer := 0;
  v_m         text[];
  v_f         text;
  v_term      record;
  v_k         integer;
  v_pos       integer;
  v_len       integer;
  v_allow     int4range[];
  v_i         integer;
  v_j         integer;
  v_a         integer;
  v_b         integer;
  v_tok       text;
  v_lead_p    text;
  v_trail_p   text;
  v_core      text;
  v_run_start integer;
  v_trailing  text;
begin
  seg_ord := 0;

  for v_m in select regexp_matches(v_text collate "pg_c_utf8", '(\s*)(\S+)', 'g') loop
    v_n := v_n + 1;
    v_leads[v_n] := v_m[1];
    v_tokens[v_n] := v_m[2];
    v_f := public.moderation_fold(v_m[2]);
    if v_n > 1 then
      v_joined := v_joined || ' ';
    end if;
    v_starts[v_n] := char_length(v_joined) + 1;
    v_joined := v_joined || v_f;
    v_ends[v_n] := char_length(v_joined);
    v_exact[v_n] := char_length(v_f) = char_length(v_m[2]);
    v_flags[v_n] := repeat('.', char_length(v_m[2]));
    v_whole[v_n] := '';
  end loop;

  v_trailing := substring(v_text collate "pg_c_utf8" from '\s*$');

  if v_n > 0 and coalesce(cardinality(p_term_ids), 0) > 0 then
    for v_term in
      select t.pattern, t.allow_pattern
      from public.moderation_terms t
      where t.id = any(p_term_ids)
        and t.archived_at is null
        and (not p_hold_only or t.tier = 'hold')
    loop
      -- The spans this term's innocent phrases cover.
      v_allow := '{}';
      if v_term.allow_pattern is not null then
        v_k := 1;
        loop
          v_pos := regexp_instr(v_joined collate "pg_c_utf8", v_term.allow_pattern, 1, v_k);
          exit when v_pos = 0;
          v_len := char_length(regexp_substr(v_joined collate "pg_c_utf8", v_term.allow_pattern, 1, v_k));
          v_allow := v_allow || int4range(v_pos, v_pos + v_len);
          v_k := v_k + 1;
        end loop;
      end if;

      v_k := 1;
      loop
        v_pos := regexp_instr(v_joined collate "pg_c_utf8", v_term.pattern, 1, v_k);
        exit when v_pos = 0;
        v_len := char_length(regexp_substr(v_joined collate "pg_c_utf8", v_term.pattern, 1, v_k));
        v_k := v_k + 1;

        continue when v_len = 0
          or exists (select 1 from unnest(v_allow) as a where a @> int4range(v_pos, v_pos + v_len));

        for v_i in 1 .. v_n loop
          continue when v_ends[v_i] < v_starts[v_i]
                     or v_ends[v_i] < v_pos
                     or v_starts[v_i] > v_pos + v_len - 1;

          if v_exact[v_i] then
            v_a := greatest(v_pos, v_starts[v_i]) - v_starts[v_i] + 1;
            v_b := least(v_pos + v_len - 1, v_ends[v_i]) - v_starts[v_i] + 1;
            for v_j in v_a .. v_b loop
              if substr(v_flags[v_i], v_j, 1) = '.' then
                v_flags[v_i] := overlay(v_flags[v_i]
                  placing case when v_j = v_a and v_pos >= v_starts[v_i] then 'k' else 'x' end
                  from v_j for 1);
              end if;
            end loop;
          else
            v_whole[v_i] := case
              when v_whole[v_i] = 'k' or v_pos >= v_starts[v_i] then 'k'
              else 'x'
            end;
          end if;
        end loop;
      end loop;
    end loop;
  end if;

  for v_i in 1 .. v_n loop
    if v_leads[v_i] <> '' then
      seg_ord := seg_ord + 1;
      seg_text := v_leads[v_i];
      seg_hit := false;
      seg_keep_first := false;
      return next;
    end if;

    v_tok := v_tokens[v_i];

    if v_exact[v_i] then
      -- Runs of plain or hit characters; a new run starts at every match start.
      v_run_start := 1;
      for v_j in 2 .. char_length(v_tok) + 1 loop
        if v_j > char_length(v_tok)
           or (substr(v_flags[v_i], v_j, 1) = '.') <> (substr(v_flags[v_i], v_run_start, 1) = '.')
           or substr(v_flags[v_i], v_j, 1) = 'k' then
          seg_ord := seg_ord + 1;
          seg_text := substr(v_tok, v_run_start, v_j - v_run_start);
          seg_hit := substr(v_flags[v_i], v_run_start, 1) <> '.';
          seg_keep_first := substr(v_flags[v_i], v_run_start, 1) = 'k';
          return next;
          v_run_start := v_j;
        end if;
      end loop;
    elsif v_whole[v_i] = '' then
      seg_ord := seg_ord + 1;
      seg_text := v_tok;
      seg_hit := false;
      seg_keep_first := false;
      return next;
    else
      v_lead_p := substring(v_tok collate "pg_c_utf8" from '^[^[:alnum:]]*');
      v_trail_p := substring(v_tok collate "pg_c_utf8" from '[^[:alnum:]]*$');
      if char_length(v_lead_p) >= char_length(v_tok) then
        v_lead_p := '';
        v_trail_p := '';
        v_core := v_tok;
      else
        v_core := substr(v_tok, char_length(v_lead_p) + 1,
                         char_length(v_tok) - char_length(v_lead_p) - char_length(v_trail_p));
      end if;

      if v_lead_p <> '' then
        seg_ord := seg_ord + 1;
        seg_text := v_lead_p;
        seg_hit := false;
        seg_keep_first := false;
        return next;
      end if;

      seg_ord := seg_ord + 1;
      seg_text := v_core;
      seg_hit := true;
      seg_keep_first := v_whole[v_i] = 'k';
      return next;

      if v_trail_p <> '' then
        seg_ord := seg_ord + 1;
        seg_text := v_trail_p;
        seg_hit := false;
        seg_keep_first := false;
        return next;
      end if;
    end if;
  end loop;

  if coalesce(v_trailing, '') <> '' then
    seg_ord := seg_ord + 1;
    seg_text := v_trailing;
    seg_hit := false;
    seg_keep_first := false;
    return next;
  end if;
end;
$$;

comment on function public.moderation_marks(text, uuid[], boolean) is
  'The text cut into ordered segments, each marked as a hit of one of the given terms or not, with keep_first where a match starts. Concatenating seg_text in seg_ord order gives back the text exactly. Internal.';

-- The mask itself, whatever the mode. moderation_mask decides whether to use it.
create or replace function public.moderation_apply_mask(p_text text, p_term_ids uuid[])
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_text is null then null
    when coalesce(cardinality(p_term_ids), 0) = 0 then p_text
    when not exists (
      select 1 from public.moderation_terms t
      where t.id = any(p_term_ids) and t.archived_at is null and t.tier = 'hold'
    ) then p_text
    else coalesce((
      select string_agg(
               case
                 when not m.seg_hit then m.seg_text
                 when m.seg_keep_first
                   then left(m.seg_text, 1) || repeat(U&'\2022', char_length(m.seg_text) - 1)
                 else repeat(U&'\2022', char_length(m.seg_text))
               end, '' order by m.seg_ord)
      from public.moderation_marks(p_text, p_term_ids, true) as m
    ), p_text)
  end;
$$;

comment on function public.moderation_apply_mask(text, uuid[]) is
  'The text with every hold-tier hit among the given terms masked: its first letter, then a bullet for each further character. Internal; readers go through moderation_mask.';

create or replace function public.moderation_mask(p_text text, p_term_ids uuid[])
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when public.moderation_enforced() then public.moderation_apply_mask(p_text, p_term_ids)
    else p_text
  end;
$$;

comment on function public.moderation_mask(text, uuid[]) is
  'What readers see of a published review''s text, given the terms it matched (review_screening.hits): hold-tier words masked, and nothing masked at all in shadow mode. Internal.';

create or replace function public.moderation_segments(p_text text, p_term_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when p_text is null then '[]'::jsonb
    when coalesce(cardinality(p_term_ids), 0) = 0
      then jsonb_build_array(jsonb_build_object('text', p_text, 'hit', false))
    else coalesce((
      select jsonb_agg(jsonb_build_object('text', m.seg_text, 'hit', m.seg_hit) order by m.seg_ord)
      from public.moderation_marks(p_text, p_term_ids, false) as m
    ), '[]'::jsonb)
  end;
$$;

comment on function public.moderation_segments(text, uuid[]) is
  'The text as [{text, hit}] segments, every tier marked, for highlighting in the admin panel. Internal.';


-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- All internal. Postgres grants EXECUTE to PUBLIC by default, which would
-- include anon; every caller is a security definer function or a trigger.
revoke execute on function public.moderation_enforced()                      from public, anon, authenticated;
revoke execute on function public.moderation_fold(text)                      from public, anon, authenticated;
revoke execute on function public.moderation_char_class(text)                from public, anon, authenticated;
revoke execute on function public.moderation_compile(text, text)             from public, anon, authenticated;
revoke execute on function public.moderation_compile_allow(text[])           from public, anon, authenticated;
revoke execute on function public.moderation_terms_compile()                 from public, anon, authenticated;
revoke execute on function public.moderation_screen(text[])                  from public, anon, authenticated;
revoke execute on function public.moderation_marks(text, uuid[], boolean)    from public, anon, authenticated;
revoke execute on function public.moderation_apply_mask(text, uuid[])        from public, anon, authenticated;
revoke execute on function public.moderation_mask(text, uuid[])              from public, anon, authenticated;
revoke execute on function public.moderation_segments(text, uuid[])          from public, anon, authenticated;
