const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const { attempt_id, question_id, selected_option } = parseBody(event);
    const selected = String(selected_option || "").toUpperCase();
    if (!attempt_id || !question_id || !["A","B","C","D"].includes(selected)) return bad("Resposta inválida.");

    const { data: question, error: qError } = await supabase
      .from("quiz_questions")
      .select("correct_option")
      .eq("id", question_id)
      .single();
    if (qError) throw qError;

    const isCorrect = question.correct_option === selected;

    const { error } = await supabase
      .from("quiz_attempt_questions")
      .update({
        selected_option: selected,
        is_correct: isCorrect,
        answered_at: new Date().toISOString()
      })
      .eq("attempt_id", attempt_id)
      .eq("question_id", question_id);
    if (error) throw error;

    // Não retorna se acertou ou errou.
    return ok({ saved: true });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
