-- UX-02: chart display points start OFF.
--
-- The users table declared all five show_* flags `default true`, so every new
-- account opened its chart with asteroids, lots, nodes, Lilith and the angle
-- row already drawn. The client now reads them as default-off (=== true), and
-- these column defaults make new rows agree.
--
-- EXISTING rows are deliberately left alone: those values are real choices
-- (or at least a state people have been looking at all beta), and silently
-- flipping someone's display settings is not ours to do. Beta accounts that
-- want the new clean default can toggle them off, or run:
--   update public.users set show_asteroids = false, show_angles = false,
--     show_lots = false, show_nodes = false, show_lilith = false;

alter table public.users alter column show_asteroids set default false;
alter table public.users alter column show_angles    set default false;
alter table public.users alter column show_lots      set default false;
alter table public.users alter column show_nodes     set default false;
alter table public.users alter column show_lilith    set default false;
