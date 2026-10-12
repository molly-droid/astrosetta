-- PF-03: pre-generate chart interpretations (classic placements + houses)
-- per account so readings are already saved when a user first opens their
-- chart. The function processes one chart per call (capped), so a frequent
-- schedule catches new signups up within the hour without long runs.
--
-- Uses the same invoke_edge_function() seam as the other scheduled jobs —
-- vault secrets edge_base_url + edge_service_key must be seeded.

select cron.unschedule('pre-generate-interpretations')
  where exists (select 1 from cron.job where jobname = 'pre-generate-interpretations');

select cron.schedule('pre-generate-interpretations', '*/10 * * * *',
  $$select public.invoke_edge_function('pre-generate-interpretations', '{}'::jsonb)$$);
