const { getSupabase } = require("./_lib/supabase");
const { ok, bad, checkAdmin } = require("./_lib/utils");

function lastDigits(cpf) {
  const digits = String(cpf || "").replace(/\D/g, "").slice(-5);
  if (!digits) return "---";
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();
    const cycleId = event.queryStringParameters?.cycle_id;
    if (!cycleId) return bad("Informe o ciclo.");

    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("id,cycle_id,participant_id,correct_answers,total_questions,finished_at,participant:quiz_participants(id,name,cpf,whatsapp,city)")
      .eq("cycle_id", cycleId)
      .eq("status", "finished")
      .eq("is_classified", true)
      .order("correct_answers", { ascending: false })
      .order("finished_at", { ascending: true });

    if (error) throw error;

    const participantIds = [...new Set((data || []).map(a => a.participant_id).filter(Boolean))];

    const classifiedCyclesByParticipant = new Map();

    if (participantIds.length) {
      const { data: allClassifiedAttempts, error: allClassifiedError } = await supabase
        .from("quiz_attempts")
        .select("participant_id,cycle_id")
        .in("participant_id", participantIds)
        .eq("status", "finished")
        .eq("is_classified", true);

      if (allClassifiedError) throw allClassifiedError;

      (allClassifiedAttempts || []).forEach(a => {
        if (!classifiedCyclesByParticipant.has(a.participant_id)) {
          classifiedCyclesByParticipant.set(a.participant_id, new Set());
        }
        if (a.cycle_id) classifiedCyclesByParticipant.get(a.participant_id).add(a.cycle_id);
      });
    }

    const seen = new Set();
    const items = [];

    (data || []).forEach(a => {
      if (seen.has(a.participant_id)) return;
      seen.add(a.participant_id);

      const p = Array.isArray(a.participant) ? a.participant[0] : a.participant;
      if (!p) return;

      const classifiedCyclesCount = classifiedCyclesByParticipant.get(a.participant_id)?.size || 1;

      items.push({
        cycle_id: a.cycle_id,
        participant_id: a.participant_id,
        name: p.name,
        cpf: p.cpf,
        cpf_last_digits: lastDigits(p.cpf),
        whatsapp: p.whatsapp,
        city: p.city,
        attempt_id: a.id,
        correct_answers: a.correct_answers,
        total_questions: a.total_questions,
        score_text: `${a.correct_answers}/${a.total_questions}`,
        finished_at: a.finished_at,
        classified_cycles_count: classifiedCyclesCount,
        final_raffle_entries: classifiedCyclesCount
      });
    });

    return ok({ items });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
