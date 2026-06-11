const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const { attempt_id } = parseBody(event);
    if (!attempt_id) return bad("Tentativa inválida.");

    const { data: attempt, error: aError } = await supabase
      .from("quiz_attempts")
      .select("*, cycle:quiz_cycles(*)")
      .eq("id", attempt_id)
      .single();
    if (aError) throw aError;
    if (attempt.status !== "in_progress") return bad("Esta tentativa já foi finalizada.");

    const { data: answers, error: ansError } = await supabase
      .from("quiz_attempt_questions")
      .select("is_correct,selected_option")
      .eq("attempt_id", attempt_id);
    if (ansError) throw ansError;

    if ((answers || []).length !== attempt.total_questions) return bad("Tentativa incompleta.");
    if ((answers || []).some(a => !a.selected_option)) return bad("Responda todas as perguntas antes de finalizar.");

    const correct = answers.filter(a => a.is_correct === true).length;
    const wrong = answers.length - correct;
    const scorePercent = Number(((correct / answers.length) * 100).toFixed(2));
    const minimum = attempt.cycle.minimum_correct_answers || 11;
    const isClassified = correct >= minimum;

    const { error: updateError } = await supabase
      .from("quiz_attempts")
      .update({
        finished_at: new Date().toISOString(),
        correct_answers: correct,
        wrong_answers: wrong,
        score_percent: scorePercent,
        is_classified: isClassified,
        status: "finished"
      })
      .eq("id", attempt_id);
    if (updateError) throw updateError;

    return ok({
      correct_answers: correct,
      total_questions: answers.length,
      wrong_answers: wrong,
      score_percent: scorePercent,
      is_classified: isClassified,
      minimum_correct_answers: minimum
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
