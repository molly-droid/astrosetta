-- ============================================================================
-- Astrosetta Initial Schema Migration
-- Created: 2026-07-24
-- Description: Core tables for user profiles, charts, synthesis, and entitlements
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USER PROFILES & PROGRESS
-- ============================================================================

CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,

  -- XP & Tier System
  current_tier text NOT NULL DEFAULT 'Apprentice' CHECK (current_tier IN ('Apprentice', 'Adept', 'Maestro')),
  total_xp integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),

  -- Streak Tracking
  streak_count integer NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
  last_active_date date,

  -- Preferences
  preferences jsonb DEFAULT '{}',

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- BIRTH CHARTS
-- ============================================================================

CREATE TABLE saved_charts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Chart metadata
  label text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,

  -- Birth data
  birth_date date NOT NULL,
  birth_time time,
  time_known boolean NOT NULL DEFAULT true,

  -- Location
  place_name text NOT NULL,
  lat numeric(9, 6) NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lon numeric(9, 6) NOT NULL CHECK (lon >= -180 AND lon <= 180),
  iana_timezone text NOT NULL,
  utc_datetime timestamptz NOT NULL,
  tz_confidence text CHECK (tz_confidence IN ('high', 'medium', 'low')),

  -- Chart calculation result (JSON from @astro/core)
  chart_data jsonb NOT NULL,
  chart_data_version text NOT NULL,
  house_system text NOT NULL DEFAULT 'Placidus' CHECK (house_system IN ('Placidus', 'WholeSign', 'none')),

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_saved_charts_updated_at BEFORE UPDATE ON saved_charts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Only one primary chart per user
CREATE UNIQUE INDEX idx_one_primary_chart_per_user
  ON saved_charts(user_id)
  WHERE is_primary = true;

-- Indexes for performance
CREATE INDEX idx_saved_charts_user_id ON saved_charts(user_id);
CREATE INDEX idx_saved_charts_created_at ON saved_charts(created_at DESC);

-- ============================================================================
-- LLM-GENERATED SYNTHESIS
-- ============================================================================

CREATE TABLE synthesis (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chart_id uuid REFERENCES saved_charts(id) ON DELETE CASCADE,

  -- Synthesis metadata
  synthesis_type text NOT NULL CHECK (synthesis_type IN ('natal_overview', 'placement', 'transit', 'synastry')),
  placement_key text, -- e.g., 'sun_in_leo_house_10'

  -- Content
  content text NOT NULL,

  -- User feedback
  quality_rating integer CHECK (quality_rating >= 1 AND quality_rating <= 5),
  bookmarked boolean NOT NULL DEFAULT false,

  -- LLM tracking
  llm_model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  cache_expires_at timestamptz
);

CREATE INDEX idx_synthesis_chart_id ON synthesis(chart_id);
CREATE INDEX idx_synthesis_type_key ON synthesis(synthesis_type, placement_key);
CREATE INDEX idx_synthesis_bookmarked ON synthesis(user_id, bookmarked) WHERE bookmarked = true;

-- Add user_id for easier querying
ALTER TABLE synthesis ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_synthesis_user_id ON synthesis(user_id);

-- ============================================================================
-- LLM USAGE TRACKING
-- ============================================================================

CREATE TABLE llm_usage_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  synthesis_id uuid REFERENCES synthesis(id) ON DELETE SET NULL,

  -- Usage details
  model text NOT NULL,
  prompt_tokens integer NOT NULL CHECK (prompt_tokens >= 0),
  completion_tokens integer NOT NULL CHECK (completion_tokens >= 0),
  cost_usd numeric(10, 6) NOT NULL CHECK (cost_usd >= 0),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_llm_usage_user_id ON llm_usage_log(user_id);
CREATE INDEX idx_llm_usage_created_at ON llm_usage_log(created_at DESC);

-- ============================================================================
-- ENTITLEMENTS (Payment reconciliation)
-- ============================================================================

