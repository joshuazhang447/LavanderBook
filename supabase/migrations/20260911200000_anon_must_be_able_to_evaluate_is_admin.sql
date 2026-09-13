-- A policy has to be evaluable by the role it applies to.
--
-- `tags` and `questions` are readable by everyone, with archived rows held back
-- from anyone but an admin:
--
--   using (archived_at is null or public.is_admin())
--
-- is_admin() was granted to authenticated and to nobody else, which was correct
-- while only the panel touched those tables. It stopped being correct the
-- moment venues_near and venues_search started returning a venue's tags: those
-- functions are security invoker, so reading public.tags evaluates that policy
-- as the caller - and a signed-out caller cannot execute the function in it.
--
-- The result was 42501 "permission denied for function is_admin" on every map
-- load for every signed-out visitor. Not a degraded map: no venues at all, on
-- the screen the whole app opens on.
--
-- Granting execute to anon tells anon nothing. is_admin() is security definer
-- over public.admins filtered by auth.uid(), and anon has no auth.uid(), so it
-- returns false and can only ever answer about the caller themselves.

grant execute on function public.is_admin() to anon;

comment on function public.is_admin() is
  'True when the caller is in public.admins. Granted to anon as well as authenticated: it is referenced by policies on public.tags and public.questions, which anon reads through venues_near, and a policy the role cannot evaluate is a policy that raises 42501.';
