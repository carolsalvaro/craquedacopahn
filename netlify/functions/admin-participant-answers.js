const { getSupabase } = require("./_lib/supabase");
const { ok, bad, checkAdmin } = require("./_lib/utils");

function optionText(question, letter) {
  const key = `option_${String(letter || "").toLowerCase()}`;
  return question?.[key] || "";
}

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();
    const participantId = event.queryStringParameters?.participant_id;
    if (!participantId) return bad("Participante não informado.");

    const { data: participant, error: pError } = await supabase
      .from("quiz_participants")
      .select("id,name,cpf,whatsapp,city")
      .eq("id", participantId)
      .single();
    if (pError) throw pError;

    const { data: attempts, error: aError } = await supabase
      .from("quiz_attempts")
      .select("id,cycle_id,started_at,finished_at,correct_answers,total_questions,is_classified,status,cycle:quiz_cycles(title)")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (aError) throw aError;

    const attemptIds = (attempts || []).map(a => a.id);
    let answerRows = [];
    if (attemptIds.length) {
      const { data, error } = await supabase
        .from("quiz_attempt_questions")
        .select("attempt_id,position,selected_option,is_correct,question:quiz_questions(question_text,option_a,option_b,option_c,option_d,correct_option)")
        .in("attempt_id", attemptIds)
        .order("position", { ascending: true });
      if (error) throw error;
      answerRows = data || [];
    }

    const answersByAttempt = new Map();
    answerRows.forEach(row => {
      if (!answersByAttempt.has(row.attempt_id)) answersByAttempt.set(row.attempt_id, []);
      const q = row.question || {};
      answersByAttempt.get(row.attempt_id).push({
        position: row.position,
        question_text: q.question_text || "Pergunta",
        selected_option: row.selected_option,
        selected_text: optionText(q, row.selected_option),
        correct_option: q.correct_option,
        correct_text: optionText(q, q.correct_option),
        is_correct: row.is_correct === true
      });
    });

    return ok({
      participant,
      attempts: (attempts || []).map(a => ({
        id: a.id,
        cycle_title: a.cycle?.title || "Ciclo",
        started_at: a.started_at,
        finished_at: a.finished_at,
        correct_answers: a.correct_answers,
        total_questions: a.total_questions,
        is_classified: a.is_classified,
        status: a.status,
        answers: answersByAttempt.get(a.id) || []
      }))
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
