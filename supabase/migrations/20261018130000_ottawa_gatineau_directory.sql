-- The Ottawa and Gatineau directory: 21 new places, 5 online
-- organisations, and new tags and notes on the 2 already listed.
--
-- Source: D:\CodingProject\LavenderBookLocations\ottawa-gatineau-lgbtq-candidates.json,
-- researched 2026-10-18. Coordinates, addresses and place ids are Google's
-- (through the places-search proxy), never guessed. Notes are in the house shape:
-- a headline that carries the point, a colon, what it means for the reader.
--
-- Needs, in order:
--   20261018100000_tag_questions_and_new_tags.sql   (nightlife, queer-owned, sexual-health)
--   20261018110000_online_tag.sql                   (online)
--   20261018120000_venues_search_include_online.sql (so old apps never get the
--                                                    online ones, which have no coordinates)
-- A missing tag raises rather than skipping, so running this first fails whole.
--
-- IDEMPOTENT. A place with a Google id is matched on it (and an existing row is
-- left exactly as it is - name, address, coordinates); one without is matched
-- on its name among rows with no Google id. Tags are ON CONFLICT DO NOTHING, and
-- a note is added only if that venue has no note with the same text, at the
-- end of its list. Re-running adds nothing; it never edits or removes.
--
-- Deliberately not here:
--   * 5 organisations with neither a public place nor an online
--     contact (map_decision 'not-mappable' in the JSON):
--       Around the Rainbow (Family Services Ottawa)
--       Choeur gai d'Ottawa Gay Men's Chorus
--       Tone Cluster
--       Trans Outaouais
--       Fierté en Outaouais
--   * The existing venue named "1104" (1104 Somerset St W, no reviews, no tags).
--     It is Google's label for the building, not the library: the Ottawa Trans
--     Library has its own place id and is added below. "1104" is invisible on
--     the map (untagged, unreviewed) and left alone.
--   * Pride Centre, University of Ottawa takes the University Centre's
--     coordinates but not its place id: the id is the building's, and claiming
--     it would open our listing when someone taps the building's label.
--
-- Written as plain SQL because the admin_* functions need a signed-in admin. So
-- created_by, added_by and updated_by are null on everything this adds.
--
-- To check afterwards (read-only):
--   select v.name, v.lat is not null as mapped,
--          (select string_agg(t.slug, ', ') from public.venue_tags vt
--             join public.tags t on t.id = vt.tag_id where vt.venue_id = v.id) as tags,
--          (select count(*) from public.venue_notes n where n.venue_id = v.id) as notes
--   from public.venues v
--   where exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
--   order by mapped desc, v.name;


create function pg_temp.place(
  p_name    text,
  p_gpid    text,
  p_address text,
  p_lat     double precision,
  p_lng     double precision,
  p_tags    text[],
  p_notes   text[]
)
returns uuid
language plpgsql
as $$
declare
  v_id   uuid;
  v_slug text;
  v_tag  uuid;
  v_note text;
begin
  if p_gpid is not null then
    select v.id into v_id from public.venues v where v.google_place_id = p_gpid;
  else
    select v.id into v_id
    from public.venues v
    where v.google_place_id is null and v.name = p_name
    limit 1;
  end if;

  if v_id is null then
    insert into public.venues (google_place_id, name, address, lat, lng, last_synced_at)
    values (p_gpid, p_name, p_address, p_lat, p_lng,
            case when p_gpid is null then null else now() end)
    returning id into v_id;
  end if;

  foreach v_slug in array p_tags loop
    select t.id into v_tag from public.tags t where t.slug = v_slug and t.archived_at is null;
    if v_tag is null then
      raise exception 'no live tag with slug % (for %) - run the tag migrations first', v_slug, p_name;
    end if;
    insert into public.venue_tags (venue_id, tag_id) values (v_id, v_tag)
    on conflict (venue_id, tag_id) do nothing;
  end loop;

  foreach v_note in array p_notes loop
    if not exists (
      select 1 from public.venue_notes n where n.venue_id = v_id and n.body = v_note
    ) then
      insert into public.venue_notes (venue_id, body, sort_order)
      values (
        v_id, v_note,
        coalesce((select max(n.sort_order) from public.venue_notes n where n.venue_id = v_id), 0) + 1
      );
    end if;
  end loop;

  return v_id;
end;
$$;


-- ---- Already listed: new tags and notes only -------------------------------

select pg_temp.place(
  'Kind Space',
  'ChIJwdr86qwFzkwRUQi6ovC2EYo', '400 Cooper St, Ottawa, ON K2P 2N1, Canada',
  45.4156036, -75.6974334,
  array['hub', 'support-group', 'legal'],
  array[
    'It is step-free with accessible, gender-neutral washrooms: ASL is available on request, the space is kept low-scent, and transit costs can be reimbursed.',
    'Letters of support for 2SLGBTQ+ refugees are available: Ask at the centre. It also has a free library you can borrow from.'
  ]
);

