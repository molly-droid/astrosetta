-- ============================================================================
-- Astrosetta Base44 replica schema
-- Generated from base44/entities/*.jsonc (the exported Base44 entity schemas).
--
-- Conventions, mirroring Base44's record model so the frontend shim
-- (apps/web/src/api/shim/) needs no field mapping:
--   * Every table carries the Base44 built-ins: id, created_date,
--     updated_date, created_by (email), created_by_id (auth uid).
--   * Enum-typed fields are plain text (no CHECK) so the production data
--     import cannot fail on out-of-enum legacy values.
--   * user_id / *_id reference fields stay text, as Base44 stored them.
--     The import maps old Base44 ids to new auth uids; RLS ownership checks
--     use created_by_id (uuid) except where Base44's own rules keyed on the
--     user_id field (calendar_synthesis, event_order).
--   * JSON arrays/objects are jsonb.
--   * RLS policies transcribe each entity's "rls" block from its .jsonc.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_date()
returns trigger as $$
begin
  new.updated_date = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- users — the Base44 User entity (auth built-ins + app fields).
-- Row id = auth.users id; created by the signup trigger below.
-- ----------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  -- Base44 auth built-ins the app reads
  email text,
  full_name text,

  role text not null default 'learner',
  display_name text,
  birth_date date,
  birth_time text,
  birth_location text,
  current_timezone text,
  time_format text not null default '12h',
  xp_total integer not null default 0,
  level text not null default 'apprentice',
  streak_days integer not null default 0,
  last_active timestamptz,
  subscription_tier text not null default 'free',
  subscription_expires timestamptz,
  subscription_source text,
  stripe_customer_id text,
  stripe_subscription_id text,
  iap_transaction_id text,
  is_founding_member boolean default true,
  founding_tier_preference text,
  seen_spotlights jsonb,
  daily_email_opt_in boolean not null default true,
  weekly_email_opt_in boolean not null default true,
  monthly_email_opt_in boolean not null default true,
  show_asteroids boolean not null default true,
  show_angles boolean not null default true,
  show_lots boolean not null default true,
  show_nodes boolean not null default true,
  show_lilith boolean not null default true,
  font_scale double precision not null default 1
);

create trigger users_updated_date before update on public.users
  for each row execute function public.set_updated_date();

-- security definer so policies on users itself don't recurse
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- Signup provisioning. is_founding_member = true replicates the live
-- stampFoundingMember behavior (LAUNCH_DATE is null: everyone signing up
-- during beta is a founding member). Revisit when the client declares launch.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, is_founding_member)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.users enable row level security;

create policy users_select on public.users for select
  using (id = auth.uid() or public.is_admin());
create policy users_update on public.users for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy users_delete on public.users for delete
  using (public.is_admin());
-- inserts happen via the signup trigger (security definer) or service role

-- ----------------------------------------------------------------------------
-- Entity tables
-- ----------------------------------------------------------------------------
-- Base44 built-in columns, repeated on every table:
--   id, created_date, updated_date, created_by (creator email),
--   created_by_id (creator auth uid; kept on user deletion for shared
--   content — the accountDeletion function does explicit cleanup of
--   personal rows, replicating Base44)

create table public.account_deletion_request (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  user_email text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  status text not null,
  completed_at timestamptz
);

create table public.calendar_synthesis (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  period_type text not null,
  period_key text not null,
  target_chart_id text,
  topic_key text,
  date_start date not null,
  date_end date not null,
  summary text not null,
  description text not null,
  data jsonb,
  generated_at timestamptz
);

create table public.chart (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  raw_data jsonb,
  placement_keys jsonb,
  ascendant_sign text,
  sun_sign text,
  moon_sign text,
  calculated_at timestamptz,
  description text
);

create table public.daily_quiz (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  date_key text not null,
  user_timezone text,
  tier text not null,
  quiz_mode text not null,
  questions jsonb not null,
  user_answers jsonb,
  score integer,
  completed_at timestamptz,
  tier_at_completion text,
  description text
);

create table public.error_log (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text,
  error_message text not null,
  stack_trace text,
  page_url text,
  user_agent text,
  component_stack text,
  description text
);

create table public.event_order (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  event_id text not null,
  first_name text not null,
  sku_id text not null,
  tier text not null,
  billing_cycle text not null,
  item_type text,
  metal text,
  pickup_status text not null,
  signup_channel text not null,
  remote boolean,
  sold_out boolean,
  shipping_address jsonb,
  sun_sign text,
  moon_sign text,
  rising_sign text,
  picked_up_at timestamptz,
  fulfillment_notified_at timestamptz
);

create table public.feature_highlight (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  spotlight_key text not null,
  title text not null,
  subtitle text,
  description text,
  deep_link text,
  icon text,
  go_live_date date not null,
  end_date date,
  show_on_homepage boolean,
  show_in_email boolean,
  show_in_notification boolean,
  is_archived boolean
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text,
  type text not null,
  subject text not null,
  description text not null,
  page_url text,
  screenshot_url text,
  status text,
  admin_notes text
);

create table public.founding_patron (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  display_name text not null
);

create table public.glossary_item (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  term_key text not null,
  display_name text not null,
  category text not null,
  definition_essential text not null,
  definition_technical text,
  aliases jsonb,
  description text
);

create table public.incentive_sku (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  event_id text not null,
  sku_id text not null,
  tier text not null,
  billing_cycle text not null,
  item_type text not null,
  metal text,
  stock_total integer not null,
  stock_remaining integer not null,
  is_remote boolean
);

create table public.interpretation (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  placement_key text not null,
  "text" text not null,
  tone text not null,
  experience_level text not null,
  contributor_id text,
  source_platform text,
  source_url text,
  rating_score double precision,
  rating_count integer,
  status text
);

create table public.llm_usage_log (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  date_key text not null,
  call_count integer,
  description text
);

create table public.learning_module (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  section text not null,
  subject_key text not null,
  title text not null,
  subtitle text,
  glyph text,
  order_index integer not null,
  content_blocks jsonb,
  mastery_blocks jsonb,
  mastery_xp_reward integer,
  xp_reward integer,
  color_theme text,
  description text
);

create table public.placement (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  canonical_key text not null,
  display_name text not null,
  placement_type text not null,
  planet text,
  sign_or_house text,
  aspect_type text,
  description text
);

create table public.planet_correction (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  planet text not null,
  longitude_offset double precision not null,
  checked_at timestamptz,
  source text,
  description text
);

create table public.planner_journal_entry (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  date_key text not null,
  notes text
);

create table public.popup_event (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  event_id text not null,
  event_name text not null,
  promo_code text not null,
  qr_src_param text not null,
  start_date date not null,
  end_date date not null,
  promo_valid_until date not null,
  pickup_deadline_note text,
  notify_email text,
  is_active boolean
);

create table public.roadmap_item (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  title text not null,
  category text,
  notes text,
  status text not null,
  order_index integer
);

create table public.saved_chart (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  chart_type text,
  name text not null,
  relationship text,
  pronouns text,
  deceased boolean,
  date_of_death date,
  birth_date date not null,
  birth_time text,
  birth_location jsonb,
  utc_offset double precision,
  raw_data jsonb,
  sun_sign text,
  moon_sign text,
  ascendant_sign text,
  description text
);

create table public.streak_bonus_content (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  date_key text not null,
  headline text,
  transit_subject text,
  scenario text,
  transit_context text,
  content text,
  generated_at timestamptz
);

create table public.synthesis_rating (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  date_key text not null,
  chart_id text,
  rating text,
  bookmarked boolean,
  synthesis_overview text,
  description text
);

create table public.user_interpretation_rating (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  interpretation_id text not null,
  rating text not null,
  rated_at timestamptz,
  description text
);

create table public.user_module_progress (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  module_id text not null,
  status text,
  current_block_index integer,
  xp_earned integer,
  completed_at timestamptz,
  quiz_answers jsonb,
  mastery_completed_at timestamptz,
  mastery_xp_earned integer,
  description text
);

create table public.user_placement_progress (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  placement_key text not null,
  status text,
  rating_given text,
  xp_earned integer,
  completed_at timestamptz,
  description text
);

create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  current_tier text not null,
  knowledge_depth text,
  active_tradition text,
  timezone text,
  house_system text,
  recommended_start_section text,
  referral_source text,
  referral_source_detail text,
  consecutive_streak_count integer,
  streak_best integer,
  streak_last_date text,
  modules_completed integer,
  total_answered integer,
  accuracy_rate double precision,
  tier_started_at timestamptz,
  curriculum_started_at timestamptz,
  apprentice_quiz_days_count integer,
  adept_quiz_days_count integer,
  apprentice_correct_total integer,
  apprentice_questions_total integer,
  adept_correct_total integer,
  adept_questions_total integer,
  description text
);

create table public.waitlist_email (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  email text not null,
  source text,
  description text
);

create table public.xp_event (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete set null,
  user_id text not null,
  event_type text not null,
  xp_amount integer not null,
  reference_id text,
  description text
);

-- Navigator conversations (Base44 agents replacement; not a Base44 entity).
-- messages is the whole conversation as a jsonb array — the shape
-- FloatingNavigator renders. The navigator-chat Edge Function (service
-- role) appends messages; clients receive updates via realtime.
create table public.agent_conversation (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email'),
  created_by_id uuid default auth.uid() references auth.users(id) on delete cascade,
  agent_name text not null,
  metadata jsonb not null default '{}',
  messages jsonb not null default '[]'
);

-- ----------------------------------------------------------------------------
-- updated_date triggers
-- ----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'account_deletion_request','calendar_synthesis','chart','daily_quiz',
    'error_log','event_order','feature_highlight','feedback','founding_patron',
    'glossary_item','incentive_sku','interpretation','llm_usage_log',
    'learning_module','placement','planet_correction','planner_journal_entry',
    'popup_event','roadmap_item','saved_chart','streak_bonus_content',
    'synthesis_rating','user_interpretation_rating','user_module_progress',
    'user_placement_progress','user_progress','waitlist_email','xp_event',
    'agent_conversation'
  ] loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_date()',
      t || '_updated_date', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Row-level security
-- Transcribed from each entity's "rls" block ({{user.id}} -> auth.uid(),
-- user_condition role admin -> is_admin()).
-- ----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'account_deletion_request','calendar_synthesis','chart','daily_quiz',
    'error_log','event_order','feature_highlight','feedback','founding_patron',
    'glossary_item','incentive_sku','interpretation','llm_usage_log',
    'learning_module','placement','planet_correction','planner_journal_entry',
    'popup_event','roadmap_item','saved_chart','streak_bonus_content',
    'synthesis_rating','user_interpretation_rating','user_module_progress',
    'user_placement_progress','user_progress','waitlist_email','xp_event',
    'agent_conversation'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Owner-or-admin full CRUD: Chart, DailyQuiz, PlannerJournalEntry,
-- SavedChart, SynthesisRating, UserInterpretationRating, UserModuleProgress,
-- UserPlacementProgress, UserProgress — and agent_conversation (owner data)
do $$
declare t text;
begin
  foreach t in array array[
    'chart','daily_quiz','planner_journal_entry','saved_chart',
    'synthesis_rating','user_interpretation_rating','user_module_progress',
    'user_placement_progress','user_progress','agent_conversation'
  ] loop
    execute format('create policy %I on public.%I for insert to authenticated
      with check (created_by_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for select to authenticated
      using (created_by_id = auth.uid() or public.is_admin())', t || '_select', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (created_by_id = auth.uid() or public.is_admin())
      with check (created_by_id = auth.uid() or public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (created_by_id = auth.uid() or public.is_admin())', t || '_delete', t);
  end loop;
end $$;

-- LLMUsageLog: owner create/read/update, admin delete
create policy llm_usage_log_insert on public.llm_usage_log for insert to authenticated
  with check (created_by_id = auth.uid());
create policy llm_usage_log_select on public.llm_usage_log for select to authenticated
  using (created_by_id = auth.uid() or public.is_admin());
create policy llm_usage_log_update on public.llm_usage_log for update to authenticated
  using (created_by_id = auth.uid() or public.is_admin())
  with check (created_by_id = auth.uid() or public.is_admin());
create policy llm_usage_log_delete on public.llm_usage_log for delete to authenticated
  using (public.is_admin());

-- Feedback and XPEvent: owner create, owner-or-admin read, admin update/delete
do $$
declare t text;
begin
  foreach t in array array['feedback','xp_event'] loop
    execute format('create policy %I on public.%I for insert to authenticated
      with check (created_by_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for select to authenticated
      using (created_by_id = auth.uid() or public.is_admin())', t || '_select', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (public.is_admin()) with check (public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (public.is_admin())', t || '_delete', t);
  end loop;
end $$;

-- Admin-only: AccountDeletionRequest, StreakBonusContent
do $$
declare t text;
begin
  foreach t in array array['account_deletion_request','streak_bonus_content'] loop
    execute format('create policy %I on public.%I for all to authenticated
      using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;

-- Public read, admin write: FeatureHighlight, FoundingPatron, GlossaryItem,
-- IncentiveSKU, PlanetCorrection, PopupEvent — plus LearningModule,
-- Placement, RoadmapItem (no rls block in the export; the app reads them
-- everywhere and writes them only from admin screens)
do $$
declare t text;
begin
  foreach t in array array[
    'feature_highlight','founding_patron','glossary_item','incentive_sku',
    'planet_correction','popup_event','learning_module','placement','roadmap_item'
  ] loop
    execute format('create policy %I on public.%I for select to anon, authenticated
      using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated
      with check (public.is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (public.is_admin()) with check (public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (public.is_admin())', t || '_delete', t);
  end loop;
end $$;

-- Anyone may create, admin everything else: ErrorLog, WaitlistEmail
do $$
declare t text;
begin
  foreach t in array array['error_log','waitlist_email'] loop
    execute format('create policy %I on public.%I for insert to anon, authenticated
      with check (true)', t || '_insert', t);
    execute format('create policy %I on public.%I for select to authenticated
      using (public.is_admin())', t || '_select', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (public.is_admin()) with check (public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (public.is_admin())', t || '_delete', t);
  end loop;
end $$;

-- CalendarSynthesis: Base44 keyed ownership on the user_id field
create policy calendar_synthesis_insert on public.calendar_synthesis for insert to authenticated
  with check (user_id = auth.uid()::text);
create policy calendar_synthesis_select on public.calendar_synthesis for select to authenticated
  using (user_id = auth.uid()::text or public.is_admin());
create policy calendar_synthesis_update on public.calendar_synthesis for update to authenticated
  using (user_id = auth.uid()::text or public.is_admin())
  with check (user_id = auth.uid()::text or public.is_admin());
create policy calendar_synthesis_delete on public.calendar_synthesis for delete to authenticated
  using (public.is_admin());

-- EventOrder: owner (by user_id) may read; all writes are admin/server
create policy event_order_select on public.event_order for select to authenticated
  using (user_id = auth.uid()::text or public.is_admin());
create policy event_order_insert on public.event_order for insert to authenticated
  with check (public.is_admin());
create policy event_order_update on public.event_order for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy event_order_delete on public.event_order for delete to authenticated
  using (public.is_admin());

-- Interpretation: community content with moderation states
create policy interpretation_insert on public.interpretation for insert to authenticated
  with check (created_by_id = auth.uid());
create policy interpretation_select on public.interpretation for select to authenticated
  using (status = 'active' or created_by_id = auth.uid() or public.is_admin());
create policy interpretation_update on public.interpretation for update to authenticated
  using ((created_by_id = auth.uid() and status in ('pending', 'flagged')) or public.is_admin())
  with check ((created_by_id = auth.uid() and status in ('pending', 'flagged')) or public.is_admin());
create policy interpretation_delete on public.interpretation for delete to authenticated
  using ((created_by_id = auth.uid() and status in ('pending', 'flagged')) or public.is_admin());

-- ----------------------------------------------------------------------------
-- Indexes for the app's hot filters
-- ----------------------------------------------------------------------------

create index chart_user_id_idx on public.chart (user_id);
create index chart_created_by_id_idx on public.chart (created_by_id);
create index saved_chart_created_by_id_idx on public.saved_chart (created_by_id);
create index daily_quiz_user_date_idx on public.daily_quiz (user_id, date_key);
create index calendar_synthesis_user_period_idx on public.calendar_synthesis (user_id, period_key);
create index planner_journal_entry_user_date_idx on public.planner_journal_entry (user_id, date_key);
create index synthesis_rating_user_date_idx on public.synthesis_rating (user_id, date_key);
create index llm_usage_log_user_date_idx on public.llm_usage_log (user_id, date_key);
create index xp_event_user_id_idx on public.xp_event (user_id);
create index user_progress_user_id_idx on public.user_progress (user_id);
create index user_module_progress_user_module_idx on public.user_module_progress (user_id, module_id);
create index user_placement_progress_user_key_idx on public.user_placement_progress (user_id, placement_key);
create index user_interpretation_rating_user_interp_idx on public.user_interpretation_rating (user_id, interpretation_id);
create index interpretation_placement_status_idx on public.interpretation (placement_key, status);
create index glossary_item_term_key_idx on public.glossary_item (term_key);
create index placement_canonical_key_idx on public.placement (canonical_key);
create index learning_module_section_order_idx on public.learning_module (section, order_index);
create index feature_highlight_go_live_idx on public.feature_highlight (go_live_date);
create index streak_bonus_content_date_key_idx on public.streak_bonus_content (date_key);
create index event_order_event_id_idx on public.event_order (event_id);
create index event_order_user_id_idx on public.event_order (user_id);
create index incentive_sku_event_sku_idx on public.incentive_sku (event_id, sku_id);
create index waitlist_email_email_idx on public.waitlist_email (email);
create index agent_conversation_owner_idx on public.agent_conversation (created_by_id, agent_name);

-- ----------------------------------------------------------------------------
-- Realtime for the tables the app subscribes to
-- (EventOrder/IncentiveSKU admin queue + Navigator conversations)
-- ----------------------------------------------------------------------------

alter publication supabase_realtime add table public.event_order;
alter publication supabase_realtime add table public.incentive_sku;
alter publication supabase_realtime add table public.agent_conversation;

-- ----------------------------------------------------------------------------
-- Storage: public bucket for UploadPublicFile (feedback screenshots)
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('public', 'public', true)
on conflict (id) do nothing;

create policy public_bucket_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'public');
create policy public_bucket_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'public');