CREATE TABLE entitlements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Active tier
  tier text NOT NULL CHECK (tier IN ('Free', 'Interpret', 'Calendar')),

  -- Subscription source
  source text NOT NULL CHECK (source IN ('stripe', 'revenuecat_ios', 'revenuecat_android')),
  external_id text, -- Stripe subscription ID or RevenueCat app_user_id

  -- Status
  status text NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'expired')),
  period_start timestamptz,
  period_end timestamptz,
  will_renew boolean NOT NULL DEFAULT true,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_entitlements_updated_at BEFORE UPDATE ON entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_entitlements_user_id ON entitlements(user_id);
CREATE INDEX idx_entitlements_status ON entitlements(status);

-- ============================================================================
-- LEARNING MODULES
-- ============================================================================

CREATE TABLE learning_modules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Organization
  section text NOT NULL CHECK (section IN ('foundations', 'planets', 'signs', 'houses', 'aspects', 'transits')),
  title text NOT NULL,
  description text,
  order_index integer NOT NULL,

  -- Rewards
  xp_reward integer NOT NULL DEFAULT 50 CHECK (xp_reward >= 0),

  -- Content
  content_path text, -- Path to MDX file in @astro/content
  quiz_data jsonb, -- Quiz questions

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_learning_modules_section ON learning_modules(section, order_index);

-- ============================================================================
-- USER LEARNING PROGRESS
-- ============================================================================

CREATE TABLE user_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,

  -- Progress
  completed boolean NOT NULL DEFAULT false,
  quiz_score integer CHECK (quiz_score >= 0 AND quiz_score <= 100),
  xp_earned integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),

  completed_at timestamptz,

  UNIQUE(user_id, module_id)
);

CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_completed ON user_progress(user_id, completed);

-- ============================================================================
-- DAILY QUIZ ATTEMPTS
-- ============================================================================

CREATE TABLE daily_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  quiz_date date NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard')),
  xp_earned integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, quiz_date)
);

CREATE INDEX idx_daily_quiz_user_id ON daily_quiz_attempts(user_id);
CREATE INDEX idx_daily_quiz_date ON daily_quiz_attempts(quiz_date DESC);

-- ============================================================================
-- SYNASTRY COMPARISONS
-- ============================================================================

CREATE TABLE synastry_comparisons (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  chart1_id uuid NOT NULL REFERENCES saved_charts(id) ON DELETE CASCADE,
  chart2_id uuid NOT NULL REFERENCES saved_charts(id) ON DELETE CASCADE,

  label text, -- e.g., "Me & Partner"
  synastry_data jsonb, -- Aspects, overlays, composite chart
  synthesis_id uuid REFERENCES synthesis(id),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_synastry_user_id ON synastry_comparisons(user_id);

-- ============================================================================
-- FEEDBACK & ERROR REPORTING
-- ============================================================================

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  feedback_type text NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'general')),
  subject text,
  message text NOT NULL,
  screenshot_url text,
  device_info jsonb,

  -- Admin workflow
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  admin_notes text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- ============================================================================
-- CALENDAR SYNC
-- ============================================================================

