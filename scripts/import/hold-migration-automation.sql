-- Apply before importing customer records. Base44 is never modified.
-- Intentionally remains on hold until email copy and testing are approved.
begin;
alter table public.chart disable trigger chart_welcome_email;
select cron.alter_job(jobid, active := false)
from cron.job
where jobname in (
  'daily-email-digest', 'weekly-email-digest', 'monthly-email-digest',
  'weekly-feedback-digest', 'calendar-synthesis-generation',
  'pre-generate-daily-synthesis', 'pre-generate-interpretations'
);
commit;
select jobname, active from cron.job order by jobname;
