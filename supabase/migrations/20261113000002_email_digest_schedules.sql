-- Poll in small batches instead of generating all members' emails in one
-- Edge invocation. Handlers restrict delivery to 07:00-08:59 Chicago time,
-- Mondays for weekly, and the first for monthly. Both UTC offsets cover DST.
-- Each poll may claim one member; no past periods are backfilled.
select cron.schedule('daily-email-digest', '* 12-14 * * *',
  $$select public.invoke_edge_function('send-daily-email', '{"scheduled":true,"appUrl":"https://astrosetta.com"}'::jsonb)$$);
select cron.schedule('weekly-email-digest', '* 12-14 * * 1',
  $$select public.invoke_edge_function('send-weekly-email', '{"scheduled":true,"appUrl":"https://astrosetta.com"}'::jsonb)$$);
select cron.schedule('monthly-email-digest', '* 12-14 1 * *',
  $$select public.invoke_edge_function('send-monthly-email', '{"scheduled":true,"appUrl":"https://astrosetta.com"}'::jsonb)$$);
select cron.schedule('weekly-feedback-digest', '0 13,14 * * 1',
  $$select public.invoke_edge_function('send-feedback-digest', '{"scheduled":true}'::jsonb)$$);
-- Operator activates only after deploying the handlers, checking dry runs,
-- and disabling the source system's four corresponding email schedules.
select cron.alter_job(jobid, active := false) from cron.job
where jobname in ('daily-email-digest','weekly-email-digest','monthly-email-digest','weekly-feedback-digest');
-- Detailed onboarding recap replaces this older short welcome email.
alter table public.chart disable trigger chart_welcome_email;
