-- Descriptions for the Ottawa and Gatineau directory: one short paragraph per
-- listed place, saying what it is and who it is for.
--
-- Needs 20261113100000_venue_descriptions.sql (the column).
--
-- Researched on 2026-11-13 from each organisation's own site where it loaded,
-- and current directories and local news where it did not; the October
-- research (LavenderBookLocations/ottawa-gatineau-lgbtq-candidates.json) was
-- the starting point. 26 of the 28 were confirmed on a current source. Two
-- rest on less, and say so in their own words:
--   * Gender Mosaic: probably no longer active (a founding member wrote in
--     2021 that it had ended); one health-line directory still lists it.
--   * Hello Dolly Pastries: its own website could not be found; confirmed
--     through Ottawa Tourism's list (July 2026) and a current listing.
-- And one place has changed since it was listed:
--   * Little Jo Berry's closed its storefront. Its description says so; the
--     pin is still at the old shop, which is a decision for an admin.
--
-- No hours, prices, contacts or people's names: contacts are in the notes, and
-- hours go stale. Plain sentences, in LavenderBook's voice.
--
-- IDEMPOTENT, and never overwrites: a place is matched on its Google id, or on
-- its name among rows without one, as 20261018130000 matched them; and only a
-- place with no description yet gets one. An admin's own words always win, and
-- re-running this changes nothing. A place that is not there (deleted, renamed)
-- is skipped, and the count at the end says how many were filled.
--
-- Written as plain SQL because the admin functions need a signed-in admin.

do $$
declare
  v_filled integer;
