/**
 * submitQuizAnswer — Records a user's answer for a quiz question.
 * Persists each answer immediately. On final question: scores, updates streak/accuracy, checks tier advancement.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { pickBestProgress } from '../../shared/userProgress.ts';

// Tier advancement thresholds — based on quizzes completed, accuracy, and curriculum modules
// Streaks are NOT used for tiering (no punishment for taking days off)
const TIER_REQUIREMENTS = {
  apprentice: {
    quiz_days: 10,
    accuracy: 70,
    curriculum_modules: 10,
  },
  adept: {
    quiz_days: 20,
    accuracy: 75,
    curriculum_modules: 15,
  }
};

async function getCompletedModuleCount(base44, userId) {
  const records = await base44.asServiceRole.entities.UserModuleProgress.filter({ user_id: userId, status: 'completed' });
  return records.length;
}

function checkTierAdvancement(progress) {
  const tier = progress.current_tier;
  const req = TIER_REQUIREMENTS[tier];
  if (!req) return null; // maestro — no advancement

  const modules = progress.modules_completed || 0;

  if (tier === 'apprentice') {
    const days = progress.apprentice_quiz_days_count || 0;
    const total = progress.apprentice_questions_total || 0;
    const correct = progress.apprentice_correct_total || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    if (days >= req.quiz_days && accuracy >= req.accuracy && modules >= req.curriculum_modules) return 'adept';
  }

  if (tier === 'adept') {
    const days = progress.adept_quiz_days_count || 0;
    const total = progress.adept_questions_total || 0;
    const correct = progress.adept_correct_total || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    if (days >= req.quiz_days && accuracy >= req.accuracy && modules >= req.curriculum_modules) return 'maestro';
  }

  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { quiz_id, question_index, chosen_option_index } = body;

    if (quiz_id === undefined || question_index === undefined || chosen_option_index === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch quiz
    const quizRecords = await base44.entities.DailyQuiz.filter({ user_id: user.id });
    const quiz = quizRecords.find(q => q.id === quiz_id);
    if (!quiz) return Response.json({ error: 'Quiz not found' }, { status: 404 });
    if (quiz.completed_at) return Response.json({ error: 'Quiz already completed' }, { status: 400 });

    const question = quiz.questions[question_index];
    if (!question) return Response.json({ error: 'Question not found' }, { status: 404 });

    const is_correct = chosen_option_index === question.correct_index;

    // Merge with existing answers (dedup by question_index)
    const existingAnswers = quiz.user_answers || [];
    const filtered = existingAnswers.filter(a => a.question_index !== question_index);
    const updatedAnswers = [...filtered, { question_index, chosen_option_index, is_correct }];

    const isLastQuestion = question_index === quiz.questions.length - 1;

    if (!isLastQuestion) {
      // Persist intermediate answer
      await base44.entities.DailyQuiz.update(quiz_id, { user_answers: updatedAnswers });
      return Response.json({
        is_correct,
        explanation: question.explanation,
        correct_index: question.correct_index,
        quiz_complete: false
      });
    }

    // === FINAL QUESTION — score & update progress ===
    const correctCount = updatedAnswers.filter(a => a.is_correct).length;
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const completedAt = new Date().toISOString();

    await base44.entities.DailyQuiz.update(quiz_id, {
      user_answers: updatedAnswers,
      score,
      completed_at: completedAt,
      tier_at_completion: quiz.tier
    });

    // Update UserProgress
    const progRecords = await base44.entities.UserProgress.filter({ user_id: user.id });
    // Pick the highest-tier record so a stale lower-tier duplicate can never
    // shadow the user's real progress (users are never pushed back a level).
    let progress = pickBestProgress(progRecords);

    const timezone = quiz.user_timezone || 'UTC';
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

    if (!progress) {
      const modulesCompleted = await getCompletedModuleCount(base44, user.id);
      const newProg = {
        user_id: user.id,
        current_tier: quiz.tier,
        timezone,
        consecutive_streak_count: 1,
        streak_best: 1,
        streak_last_date: todayKey,
        modules_completed: modulesCompleted,
        total_answered: quiz.questions.length,
        accuracy_rate: score,
        tier_started_at: new Date().toISOString(),
        apprentice_quiz_days_count: quiz.tier === 'apprentice' ? 1 : 0,
        adept_quiz_days_count: quiz.tier === 'adept' ? 1 : 0,
        apprentice_correct_total: quiz.tier === 'apprentice' ? correctCount : 0,
        apprentice_questions_total: quiz.tier === 'apprentice' ? quiz.questions.length : 0,
        adept_correct_total: quiz.tier === 'adept' ? correctCount : 0,
        adept_questions_total: quiz.tier === 'adept' ? quiz.questions.length : 0,
      };
      progress = await base44.entities.UserProgress.create(newProg);
    } else {
      const lastDate = progress.streak_last_date;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = yesterday.toLocaleDateString('en-CA', { timeZone: timezone });

      let newStreak = progress.consecutive_streak_count || 0;
      if (lastDate === todayKey) {
        // no-op — already counted today
      } else if (lastDate === yesterdayKey) {
        newStreak = newStreak + 1;
      } else {
        newStreak = 1;
      }

      const newBest = Math.max(progress.streak_best || 0, newStreak);

      const prevTotal = progress.total_answered || 0;
      const prevCorrect = Math.round(((progress.accuracy_rate || 0) / 100) * prevTotal);
      const newTotal = prevTotal + quiz.questions.length;
      const newAccuracy = newTotal > 0 ? Math.round(((prevCorrect + correctCount) / newTotal) * 100) : 0;

      const updateData = {
        consecutive_streak_count: newStreak,
        streak_best: newBest,
        streak_last_date: todayKey,
        total_answered: newTotal,
        accuracy_rate: newAccuracy,
      };

      // Only count quiz day if new day
      if (lastDate !== todayKey) {
        if (quiz.tier === 'apprentice') {
          updateData.apprentice_quiz_days_count = (progress.apprentice_quiz_days_count || 0) + 1;
          updateData.apprentice_correct_total = (progress.apprentice_correct_total || 0) + correctCount;
          updateData.apprentice_questions_total = (progress.apprentice_questions_total || 0) + quiz.questions.length;
        } else if (quiz.tier === 'adept') {
          updateData.adept_quiz_days_count = (progress.adept_quiz_days_count || 0) + 1;
          updateData.adept_correct_total = (progress.adept_correct_total || 0) + correctCount;
          updateData.adept_questions_total = (progress.adept_questions_total || 0) + quiz.questions.length;
        }
      }

      // Fetch completed curriculum modules for tier advancement check
      const modulesCompleted = await getCompletedModuleCount(base44, user.id);
      updateData.modules_completed = modulesCompleted;

      // Check tier advancement with projected totals
      const projectedProgress = { ...progress, ...updateData };
      const nextTier = checkTierAdvancement(projectedProgress);
      if (nextTier) {
        updateData.current_tier = nextTier;
        updateData.tier_started_at = new Date().toISOString();
      }

      await base44.entities.UserProgress.update(progress.id, updateData);
      progress = { ...progress, ...updateData };
    }

    // Check advancement for fresh progress record too
    const tierAdvanced = progress.current_tier !== quiz.tier ? progress.current_tier : null;

    // Award XP for daily quiz completion
    let xpLeveledUp = false;
    let newXpLevel = null;
    try {
      const prevEvents = await base44.entities.XPEvent.filter({ user_id: user.id });
      const prevTotal = prevEvents.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
      const prevLevel = ['apprentice','adept','practitioner','sage'].find((l, i, arr) => {
        const thresholds = [0, 200, 500, 1500];
        return prevTotal >= thresholds[i] && (i === arr.length - 1 || prevTotal < thresholds[i + 1]);
      }) || 'apprentice';

      await base44.asServiceRole.entities.XPEvent.create({
        user_id: user.id,
        event_type: 'daily_quiz_completed',
        xp_amount: 10,
      });
      // Sum all XP events for accurate total
      const events = await base44.entities.XPEvent.filter({ user_id: user.id });
      const totalXP = events.reduce((sum, e) => sum + (e.xp_amount || 0), 0);
      newXpLevel = ['apprentice','adept','practitioner','sage'].find((l, i, arr) => {
        const thresholds = [0, 200, 500, 1500];
        return totalXP >= thresholds[i] && (i === arr.length - 1 || totalXP < thresholds[i + 1]);
      }) || 'apprentice';
      xpLeveledUp = newXpLevel !== prevLevel;
      await base44.asServiceRole.entities.User.update(user.id, {
        xp_total: totalXP,
        level: newXpLevel,
      });
    } catch (_) { /* XP update is best-effort, don't fail quiz submission */ }

    return Response.json({
      is_correct,
      explanation: question.explanation,
      correct_index: question.correct_index,
      quiz_complete: true,
      score,
      streak: progress.consecutive_streak_count,
      modules_completed: progress.modules_completed || 0,
      streak_bonus_unlocked: true,
      tier_advanced: tierAdvanced,
      current_tier: progress.current_tier,
      apprentice_quiz_days_count: progress.apprentice_quiz_days_count || 0,
      apprentice_correct_total: progress.apprentice_correct_total || 0,
      apprentice_questions_total: progress.apprentice_questions_total || 0,
      adept_quiz_days_count: progress.adept_quiz_days_count || 0,
      adept_correct_total: progress.adept_correct_total || 0,
      adept_questions_total: progress.adept_questions_total || 0,
      xp_leveled_up: xpLeveledUp,
      new_xp_level: newXpLevel,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});