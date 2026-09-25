// Base44 entity name -> Postgres table name.
// Tables replicate the Base44 record shape: every table carries the built-in
// columns id, created_date, updated_date, created_by in addition to the
// fields declared in base44/entities/<Name>.jsonc.
export const ENTITY_TABLES = {
  AccountDeletionRequest: 'account_deletion_request',
  CalendarSynthesis: 'calendar_synthesis',
  Chart: 'chart',
  DailyQuiz: 'daily_quiz',
  ErrorLog: 'error_log',
  EventOrder: 'event_order',
  Feedback: 'feedback',
  FeatureHighlight: 'feature_highlight',
  FoundingPatron: 'founding_patron',
  GlossaryItem: 'glossary_item',
  IncentiveSKU: 'incentive_sku',
  Interpretation: 'interpretation',
  LLMUsageLog: 'llm_usage_log',
  LearningModule: 'learning_module',
  Placement: 'placement',
  PlanetCorrection: 'planet_correction',
  PlannerJournalEntry: 'planner_journal_entry',
  PopupEvent: 'popup_event',
  RoadmapItem: 'roadmap_item',
  SavedChart: 'saved_chart',
  StreakBonusContent: 'streak_bonus_content',
  SynthesisRating: 'synthesis_rating',
  User: 'users', // "user" is reserved in Postgres
  UserInterpretationRating: 'user_interpretation_rating',
  UserModuleProgress: 'user_module_progress',
  UserPlacementProgress: 'user_placement_progress',
  UserProgress: 'user_progress',
  WaitlistEmail: 'waitlist_email',
  XPEvent: 'xp_event',
};