begin
  with incoming (name, google_place_id, description) as (
    values
  ('AIDS Committee of Ottawa'          , 'ChIJN1RdC6QFzkwRKxF2T7mF6Yw',
   'Free, confidential support, education, prevention and HIV testing for anyone in Ottawa living with, affected by or at risk of HIV. It is not only for gay men.'),
  ('BRAS Outaouais'                    , 'ChIJA_QlJfUEzkwRdHY91tYWreQ',
   'Gatineau community group for people in the Outaouais living with or at risk of HIV and related infections, and people who use drugs: support, workshops, street outreach and harm reduction.'),
  ('Bread By Us'                       , 'ChIJhc0AzT4EzkwRvtTdMrgUcKQ',
   'Queer-owned bakery and espresso bar in Hintonburg, making sourdough bread and pastries.'),
  ('Bruce House'                       , 'ChIJwdr86qwFzkwRNr8joe_H4RQ',
   'Supportive apartments and outreach support for people living with HIV in Ottawa, with a waitlist. It is stable, long-term housing, not an emergency shelter.'),
  ('Capital Pride'                     , 'ChIJF_zVVKsFzkwRiVBG8qv5058',
   'Non-profit that runs Ottawa''s Pride festival and parade each August. The address is its office, not a drop-in space: it lists no public hours.'),
  ('Centretown Community Health Centre', 'ChIJmf-_4KwFzkwRJg5Il9bZzbY',
   'Community health centre with a Trans Health Program for people 17 and up in the Ottawa area, and 2SLGBTQIA+ counselling. You can refer yourself. It cannot serve Quebec residents or anyone on RAMQ.'),
  ('Club Ottawa'                       , 'ChIJFW3FzD4EzkwRRgbD3NYpZlE',
   'Gay bathhouse and men''s sauna in Hintonburg, with a steam room, showers, lockers and private rooms. It is a bathhouse for men, not a bar or dance club.'),
  ('Escape Bicycle Tours & Rentals'    , 'ChIJqwKHnVUEzkwR0lKh0Dcq6pU',
   '2SLGBTQIA+-owned bike tour and rental company on Sparks Street: guided small-group tours of Ottawa, and bikes, e-bikes, kayaks and paddleboards to rent.'),
  ('Gender Mosaic'                     , null,
   'Trans peer support group founded in Ottawa in 1988, in English and French. It has an online presence only, with no office or meetings, and may no longer be active.'),
  ('Hello Dolly Pastries'              , 'ChIJZx9h2sIFzkwRB6o4buEobQE',
   'Queer-owned, neurodivergent-run bakery in Hintonburg making decorated and custom cookies, cakes and other sweet treats.'),
  ('In Bloom Tattoo Collective'        , 'ChIJdUVCfdMFzkwRYuwYLCZxHTQ',
   'Queer-owned and operated tattoo studio in downtown Ottawa offering trauma-informed tattooing. The studio is wheelchair accessible.'),
  ('Jeunesse Idem'                     , 'ChIJmfRXL_UEzkwRkw9Dh7K7sM0',
   'Gatineau group for LGBTQ+ children, teens and young adults up to 35 in the Outaouais: discussion groups, workshops, one-to-one support and social events. Services are mainly in French.'),
  ('Kind Space'                        , 'ChIJwdr86qwFzkwRUQi6ovC2EYo',
   '2SLGBTQIA+ community centre with drop-in hours, social and support groups, a lending library, free food and clothing, and a seasonal Trans ID Clinic for name and gender marker changes.'),
  ('LGBT YouthLine'                    , null,
   'Free, anonymous text and chat support for 2SLGBTQ+ youth 29 and under, from trained peers aged 16 to 29. It serves Ontario only and is not a crisis line.'),
  ('Little Jo Berry''s'                , 'ChIJr5cgiRcEzkwRit5AJro54y8',
   'Queer-owned vegan bakery. Its storefront has closed: it now sells at events and through a few local cafes, and takes orders on its website.'),
  ('MAX Ottawa'                        , 'ChIJjypX7KwFzkwR3oI5TGpSgGA',
   'Free health programs for gay, bi and queer men, and for trans and non-binary people: mental and sexual health support, harm reduction supplies, and social and support groups. For adults 18 and up.'),
  ('Milk Shop'                         , 'ChIJ2emwN_0EzkwR2WPf5HHh0zU',
   'Independent ByWard Market shop selling clothing, jewellery, stationery, cards, and home and body goods, including pieces by local queer artists.'),
  ('Ottawa Trans Library'              , 'ChIJn77cK4IFzkwRSwzFk_n-4Yo',
   'Lending library of books by and about trans people, with a free community space that hosts game nights, socials and peer groups. Aimed at trans people and their families; everyone is welcome.'),
  ('PFLAG Ottawa'                      , null,
   'Local chapter of a national support network for 2SLGBTQIA+ people and their families, friends and allies. It is not meeting yet: it is setting up its first support meetings and has a waitlist.'),
  ('Pride Centre, University of Ottawa', null,
   'Student-run service on the University of Ottawa campus for 2SLGBTQIA+ students and allies: drop-in lounge, queer library, events and free safer sex supplies. It is for uOttawa students.'),
  ('Rideau Rollers'                    , 'ChIJF8yNlqkFniMRdIzpfnw4M7k',
   'Roller skate shop in Chinatown selling skates, protective gear, parts and accessories for roller derby and recreational skating, for adults and kids.'),
  ('Swizzles'                          , 'ChIJJ_TfSFQEzkwRCr_OhUCXFWQ',
   'Downtown LGBTQ+ bar with karaoke, drag shows and comedy nights. It calls itself a bias-free bar where everyone is welcome.'),
  ('T''s Pub'                          , 'ChIJZxxyQ6wFzkwRf1xGBP_P1Ns',
   'LGBTQ+ community pub in Centretown with drag shows, karaoke and DJ nights. It says everyone is welcome.'),
  ('Ten Oaks Project'                  , null,
   'Charity running overnight summer camps and programs for children and youth from 2SLGBTQ+ families and communities, plus groups for parents of trans kids. The camps are held outside Ottawa.'),
  ('The Good Companions'               , 'ChIJjd0jzk8EzkwRJUoYKp0YDIY',
   'General seniors'' centre, not an LGBTQ+ one. It hosts Out and About Saturdays, the Ottawa Senior Pride Network''s program for LGBTQ+ people 55 and over, and other network groups.'),
  ('The Lookout Bar'                   , 'ChIJ171JCwIFzkwRlsX_jkrM_UI',
   'LGBTQ+ bar and dance club upstairs in the ByWard Market, open to everyone, with regular drag shows and a dance floor.'),
  ('The Spaniel''s Tale'               , 'ChIJJ5LBEAUFzkwRReRdUdqGVjI',
   'Queer-owned independent bookshop in Hintonburg with a focus on queer and Canadian authors, books for adults and children, and book clubs and author events.'),
  ('United in Pride'                   , null,
   'Ottawa group for LGBTQ+ newcomers, immigrants and refugees: peer support circles, wellness sessions, youth programs, cultural events and welcome care packs. It meets in partner spaces, not an office.')
  ),
  matched as (
    select v.id, i.description
    from incoming i
    join public.venues v
      on (i.google_place_id is not null and v.google_place_id = i.google_place_id)
      or (i.google_place_id is null and v.google_place_id is null and v.name = i.name)
  )
  update public.venues v
  set description = m.description
  from matched m
  where v.id = m.id
    and v.description is null;

  get diagnostics v_filled = row_count;
  raise notice 'directory descriptions: % place(s) filled', v_filled;
end;
$$;


-- To check afterwards (read-only): every listed place, and whether it has one.
--
--   select v.name, v.description is not null as described
--   from public.venues v
--   where exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
--   order by described, v.name;