CREATE TABLE calendar_sync (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- OAuth details
  provider text NOT NULL CHECK (provider IN ('google')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text, -- External calendar ID

  -- Sync state
  sync_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_calendar_sync_updated_at BEFORE UPDATE ON calendar_sync
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRANSIT POSITIONS (Precomputed)
-- ============================================================================

CREATE TABLE transit_positions (
  date date NOT NULL,
  hour integer NOT NULL CHECK (hour >= 0 AND hour <= 23),
  body text NOT NULL,

  lon numeric(9, 6) NOT NULL,
  lat numeric(9, 6) NOT NULL,
  speed numeric(9, 6) NOT NULL,
  retrograde boolean NOT NULL,

  PRIMARY KEY (date, hour, body)
);

CREATE INDEX idx_transit_positions_date ON transit_positions(date);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE synastry_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync ENABLE ROW LEVEL SECURITY;

-- User Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Saved Charts: Users can manage their own charts
CREATE POLICY "Users can view own charts"
  ON saved_charts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own charts"
  ON saved_charts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own charts"
  ON saved_charts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own charts"
  ON saved_charts FOR DELETE
  USING (auth.uid() = user_id);

-- Synthesis: Users can view synthesis for their charts
CREATE POLICY "Users can view own synthesis"
  ON synthesis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert synthesis"
  ON synthesis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own synthesis"
  ON synthesis FOR UPDATE
  USING (auth.uid() = user_id);

-- Entitlements: Users can view their own entitlement
CREATE POLICY "Users can view own entitlement"
  ON entitlements FOR SELECT
  USING (auth.uid() = user_id);

-- User Progress: Users can manage their own progress
CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Daily Quiz: Users can view/insert their own attempts
CREATE POLICY "Users can view own quiz attempts"
  ON daily_quiz_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quiz attempts"
  ON daily_quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Synastry: Users can manage their own comparisons
CREATE POLICY "Users can view own synastry"
  ON synastry_comparisons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own synastry"
  ON synastry_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own synastry"
  ON synastry_comparisons FOR DELETE
  USING (auth.uid() = user_id);

-- Feedback: Users can insert and view their own feedback
CREATE POLICY "Users can insert feedback"
  ON feedback FOR INSERT
  WITH CHECK (true); -- Anyone can submit feedback

CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Calendar Sync: Users can manage their own sync settings
CREATE POLICY "Users can view own calendar sync"
  ON calendar_sync FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar sync"
  ON calendar_sync FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar sync"
  ON calendar_sync FOR UPDATE
  USING (auth.uid() = user_id);

-- Learning Modules: Public read access
ALTER TABLE learning_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learning modules are publicly readable"
  ON learning_modules FOR SELECT
  USING (true);

-- Transit Positions: Public read access
ALTER TABLE transit_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transit positions are publicly readable"
  ON transit_positions FOR SELECT
  USING (true);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data->>'display_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to calculate user tier from XP
CREATE OR REPLACE FUNCTION public.calculate_tier_from_xp(xp integer)
RETURNS text AS $$
BEGIN
  IF xp >= 5000 THEN
    RETURN 'Maestro';
  ELSIF xp >= 2000 THEN
    RETURN 'Adept';
  ELSE
    RETURN 'Apprentice';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default learning modules (placeholders)
INSERT INTO learning_modules (section, title, description, order_index, xp_reward) VALUES
  ('foundations', 'The Chart as a Map', 'Understanding the structure of an astrological chart', 1, 50),
  ('foundations', 'Planets: What Each One Is', 'Introduction to the planetary energies', 2, 50),
  ('foundations', 'Signs: The 12 Styles', 'Elements, modalities, and polarities', 3, 50),
  ('foundations', 'Houses: The 12 Arenas', 'Life areas and house meanings', 4, 50),
  ('foundations', 'Reading a Placement', 'Synthesizing planet + sign + house', 5, 75),
  ('foundations', 'Aspects: How Planets Talk', 'Understanding planetary relationships', 6, 75),
  ('foundations', 'The Angles & Chart Shape', 'Ascendant, MC, and chart patterns', 7, 75),
  ('foundations', 'Transits: The Moving Sky', 'Introduction to planetary transits', 8, 100);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_saved_charts_user_primary ON saved_charts(user_id, is_primary);
CREATE INDEX idx_synthesis_cache_lookup ON synthesis(chart_id, synthesis_type, placement_key) WHERE cache_expires_at > now();
CREATE INDEX idx_user_progress_completed_modules ON user_progress(user_id) WHERE completed = true;
CREATE INDEX idx_entitlements_active ON entitlements(user_id) WHERE status = 'active';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_profiles IS 'User profile information, XP, and tier progression';
COMMENT ON TABLE saved_charts IS 'Birth chart data and calculation results';
COMMENT ON TABLE synthesis IS 'LLM-generated interpretations and synthesis';
COMMENT ON TABLE llm_usage_log IS 'Tracking LLM API usage and costs';
COMMENT ON TABLE entitlements IS 'Payment tier reconciliation across Stripe and RevenueCat';
COMMENT ON TABLE learning_modules IS 'Educational content modules';
COMMENT ON TABLE user_progress IS 'User completion tracking for learning modules';
COMMENT ON TABLE daily_quiz_attempts IS 'Daily quiz participation and scores';
COMMENT ON TABLE synastry_comparisons IS 'Relationship chart comparisons';
COMMENT ON TABLE feedback IS 'User feedback and bug reports';
COMMENT ON TABLE calendar_sync IS 'Google Calendar integration state';
COMMENT ON TABLE transit_positions IS 'Precomputed daily planetary positions';
