const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, digits } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const { cpf } = parseBody(event);
    const cleanCpf = digits(cpf);
    if (cleanCpf.length !== 11) return bad("CPF inválido.");

    const { data: cycles, error: cycleError } = await supabase
      .from("quiz_cycles")
      .select("id,title")
      .eq("status", "active")
      .limit(1);
    if (cycleError) throw cycleError;
    const cycle = cycles?.[0];
    if (!cycle) return bad("Não há ciclo ativo no momento.", 404);

    const { data: participant, error } = await supabase
      .from("quiz_participants")
      .select("*")
      .eq("cpf", cleanCpf)
      .maybeSingle();
    if (error) throw error;

    if (!participant) return ok({ exists: false, already_classified: false });

    const { data: classified, error: cError } = await supabase
      .from("quiz_attempts")
      .select("id,correct_answers,total_questions")
      .eq("cycle_id", cycle.id)
      .eq("participant_id", participant.id)
      .eq("is_classified", true)
      .eq("status", "finished")
      .maybeSingle();
    if (cError) throw cError;

    return ok({
      exists: true,
      already_classified: !!classified,
      score_text: classified ? `${classified.correct_answers}/${classified.total_questions}` : null,
      participant: {
        id: participant.id,
        name: participant.name,
        cpf: participant.cpf,
        whatsapp: participant.whatsapp,
        city: participant.city
      }
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
