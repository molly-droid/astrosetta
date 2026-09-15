/**
 * submitRetake — Re-scores a completed daily quiz from a retake attempt.
 * Updates the quiz's recorded score + answers ONLY if the retake score beats
 * the previous best, and adjusts UserProgress accuracy totals by the delta.
 * Tier quiz-day counts are NOT touched (a retake is not a new quiz day).
 */
import { compatClient } from '../_shared/base44Compat.ts';
import { json, handleOptions } from '../_shared/edge.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  try {
    const base44 = compatClient(req);
    const user = await base44.auth.me();
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { quiz_id, answers } = body;
    if (!quiz_id || !Array.isArray(answers) || answers.length === 0) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    const quizRecords = await base44.entities.DailyQuiz.filter({ user_id: user.id });
    const quiz = quizRecords.find(q => q.id === quiz_id);
    if (!quiz) return json({ error: 'Quiz not found' }, { status: 404 });
    if (!quiz.completed_at) return json({ error: 'Quiz not yet completed' }, { status: 400 });

    // Re-score the retake answers against the stored questions
    const retakeAnswers = answers.map(a => {
      const q = quiz.questions[a.question_index];
      const is_correct = q ? a.chosen_option_index === q.correct_index : false;
      return { question_index: a.question_index, chosen_option_index: a.chosen_option_index, is_correct };
    });
    const newCorrect = retakeAnswers.filter(a => a.is_correct).length;
    const newScore = Math.round((newCorrect / quiz.questions.length) * 100);

    const oldScore = quiz.score || 0;
    const oldCorrect = (quiz.user_answers || []).filter(a => a.is_correct).length;

    // Only persist when the retake is strictly better (best-attempt policy)
    if (newScore > oldScore) {
      await base44.entities.DailyQuiz.update(quiz_id, {
        user_answers: retakeAnswers,
        score: newScore,
      });

      const progRecords = await base44.entities.UserProgress.filter({ user_id: user.id });
      const progress = progRecords[0];
      if (progress) {
        const delta = newCorrect - oldCorrect; // positive
        const tier = quiz.tier || progress.current_tier || 'apprentice';
        const updateData = {};
        if (tier === 'apprentice') {
          updateData.apprentice_correct_total = Math.max(0, (progress.apprentice_correct_total || 0) + delta);
        } else if (tier === 'adept') {
          updateData.adept_correct_total = Math.max(0, (progress.adept_correct_total || 0) + delta);
        }
        const prevTotal = progress.total_answered || 0;
        const prevCorrect = Math.round(((progress.accuracy_rate || 0) / 100) * prevTotal);
        const newAccuracy = prevTotal > 0 ? Math.round(((prevCorrect + delta) / prevTotal) * 100) : newScore;
        updateData.accuracy_rate = newAccuracy;

        await base44.entities.UserProgress.update(progress.id, updateData);

        return json({
          updated: true,
          score: newScore,
          old_score: oldScore,
          apprentice_correct_total: updateData.apprentice_correct_total ?? progress.apprentice_correct_total,
          adept_correct_total: updateData.adept_correct_total ?? progress.adept_correct_total,
          accuracy_rate: newAccuracy,
        });
      }

      return json({ updated: true, score: newScore, old_score: oldScore });
    }

    return json({ updated: false, score: oldScore, old_score: oldScore });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
});