select pg_temp.place(
  'Centretown Community Health Centre',
  'ChIJmf-_4KwFzkwRJg5Il9bZzbY', '420 Cooper St, Ottawa, ON K2P 0K1, Canada',
  45.4154793, -75.6978334,
  array['trans-healthcare', 'mental-health', 'healthcare', 'youth'],
  array[
    'Free short-term 2SLGBTQIA+ counselling for ages 16 to 25: Parents and caregivers can come too. It is for people without private insurance.',
    'A 2SLGBTQ+ walk-in counselling clinic runs on Wednesday afternoons: Check the hours first, as they can change.'
  ]
);


-- ---- New places, pinned ----------------------------------------------------

select pg_temp.place(
  'MAX Ottawa',
  'ChIJjypX7KwFzkwR3oI5TGpSgGA', '400 rue, Cooper St Ste 9004, Ottawa, ON K2P 0K1, Canada',
  45.4157709, -75.6972196,
  array['mental-health', 'sexual-health'],
  array[
    'Free mental health and harm-reduction programs: Aimed at gay, bi and queer men, with HIV and sexual health testing as well.',
    'Formerly the Gay Men''s Wellness Initiative: Older directories still list it under that name.',
    'Trans and non-binary people are welcome too: It runs social and support programs for them.',
    'Some services are online: You can use them from home if travelling is hard.'
  ]
);

select pg_temp.place(
  'AIDS Committee of Ottawa',
  'ChIJN1RdC6QFzkwRKxF2T7mF6Yw', '19 Main St, Ottawa, ON K1S 1A9, Canada',
  45.414588699999996, -75.6810084,
  array['healthcare', 'sexual-health'],
  array[
    'Support, prevention and outreach on HIV/AIDS: For people living with it, affected by it or at risk, not only gay men.',
    'It describes its approach as anti-racist and anti-oppressive.'
  ]
);

select pg_temp.place(
  'Bruce House',
  'ChIJwdr86qwFzkwRNr8joe_H4RQ', '251 Bank St #402, Ottawa, ON K2P 1X2, Canada',
  45.4163073, -75.6968542,
  array['shelter'],
  array[
    'Housing for people living with HIV, not emergency beds: It offers long-term supportive apartments for families, individuals and couples, so it is not somewhere to turn up for a bed tonight.',
    'Outreach and life-skills support through its REST program.',
    'Started in 1988 during the AIDS crisis: It was set up to house men in the final stages of the illness.'
  ]
);

select pg_temp.place(
  'Capital Pride',
  'ChIJF_zVVKsFzkwRiVBG8qv5058', '403 Bank St Studio #2, Ottawa, ON K2P 1Y6, Canada',
  45.4131143, -75.6937765,
  array['hub'],
  array[
    'This is an office, not a drop-in space: We could not confirm walk-in hours, so email or phone before you go.',
    'Pride Week is in August: It launches with a flag raising at Ottawa City Hall.',
    'Its website keeps a list of local 2SLGBTQ+ resources: Useful if you are looking for something else.'
  ]
);

select pg_temp.place(
  'Pride Centre, University of Ottawa',
  null, '85 University Private, Ottawa, ON K1N 1H3, Canada',
  45.42264240000001, -75.683814,
  array['hub', 'support-group'],
  array[
    'Run by students, not the university: It is a Students'' Union service, independent of the university.',
    'Events, workshops, discussion groups and free safer sex supplies.',
    'Free therapy for students through a partner: Blossom Counselling Centre gives pro bono sessions to students.',
    'Meant for the uOttawa community: If you are not a student, check you can come in before you go.'
  ]
);

select pg_temp.place(
  'Ottawa Trans Library',
  'ChIJn77cK4IFzkwRSwzFk_n-4Yo', '1104 Somerset St W, Ottawa, ON K1Y 3C8, Canada',
  45.4059153, -75.7220403,
  array['hub'],
  array[
    'Borrowing is free and the catalogue is searchable online. It runs on donations. The collection includes trans-authored books, trans history and books with trans characters.',
    'A separate free shelf holds books on other topics that anyone can take home. It also hosts community events such as board game nights and book clubs.'
  ]
);

