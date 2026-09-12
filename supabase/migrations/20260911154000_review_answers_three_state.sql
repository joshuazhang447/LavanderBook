-- review_answers had nowhere to store a 'yes_no_unsure' answer.
--
-- That kind exists because of the reasoning already written into public.answer:
-- for a safety directory, a reviewer who never checked must not be recorded as
-- reporting "no". But the value columns were text / number / bool / option ids,
-- and a boolean has exactly two states - so the one kind added specifically to
-- preserve "not sure" had no way to preserve it.
--
-- Fixed by reusing public.answer rather than inventing a second three-state
-- vocabulary, so a tag question and reviews.trans_bathroom answer in the same
-- terms and can be read by the same code.
--
-- Safe to do as an alter: nothing writes this table yet. submit_review, which
-- will be its only writer, is still to come.

alter table public.review_answers add column value_answer public.answer;

alter table public.review_answers drop constraint review_answers_exactly_one_value;

alter table public.review_answers add constraint review_answers_exactly_one_value
  check (
    num_nonnulls(value_text, value_number, value_bool, value_answer, value_option_ids) = 1
  );

comment on column public.review_answers.value_answer is
  'For the yes_no_unsure kind. public.answer rather than a nullable boolean, because null already means "this question was not answered" and "answered, but the person did not know" is a different and equally real thing to record.';

-- The full map, so the next person does not have to infer it from the check
-- constraint. Times and dates are ISO-8601 text rather than three more nullable
-- columns: 'HH:MM' and 'YYYY-MM-DD' sort and compare correctly as text, and
-- three more columns would repeat exactly the problem that config jsonb exists
-- to avoid. Format is enforced by submit_review, the only writer.
comment on table public.review_answers is
  'A reviewer''s answer to one tag question. The question_id foreign key carries no ON DELETE clause on purpose - it is what makes an answered question undeletable, and therefore what makes a stored answer permanently readable in the wording it was given under.

Which column holds which kind:
  value_bool       yes_no
  value_answer     yes_no_unsure
  value_option_ids single_select (exactly one), multi_select
  value_number     number, scale, rating, currency (amount; code in config), duration (amount; unit in config)
  value_text       short_text, long_text,
                   time_of_day  as ''HH:MM'',
                   time_range   as ''HH:MM-HH:MM'',
                   date         as ''YYYY-MM-DD''';
