const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const { attempt_id, attempt_question_id, question_id, position, selected_option } = parseBody(event);
    const selected = String(selected_option || "").toUpperCase();
    if (!attempt_id || !["A","B","C","D"].includes(selected)) return bad("Resposta inválida.");

    let rowQuery = supabase
      .from("quiz_attempt_questions")
      .select("id,question_id,attempt_id,position")
      .eq("attempt_id", attempt_id);

    if (attempt_question_id) {
      rowQuery = rowQuery.eq("id", attempt_question_id);
    } else if (position) {
      rowQuery = rowQuery.eq("position", Number(position));
    } else if (question_id) {
      rowQuery = rowQuery.eq("question_id", question_id);
    } else {
      return bad("Pergunta inválida.");
    }

    const { data: attemptQuestion, error: rowError } = await rowQuery.maybeSingle();
    if (rowError) throw rowError;
    if (!attemptQuestion) return bad("Não localizamos esta pergunta dentro da tentativa atual.");

    const { data: question, error: qError } = await supabase
      .from("quiz_questions")
      .select("correct_option")
      .eq("id", attemptQuestion.question_id)
      .single();
    if (qError) throw qError;

    const isCorrect = question.correct_option === selected;

    const { data: saved, error } = await supabase
      .from("quiz_attempt_questions")
      .update({
        selected_option: selected,
        is_correct: isCorrect,
        answered_at: new Date().toISOString()
      })
      .eq("id", attemptQuestion.id)
      .select("id,selected_option")
      .single();
    if (error) throw error;
    if (!saved || saved.selected_option !== selected) return bad("Não foi possível registrar esta resposta.");

    // Não retorna se acertou ou errou.
    return ok({ saved: true });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
