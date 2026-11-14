-- Contacts for the Ottawa and Gatineau directory: how to reach each listed
-- place - its website, phone, text line, email, and labelled links to its own
-- services (a clinic, a booking page, a waitlist form) - shown in the window
-- that opens from its description.
--
-- Needs 20261114100000_venue_contacts.sql (the table).
--
-- Researched on 2026-11-13, each place on its own website where it loaded:
-- 101 contacts for the 28 places, 27 of them confirmed there. Every link and
-- website answered, except four that refuse plain requests and load in a
-- browser (MAX Ottawa's site and two of its pages, Gender Mosaic's Facebook
-- page, the Ottawa Trans Library's catalogue).
--
-- An organisation's own published contacts only. Staff members' addresses
-- published on some of these sites were left out on purpose, as was a phone
-- line that is a staff office rather than the service (LGBT YouthLine's
-- helpline takes no calls since 2023; it is text, chat and email).
--
-- Worth an admin's eye, and not changed here:
--   * Gender Mosaic: probably inactive; its Facebook page is its only contact.
--   * PFLAG Ottawa: not meeting yet. The email is PFLAG Canada's, labelled so;
--     the chapter's own way in is its contact form.
--   * Kind Space: no general email. The one listed is the Trans ID Clinic's,
--     which runs October to March, and is labelled so.
--   * Little Jo Berry's: storefront closed (its description already says so).
--
-- IDEMPOTENT, and never overwrites: a place is matched on its Google id, or on
-- its name among rows without one, as the descriptions were; and only a place
-- with no contacts yet gets these. An admin's list always wins, and running
-- this again adds nothing.
--
-- Written as plain SQL because admin_set_venue_contacts needs a signed-in
-- admin.

do $$
declare
  v_added integer;
begin
  with incoming (name, google_place_id, sort_order, kind, value, label) as (
    values
  ('AIDS Committee of Ottawa'          , 'ChIJN1RdC6QFzkwRKxF2T7mF6Yw', 1, 'website', 'https://aco-cso.ca/', null),
  ('AIDS Committee of Ottawa'          , 'ChIJN1RdC6QFzkwRKxF2T7mF6Yw', 2, 'phone', '(613) 238-5014', null),
  ('AIDS Committee of Ottawa'          , 'ChIJN1RdC6QFzkwRKxF2T7mF6Yw', 3, 'email', 'info@aco-cso.ca', null),
  ('AIDS Committee of Ottawa'          , 'ChIJN1RdC6QFzkwRKxF2T7mF6Yw', 4, 'link', 'https://aco-cso.ca/test/', 'HIV and STI testing'),
  ('AIDS Committee of Ottawa'          , 'ChIJN1RdC6QFzkwRKxF2T7mF6Yw', 5, 'link', 'https://aco-cso.ca/support/', 'Support services'),
  ('BRAS Outaouais'                    , 'ChIJA_QlJfUEzkwRdHY91tYWreQ', 1, 'website', 'https://lebras.qc.ca/', null),
  ('BRAS Outaouais'                    , 'ChIJA_QlJfUEzkwRdHY91tYWreQ', 2, 'phone', '819-776-2727', 'Main line'),
  ('BRAS Outaouais'                    , 'ChIJA_QlJfUEzkwRdHY91tYWreQ', 3, 'phone', '1-877-376-2727', 'Toll-free'),
  ('BRAS Outaouais'                    , 'ChIJA_QlJfUEzkwRdHY91tYWreQ', 4, 'email', 'info@lebras.qc.ca', null),
  ('BRAS Outaouais'                    , 'ChIJA_QlJfUEzkwRdHY91tYWreQ', 5, 'link', 'https://lebras.qc.ca/en/services/entre-hommes', 'Entre Hommes (gay and bi men)'),
  ('BRAS Outaouais'                    , 'ChIJA_QlJfUEzkwRdHY91tYWreQ', 6, 'link', 'https://lebras.qc.ca/en/sexual-health/screening-prevention', 'Testing and prevention'),
  ('Bread By Us'                       , 'ChIJhc0AzT4EzkwRvtTdMrgUcKQ', 1, 'website', 'https://www.breadbyus.com/', null),
  ('Bread By Us'                       , 'ChIJhc0AzT4EzkwRvtTdMrgUcKQ', 2, 'phone', '343-227-3077', null),
  ('Bruce House'                       , 'ChIJwdr86qwFzkwRNr8joe_H4RQ', 1, 'website', 'https://brucehouse.ca/', null),
  ('Bruce House'                       , 'ChIJwdr86qwFzkwRNr8joe_H4RQ', 2, 'phone', '613-729-0911', null),
  ('Bruce House'                       , 'ChIJwdr86qwFzkwRNr8joe_H4RQ', 3, 'email', 'admin@brucehouse.ca', null),
  ('Bruce House'                       , 'ChIJwdr86qwFzkwRNr8joe_H4RQ', 4, 'link', 'https://brucehouse.ca/programs/become-a-client/', 'Become a client'),
  ('Capital Pride'                     , 'ChIJF_zVVKsFzkwRiVBG8qv5058', 1, 'website', 'https://capitalpride.ca/', null),
  ('Capital Pride'                     , 'ChIJF_zVVKsFzkwRiVBG8qv5058', 2, 'phone', '613-680-3033', null),
  ('Capital Pride'                     , 'ChIJF_zVVKsFzkwRiVBG8qv5058', 3, 'email', 'info@capitalpride.ca', null),
  ('Centretown Community Health Centre', 'ChIJmf-_4KwFzkwRJg5Il9bZzbY', 1, 'website', 'https://www.centretownchc.org/', null),
  ('Centretown Community Health Centre', 'ChIJmf-_4KwFzkwRJg5Il9bZzbY', 2, 'phone', '(613) 233-4443', null),
  ('Centretown Community Health Centre', 'ChIJmf-_4KwFzkwRJg5Il9bZzbY', 3, 'email', 'info@centretownchc.org', null),
  ('Centretown Community Health Centre', 'ChIJmf-_4KwFzkwRJg5Il9bZzbY', 4, 'link', 'https://www.centretownchc.org/trans-health', 'Trans Health Program'),
  ('Centretown Community Health Centre', 'ChIJmf-_4KwFzkwRJg5Il9bZzbY', 5, 'link', 'https://www.centretownchc.org/programs/2slgbtqia%2B-wednesday-quick-access-counselling-clinic', '2SLGBTQIA+ walk-in counselling'),
  ('Club Ottawa'                       , 'ChIJFW3FzD4EzkwRRgbD3NYpZlE', 1, 'website', 'https://www.clubottawa.com/', null),
  ('Club Ottawa'                       , 'ChIJFW3FzD4EzkwRRgbD3NYpZlE', 2, 'phone', '613-722-8978', null),
  ('Escape Bicycle Tours & Rentals'    , 'ChIJqwKHnVUEzkwR0lKh0Dcq6pU', 1, 'website', 'https://escapebicycletours.ca/', null),
  ('Escape Bicycle Tours & Rentals'    , 'ChIJqwKHnVUEzkwR0lKh0Dcq6pU', 2, 'phone', '613-608-7407', null),
  ('Escape Bicycle Tours & Rentals'    , 'ChIJqwKHnVUEzkwR0lKh0Dcq6pU', 3, 'email', 'info@escapebicycletours.ca', null),
  ('Gender Mosaic'                     , null, 1, 'link', 'https://www.facebook.com/gendermosaic', 'Facebook page'),
  ('Hello Dolly Pastries'              , 'ChIJZx9h2sIFzkwRB6o4buEobQE', 1, 'website', 'https://hellodollypastries.ca/', null),
  ('Hello Dolly Pastries'              , 'ChIJZx9h2sIFzkwRB6o4buEobQE', 2, 'phone', '+1 (613) 986-2132', null),
  ('Hello Dolly Pastries'              , 'ChIJZx9h2sIFzkwRB6o4buEobQE', 3, 'email', 'hey@hellodollypastries.ca', null),
  ('Hello Dolly Pastries'              , 'ChIJZx9h2sIFzkwRB6o4buEobQE', 4, 'link', 'https://hellodollypastries.ca/pages/make-a-custom-request', 'Custom order request'),
  ('In Bloom Tattoo Collective'        , 'ChIJdUVCfdMFzkwRYuwYLCZxHTQ', 1, 'website', 'https://www.inbloomtattoocollective.com/', null),
  ('In Bloom Tattoo Collective'        , 'ChIJdUVCfdMFzkwRYuwYLCZxHTQ', 2, 'email', 'inbloomtattooco@gmail.com', 'General inquiries'),
  ('In Bloom Tattoo Collective'        , 'ChIJdUVCfdMFzkwRYuwYLCZxHTQ', 3, 'link', 'https://www.inbloomtattoocollective.com/artists-in-residence', 'How to book with an artist'),
  ('Jeunesse Idem'                     , 'ChIJmfRXL_UEzkwRkw9Dh7K7sM0', 1, 'website', 'https://www.jeunesseidem.org/', null),
  ('Jeunesse Idem'                     , 'ChIJmfRXL_UEzkwRkw9Dh7K7sM0', 2, 'phone', '819-776-1445', 'Main line'),
  ('Jeunesse Idem'                     , 'ChIJmfRXL_UEzkwRkw9Dh7K7sM0', 3, 'phone', '1-877-776-1445', 'Toll-free'),
  ('Jeunesse Idem'                     , 'ChIJmfRXL_UEzkwRkw9Dh7K7sM0', 4, 'email', 'info@jeunesseidem.org', null),
  ('Jeunesse Idem'                     , 'ChIJmfRXL_UEzkwRkw9Dh7K7sM0', 5, 'link', 'https://www.jeunesseidem.org/activites', 'Activities and groups (French)'),
  ('Kind Space'                        , 'ChIJwdr86qwFzkwRUQi6ovC2EYo', 1, 'website', 'https://www.kindspace.ca/', null),
  ('Kind Space'                        , 'ChIJwdr86qwFzkwRUQi6ovC2EYo', 2, 'phone', '613-563-4818', null),
  ('Kind Space'                        , 'ChIJwdr86qwFzkwRUQi6ovC2EYo', 3, 'email', 'idclinic@kindspace.ca', 'Trans ID Clinic (October to March)'),
  ('Kind Space'                        , 'ChIJwdr86qwFzkwRUQi6ovC2EYo', 4, 'link', 'https://www.kindspace.ca/trans-id-clinic', 'Trans ID Clinic'),
  ('Kind Space'                        , 'ChIJwdr86qwFzkwRUQi6ovC2EYo', 5, 'link', 'https://www.kindspace.ca/contact', 'Contact form'),
  ('LGBT YouthLine'                    , null, 1, 'website', 'https://www.youthline.ca/', null),
  ('LGBT YouthLine'                    , null, 2, 'text', '647-694-4275', 'Peer support by text'),
  ('LGBT YouthLine'                    , null, 3, 'email', 'askus@youthline.ca', 'Peer support by email'),
  ('LGBT YouthLine'                    , null, 4, 'link', 'https://www.youthline.ca/helpline/peer-support-helpline/', 'Live chat'),
  ('Little Jo Berry''s'                , 'ChIJr5cgiRcEzkwRit5AJro54y8', 1, 'website', 'https://www.littlejoberrys.com/', null),
  ('Little Jo Berry''s'                , 'ChIJr5cgiRcEzkwRit5AJro54y8', 2, 'email', 'littlejoberrys@gmail.com', null),
  ('MAX Ottawa'                        , 'ChIJjypX7KwFzkwR3oI5TGpSgGA', 1, 'website', 'https://maxottawa.ca/', null),
  ('MAX Ottawa'                        , 'ChIJjypX7KwFzkwR3oI5TGpSgGA', 2, 'phone', '613-701-6555', null),
  ('MAX Ottawa'                        , 'ChIJjypX7KwFzkwR3oI5TGpSgGA', 3, 'email', 'info@maxottawa.ca', null),
  ('MAX Ottawa'                        , 'ChIJjypX7KwFzkwR3oI5TGpSgGA', 4, 'link', 'https://maxottawa.ca/programs-and-services/sti-testing/', 'STI testing swabs'),
  ('MAX Ottawa'                        , 'ChIJjypX7KwFzkwR3oI5TGpSgGA', 5, 'link', 'https://maxottawa.ca/programs-and-services/tea-to-go/', 'Free supplies (Tea2Go)'),
  ('Milk Shop'                         , 'ChIJ2emwN_0EzkwR2WPf5HHh0zU', 1, 'website', 'https://milkshop.ca/', null),
  ('Milk Shop'                         , 'ChIJ2emwN_0EzkwR2WPf5HHh0zU', 2, 'phone', '(613) 789-6455', null),
  ('Milk Shop'                         , 'ChIJ2emwN_0EzkwR2WPf5HHh0zU', 3, 'email', 'info@milkshop.ca', null),
  ('Ottawa Trans Library'              , 'ChIJn77cK4IFzkwRSwzFk_n-4Yo', 1, 'website', 'https://ottawatranslibrary.ca/', null),
  ('Ottawa Trans Library'              , 'ChIJn77cK4IFzkwRSwzFk_n-4Yo', 2, 'email', 'info@ottawatranslibrary.ca', null),
  ('Ottawa Trans Library'              , 'ChIJn77cK4IFzkwRSwzFk_n-4Yo', 3, 'link', 'https://www.librarycat.org/lib/otttranslib', 'Online catalogue'),
  ('PFLAG Ottawa'                      , null, 1, 'website', 'https://pflagcanada.ca/chapter/pflag-ottawa/', null),
  ('PFLAG Ottawa'                      , null, 2, 'email', 'support@pflagcanada.ca', 'PFLAG Canada, general inquiries'),
  ('PFLAG Ottawa'                      , null, 3, 'link', 'https://pflagcanada.ca/chapter/pflag-ottawa/#chapter-contact', 'Contact or waitlist form'),
  ('Pride Centre, University of Ottawa', null, 1, 'website', 'https://www.seuo-uosu.com/services/pride', null),
  ('Pride Centre, University of Ottawa', null, 2, 'email', 'pride@seuo-uosu.com', null),
  ('Pride Centre, University of Ottawa', null, 3, 'link', 'https://uopridecentre.librarika.com/', 'Queer Library catalogue'),
  ('Rideau Rollers'                    , 'ChIJF8yNlqkFniMRdIzpfnw4M7k', 1, 'website', 'https://rideaurollers.com/', null),
  ('Rideau Rollers'                    , 'ChIJF8yNlqkFniMRdIzpfnw4M7k', 2, 'phone', '613-514-0136', null),
  ('Rideau Rollers'                    , 'ChIJF8yNlqkFniMRdIzpfnw4M7k', 3, 'email', 'sales@rideaurollers.com', null),
  ('Rideau Rollers'                    , 'ChIJF8yNlqkFniMRdIzpfnw4M7k', 4, 'link', 'https://rideaurollers.com/pages/appointments', 'Book an appointment'),
  ('Swizzles'                          , 'ChIJJ_TfSFQEzkwRCr_OhUCXFWQ', 1, 'website', 'https://www.swizzles.ca/', null),
  ('Swizzles'                          , 'ChIJJ_TfSFQEzkwRCr_OhUCXFWQ', 2, 'phone', '(613) 232-4200', null),
  ('Swizzles'                          , 'ChIJJ_TfSFQEzkwRCr_OhUCXFWQ', 3, 'email', 'feedback@swizzles.ca', 'Feedback'),
  ('T''s Pub'                          , 'ChIJZxxyQ6wFzkwRf1xGBP_P1Ns', 1, 'website', 'https://www.tspub.ca/', null),
  ('T''s Pub'                          , 'ChIJZxxyQ6wFzkwRf1xGBP_P1Ns', 2, 'phone', '613-233-7375', null),
  ('T''s Pub'                          , 'ChIJZxxyQ6wFzkwRf1xGBP_P1Ns', 3, 'email', 'info@tspub.ca', null),
  ('Ten Oaks Project'                  , null, 1, 'website', 'https://www.tenoaksproject.org/', null),
  ('Ten Oaks Project'                  , null, 2, 'phone', '(613) 889-1537', null),
  ('Ten Oaks Project'                  , null, 3, 'email', 'info@tenoaksproject.org', null),
  ('Ten Oaks Project'                  , null, 4, 'link', 'https://www.tenoaksproject.org/community-programs/', 'Community programs'),
  ('Ten Oaks Project'                  , null, 5, 'link', 'https://www.tenoaksproject.org/camps/camp-ten-oaks/', 'Camp Ten Oaks'),
  ('The Good Companions'               , 'ChIJjd0jzk8EzkwRJUoYKp0YDIY', 1, 'website', 'https://thegoodcompanions.ca/', null),
  ('The Good Companions'               , 'ChIJjd0jzk8EzkwRJUoYKp0YDIY', 2, 'phone', '(613) 236-0428', null),
  ('The Good Companions'               , 'ChIJjd0jzk8EzkwRJUoYKp0YDIY', 3, 'email', 'info@thegoodcompanions.ca', null),
  ('The Good Companions'               , 'ChIJjd0jzk8EzkwRJUoYKp0YDIY', 4, 'link', 'https://ospn-rfao.ca/event/out-and-about-saturdays/', 'Out and About Saturdays (OSPN)'),
  ('The Good Companions'               , 'ChIJjd0jzk8EzkwRJUoYKp0YDIY', 5, 'link', 'https://thegoodcompanions.ca/community-support-services/2slgbtqia-programs-and-services/', '2SLGBTQIA+ programs'),
  ('The Lookout Bar'                   , 'ChIJ171JCwIFzkwRlsX_jkrM_UI', 1, 'website', 'https://www.thelookoutbar.com/', null),
  ('The Lookout Bar'                   , 'ChIJ171JCwIFzkwRlsX_jkrM_UI', 2, 'phone', '613-789-1624', null),
  ('The Lookout Bar'                   , 'ChIJ171JCwIFzkwRlsX_jkrM_UI', 3, 'link', 'https://www.eventbrite.ca/o/the-lookout-bar-amp-nightclub-28636623927', 'Event tickets'),
  ('The Spaniel''s Tale'               , 'ChIJJ5LBEAUFzkwRReRdUdqGVjI', 1, 'website', 'https://thespanielstale.ca/', null),
  ('The Spaniel''s Tale'               , 'ChIJJ5LBEAUFzkwRReRdUdqGVjI', 2, 'phone', '613-724-3000', null),
  ('The Spaniel''s Tale'               , 'ChIJJ5LBEAUFzkwRReRdUdqGVjI', 3, 'email', 'hello@thespanielstale.ca', null),
  ('United in Pride'                   , null, 1, 'website', 'https://unitedinpride.ca/', null),
  ('United in Pride'                   , null, 2, 'email', 'info@unitedinpride.ca', null),
  ('United in Pride'                   , null, 3, 'link', 'https://unitedinpride.ca/contact', 'Contact form'),
  ('United in Pride'                   , null, 4, 'link', 'https://unitedinpride.ca/programs', 'Programs')
  ),
  matched as (
    select v.id as venue_id, i.sort_order, i.kind, i.value, i.label
    from incoming i
    join public.venues v
      on (i.google_place_id is not null and v.google_place_id = i.google_place_id)
      or (i.google_place_id is null and v.google_place_id is null and v.name = i.name)
    -- Only places with no contacts yet: an admin's list always wins, and
    -- running this again adds nothing.
    where not exists (select 1 from public.venue_contacts c where c.venue_id = v.id)
  )
  insert into public.venue_contacts (venue_id, sort_order, kind, value, label)
  select venue_id, sort_order, kind, value, label
  from matched;

  get diagnostics v_added = row_count;
  raise notice 'directory contacts: % contact(s) added', v_added;
end;
$$;


-- To check afterwards (read-only): every listed place and how it can be reached.
--
--   select v.name, c.kind, c.label, c.value
--   from public.venues v
--   left join public.venue_contacts c on c.venue_id = v.id
--   where exists (select 1 from public.venue_tags vt where vt.venue_id = v.id)
--   order by v.name, c.sort_order;
