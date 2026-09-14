import { base44 } from '@/api/base44Client';

// Centralized event names — keeps tracking consistent and typo-free
export const EVENTS = {
  LANDING_PAGE_VIEWED: 'landing_page_viewed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  CHART_CREATED: 'chart_created',
  DAILY_QUIZ_COMPLETED: 'daily_quiz_completed',
  PLANNER_VIEWED: 'planner_viewed',
  SUBSCRIBE_VIEWED: 'subscribe_page_viewed',
  SUBSCRIPTION_STARTED: 'subscription_started',
  NAVIGATOR_CHAT_OPENED: 'navigator_chat_opened',
  CALENDAR_SYNCED: 'calendar_synced',
  EMAIL_CAPTURED: 'email_captured',
  KNOWLEDGE_DENSITY_CHANGED: 'knowledge_density_changed',
};

/**
 * Fire-and-forget analytics tracking.
 * Never throws — analytics must not break user flows.
 */
export function track(eventName, properties = {}) {
  try {
    base44.analytics.track({ eventName, properties });
  } catch {
    // silent
  }
}