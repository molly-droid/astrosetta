-- The worker is inert until the separately verified configuration is enabled.
select cron.schedule('subscriber-admin-notices','* * * * *',
  $$select public.invoke_edge_function('notify-admin-subscriber','{}'::jsonb)$$);