select pg_temp.place(
  'The Good Companions',
  'ChIJjd0jzk8EzkwRJUoYKp0YDIY', '670 Albert St, Ottawa, ON K1R 6L2, Canada',
  45.4134804, -75.7103922,
  array['support-group'],
  array[
    'The Ottawa Senior Pride Network meets here: Out and About Saturdays is an in-person program for LGBTQ+ people 55 and over, run with The Good Companions.',
    'Try three Saturdays before you join: After that it needs a Good Companions membership. Help with the cost is decided case by case.',
    'It is a general seniors'' centre: The LGBTQ+ program is one of many, so ask at the front desk for Out and About.',
    'The building is wheelchair accessible.',
    'The network meets elsewhere too: Bowling at West Park Lanes, and a monthly Older and Bolder group for queer women 50 and over. See ospn-rfao.ca.'
  ]
);

select pg_temp.place(
  'The Lookout Bar',
  'ChIJ171JCwIFzkwRlsX_jkrM_UI', '41 York St 2nd floor, Ottawa, ON K1N 5S7, Canada',
  45.4282237, -75.6937311,
  array['nightlife'],
  array[
    'Drag shows on Fridays and Saturdays: 8:30pm seated, then 11:30pm on the dance floor.',
    'It is upstairs: The bar is on the second floor of 41 York Street.',
    'Open since 1996: One of the best-known LGBTQ+ bars in the ByWard Market.'
  ]
);

select pg_temp.place(
  'Swizzles',
  'ChIJJ_TfSFQEzkwRCr_OhUCXFWQ', '246 B Queen St, Ottawa, ON K1P 5E4, Canada',
  45.4199202, -75.7016727,
  array['nightlife'],
  array[
    'Calls itself Ottawa''s only bias-free bar.',
    'Karaoke, drag and comedy nights.'
  ]
);

select pg_temp.place(
  'T''s Pub',
  'ChIJZxxyQ6wFzkwRf1xGBP_P1Ns', '323 Somerset St W, Ottawa, ON K2P 0J8, Canada',
  45.4160816, -75.6950277,
  array['nightlife'],
  array[
    'A small, all-inclusive neighbourhood bar.',
    'Drag and karaoke nights.'
  ]
);

select pg_temp.place(
  'Club Ottawa',
  'ChIJFW3FzD4EzkwRRgbD3NYpZlE', '1069 Wellington St. W, Ottawa, ON K1Y 2Y2, Canada',
  45.4036492, -75.72499479999999,
  array['nightlife'],
  array[
    'The only gay bathhouse in the capital: Dry sauna, steam room, showers, a video lounge and private rooms.',
    'Condoms and towels are provided free.'
  ]
);

select pg_temp.place(
  'The Spaniel''s Tale',
  'ChIJJ5LBEAUFzkwRReRdUdqGVjI', '1109 Wellington St. W, Ottawa, ON K1Y 2Y4, Canada',
  45.40273570000001, -75.72595489999999,
  array['queer-owned'],
  array[
    'Queer and Canadian authors: Adult and children''s books.',
    'Opened in 2022.'
  ]
);

select pg_temp.place(
  'Little Jo Berry''s',
  'ChIJr5cgiRcEzkwRit5AJro54y8', '1305 Wellington St. W, Ottawa, ON K1Y 3B1, Canada',
  45.3989877, -75.73586809999999,
  array['queer-owned'],
  array[
    'A vegan bakery and café, owned by a queer, non-binary entrepreneur.'
  ]
);

select pg_temp.place(
  'Bread By Us',
  'ChIJhc0AzT4EzkwRvtTdMrgUcKQ', '128 Smirle Ave, Ottawa, ON K1Y 3B1, Canada',
  45.3991846, -75.7358082,
  array['queer-owned'],
  array[
    'Queer-owned bakery and espresso bar: Sourdough, laminated pastries and coffee.'
  ]
);

select pg_temp.place(
  'Milk Shop',
  'ChIJ2emwN_0EzkwR2WPf5HHh0zU', '45 William St, Ottawa, ON K1N 6Z9, Canada',
  45.427791, -75.6920925,
  array['queer-owned'],
  array[
    'An inclusive shop that stocks queer artists: Clothing, stationery, cards, and home and body products.'
  ]
);

select pg_temp.place(
  'In Bloom Tattoo Collective',
  'ChIJdUVCfdMFzkwRYuwYLCZxHTQ', '340 MacLaren St Unit 304, Ottawa, ON K2P 0M6, Canada',
  45.4149008, -75.6946262,
  array['queer-owned'],
  array[
    'Trauma-informed tattooing: Owned by queer and trans people.'
  ]
);

select pg_temp.place(
  'Hello Dolly Pastries',
  'ChIJZx9h2sIFzkwRB6o4buEobQE', '992 Wellington St. W, Ottawa, ON K1Y 2X8, Canada',
  45.405532099999995, -75.72280289999999,
  array['queer-owned'],
  array[
    'Queer-owned and run by a neurodivergent baker: Decorated custom cookies, cakes and treats.'
  ]
);

