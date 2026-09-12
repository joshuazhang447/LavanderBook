-- question_config_valid returned NULL where it meant false, and a CHECK
-- constraint lets NULL through.
--
-- `jsonb_typeof(j -> 'min') = 'number'` is NULL when the key is absent, not
-- false, and NULL propagates through the whole AND chain. So the three kinds
-- with REQUIRED settings - scale, currency, duration - each answered NULL when
-- the setting was simply missing, and a CHECK constraint only rejects on false.
-- A scale question with no bounds, which is the precise thing this function
-- exists to catch, would have been stored happily and then failed to render.
--
-- The fix is one coalesce around the whole CASE. Everything else is unchanged:
-- a validator that cannot prove a config is valid must say no.
--
-- The general trap, worth remembering the next time a CHECK is written here:
-- three-valued logic means `check (f(x))` passes when f returns NULL. Any
-- predicate built from jsonb key lookups needs to end in coalesce(..., false).

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
  select jsonb_typeof((select j from c)) = 'object' and coalesce((select
    case p_kind

      when 'number' then
            (not j ? 'min'  or jsonb_typeof(j -> 'min')  = 'number')
        and (not j ? 'max'  or jsonb_typeof(j -> 'max')  = 'number')
        and (not j ? 'step' or (jsonb_typeof(j -> 'step') = 'number'
                                and (j ->> 'step')::numeric > 0))
        and (not j ? 'unit' or jsonb_typeof(j -> 'unit') = 'string')
        and (not (j ? 'min' and j ? 'max')
             or (j ->> 'min')::numeric <= (j ->> 'max')::numeric)

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

      else true
    end
  from c), false);
$$;

comment on function public.question_config_valid(public.question_kind, jsonb) is
  'Shape check for questions.config, called from a CHECK constraint. Validates the invariants that would break a control at render time; tolerates unknown keys so config can grow without a migration. Returns false rather than NULL for a missing required setting - a CHECK constraint treats NULL as a pass.';
