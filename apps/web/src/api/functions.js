// Named wrappers around the backend functions. Feature code today calls
// base44.functions.invoke('name', payload) directly; these exports exist for
// convenience/compatibility with the old Base44 export surface.
import { base44 } from './base44Client';

const fn = (name) => (payload) => base44.functions.invoke(name, payload);

export const preGenerateSynthesis = fn('preGenerateSynthesis');
export const sendFeedbackDigest = fn('sendFeedbackDigest');
export const generateCalendarSynthesis = fn('generateCalendarSynthesis');
export const debugChiron = fn('debugChiron');
export const stripeWebhook = fn('stripeWebhook');
export const logFrontendError = fn('logFrontendError');
export const sendWelcomeEmail = fn('sendWelcomeEmail');
export const astroEngine = fn('astroEngine');
export const getDailyStreakBonus = fn('getDailyStreakBonus');
export const generateDailyQuiz = fn('generateDailyQuiz');
export const crossCheckEphemeris = fn('crossCheckEphemeris');
export const stampFoundingMember = fn('stampFoundingMember');
export const validateIapReceipt = fn('validateIapReceipt');
export const calendarICSFeed = fn('calendarICSFeed');
export const getInterpretations = fn('getInterpretations');
export const generateBonusQuiz = fn('generateBonusQuiz');
export const debugHouses = fn('debugHouses');
export const notifyAdminBugReport = fn('notifyAdminBugReport');
export const syncAstroToCalendar = fn('syncAstroToCalendar');
export const sendDailyEmail = fn('sendDailyEmail');
export const recalcAllCharts = fn('recalcAllCharts');
export const chartCalculator = fn('chartCalculator');
export const fixChiron = fn('fixChiron');
export const sendMonthlyEmail = fn('sendMonthlyEmail');
export const debugAngles = fn('debugAngles');
export const submitQuizAnswer = fn('submitQuizAnswer');
export const sendWeeklyEmail = fn('sendWeeklyEmail');
export const createCheckoutSession = fn('createCheckoutSession');
export const generateRisingSignCard = fn('generateRisingSignCard');
export const submitRetake = fn('submitRetake');
export const sendChartRecapEmail = fn('sendChartRecapEmail');
export const createCustomerPortalSession = fn('createCustomerPortalSession');
export const accountDeletion = fn('accountDeletion');
export const recomputeXpTotals = fn('recomputeXpTotals');