select pg_temp.place(
  'Rideau Rollers',
  'ChIJF8yNlqkFniMRdIzpfnw4M7k', '787 Somerset St W, Ottawa, ON K1R 6R3, Canada',
  45.4098283, -75.71030809999999,
  array['queer-owned'],
  array[
    'Roller skating and derby gear, owned by a skater: Sells skates, protective gear and accessories, and rents skates.',
    'It sponsors the Ottawa Valley Roller Derby league and hosts events.'
  ]
);

select pg_temp.place(
  'Escape Bicycle Tours & Rentals',
  'ChIJqwKHnVUEzkwR0lKh0Dcq6pU', '65 Sparks St., Ottawa, ON K1P 5A5, Canada',
  45.4233299, -75.6966953,
  array['queer-owned'],
  array[
    'Tours and rentals: Bikes, e-bikes, kayaks and paddleboards, with a summer kiosk at the NCC River House.'
  ]
);

select pg_temp.place(
  'Jeunesse Idem',
  'ChIJmfRXL_UEzkwRkw9Dh7K7sM0', '109 Rue Wright #7, Gatineau, QC J8X 2G7, Canada',
  45.4271269, -75.7187352,
  array['youth', 'support-group'],
  array[
    'For ages 7 to 35: Support groups are 12 to 17 on Mondays and 18 to 35 on Tuesdays, 6:30 to 8pm.',
    'Services are mainly in French.',
    'The door is on rue Leduc: The office is 109 rue Wright, suite 007, but you enter at 41 rue Leduc.',
    'Groups change: Check jeunesseidem.org for the current schedule.'
  ]
);

select pg_temp.place(
  'BRAS Outaouais',
  'ChIJA_QlJfUEzkwRdHY91tYWreQ', '109 Rue Wright, Gatineau, QC J8X 2G7, Canada',
  45.4272546, -75.71878319999999,
  array['healthcare', 'sexual-health'],
  array[
    'HIV/AIDS support for the whole Outaouais: A community organization set up in 1990 to improve quality of life for people affected by HIV.',
    'It shares a building with Jeunesse Idem: Both are at 109 rue Wright, in different suites.'
  ]
);


-- ---- Online: no coordinates, no pin, reached through the notes -------------

select pg_temp.place(
  'United in Pride',
  null, null,
  null, null,
  array['online'],
  array[
    'Reach them online: unitedinpride.ca, or email info@unitedinpride.ca. We could not find a public address.',
    'Peer support circles, wellness workshops, and youth and newcomer programs.',
    'Help for LGBTQ+ newcomers, immigrants and refugees: Includes sponsorship and resettlement support in the Ottawa region.'
  ]
);

select pg_temp.place(
  'Ten Oaks Project',
  null, null,
  null, null,
  array['online'],
  array[
    'Reach them by phone or online: 613-889-1537, info@tenoaksproject.org, or tenoaksproject.org. The Ottawa address is for mail only.',
    'Camp Ten Oaks is a week-long summer camp for ages 8 to 17: It runs outside Kingston and London, not in Ottawa, on a sliding fee scale.',
    'Free programs for families in Ottawa: Families in TRANSition runs for 10 weeks for families of newly out trans young people, and Shaping Parenthood is a workshop series.'
  ]
);

select pg_temp.place(
  'Gender Mosaic',
  null, null,
  null, null,
  array['online'],
  array[
    'Online only: Reach them through facebook.com/gendermosaic. There is no office or regular meeting place.',
    'Peer support for trans people and their families: In English and French, across Eastern Ontario and Western Quebec.',
    'Billed as the longest-running trans support group in North America.'
  ]
);

select pg_temp.place(
  'PFLAG Ottawa',
  null, null,
  null, null,
  array['online'],
  array[
    'Not meeting yet: The Ottawa chapter is organizing its first support meetings. Join the waitlist through the form at pflagcanada.ca/chapter/pflag-ottawa.',
    'For families and friends of LGBTQ+ people: Meant for parents and relatives as much as for LGBTQ+ people.'
  ]
);

select pg_temp.place(
  'LGBT YouthLine',
  null, null,
  null, null,
  array['online'],
  array[
    'Text or chat with someone your age: Text 647-694-4275, or chat at youthline.ca. It is free, for LGBTQ+ youth 29 and under.',
    'Sunday to Friday, 4 to 9:30pm Eastern: No one is on the line outside those hours.',
    'It is peer support, not a crisis line: If you are in danger, call 911. It serves Ontario, so it may not be able to help in Gatineau.'
  ]
);


drop function pg_temp.place(text, text, text, double precision, double precision, text[], text[]);
