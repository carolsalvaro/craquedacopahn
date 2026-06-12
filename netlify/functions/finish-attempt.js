const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody } = require("./_lib/utils");

function optionText(question, letter) {
  const key = `option_${String(letter || "").toLowerCase()}`;
  return question?.[key] || "";
}

function normalizeSelected(value) {
  const selected = String(value || "").toUpperCase();
  return ["A", "B", "C", "D"].includes(selected) ? selected : null;
}

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const body = parseBody(event);
    const { attempt_id } = body;
    const clientAnswers = Array.isArray(body.answers) ? body.answers : [];

    if (!attempt_id) return bad("Tentativa inválida.");

    const { data: attempt, error: aError } = await supabase
      .from("quiz_attempts")
      .select("*, cycle:quiz_cycles(*)")
      .eq("id", attempt_id)
      .single();
    if (aError) throw aError;

    if (!["in_progress", "finished"].includes(attempt.status)) {
      return bad("Esta tentativa não pode ser finalizada.");
    }

    const { data: rows, error: ansError } = await supabase
      .from("quiz_attempt_questions")
      .select("id,position,question_id,selected_option,is_correct,question:quiz_questions(question_text,option_a,option_b,option_c,option_d,correct_option)")
      .eq("attempt_id", attempt_id)
      .order("position", { ascending: true });
    if (ansError) throw ansError;

    if ((rows || []).length !== attempt.total_questions) return bad("Tentativa incompleta.");

    const byAttemptQuestionId = new Map();
    const byQuestionId = new Map();
    const byPosition = new Map();

    for (const a of clientAnswers) {
      const selected = normalizeSelected(a.selected_option);
      if (!selected) continue;
      if (a.attempt_question_id) byAttemptQuestionId.set(String(a.attempt_question_id), selected);
      if (a.question_id) byQuestionId.set(String(a.question_id), selected);
      if (a.position) byPosition.set(Number(a.position), selected);
    }

    const finalRows = [];
    const missing = [];

    for (const row of rows || []) {
      const selected = normalizeSelected(row.selected_option)
        || byAttemptQuestionId.get(String(row.id))
        || byPosition.get(Number(row.position))
        || byQuestionId.get(String(row.question_id));

      if (!selected) {
        missing.push(row.position);
        finalRows.push({ ...row, selected_option: null, is_correct: false });
        continue;
      }

      const isCorrect = row.question?.correct_option === selected;

      if (row.selected_option !== selected || row.is_correct !== isCorrect) {
        const { error: updateAnswerError } = await supabase
          .from("quiz_attempt_questions")
          .update({
            selected_option: selected,
            is_correct: isCorrect,
            answered_at: new Date().toISOString()
          })
          .eq("id", row.id);
        if (updateAnswerError) throw updateAnswerError;
      }

      finalRows.push({ ...row, selected_option: selected, is_correct: isCorrect });
    }

    if (missing.length) {
      return bad(`Ainda faltou registrar resposta na pergunta ${missing.join(", ")}. Selecione a alternativa e clique novamente em finalizar.`);
    }

    const correct = finalRows.filter(a => a.is_correct === true).length;
    const wrong = finalRows.length - correct;
    const scorePercent = Number(((correct / finalRows.length) * 100).toFixed(2));
    const minimum = attempt.cycle.minimum_correct_answers || 11;
    const isClassified = correct >= minimum;

    if (attempt.status !== "finished") {
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
    }

    const safeAnswers = finalRows.map(a => ({
      position: a.position,
      question_text: a.question?.question_text || "Pergunta",
      selected_option: a.selected_option,
      selected_text: optionText(a.question, a.selected_option),
      is_correct: a.is_correct === true
    }));

    return ok({
      correct_answers: correct,
      total_questions: finalRows.length,
      wrong_answers: wrong,
      score_percent: scorePercent,
      is_classified: isClassified,
      minimum_correct_answers: minimum,
      answers: safeAnswers
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
