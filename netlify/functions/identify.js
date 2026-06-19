const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, digits } = require("./_lib/utils");

function scoreText(attempt) {
  if (!attempt) return null;
  return `${attempt.correct_answers}/${attempt.total_questions}`;
}

function chooseBestAttempt(current, attempt) {
  if (!current) return attempt;

  const currentScore = Number(current.correct_answers || 0);
  const attemptScore = Number(attempt.correct_answers || 0);

  if (attemptScore > currentScore) return attempt;
  if (attemptScore < currentScore) return current;

  if (!!attempt.is_classified && !current.is_classified) return attempt;
  if (!attempt.is_classified && !!current.is_classified) return current;

  const currentDate = new Date(current.finished_at || current.created_at || 0).getTime();
  const attemptDate = new Date(attempt.finished_at || attempt.created_at || 0).getTime();
  return attemptDate > currentDate ? attempt : current;
}

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const { cpf } = parseBody(event);
    const cleanCpf = digits(cpf);

    if (cleanCpf.length !== 11) return bad("CPF inválido.");

    const { data: activeCycles, error: cycleError } = await supabase
      .from("quiz_cycles")
      .select("id,title,slug,stage_order,status")
      .eq("status", "active")
      .order("stage_order", { ascending: true })
      .limit(1);

    if (cycleError) throw cycleError;

    const activeCycle = activeCycles?.[0];
    if (!activeCycle) return bad("Não há ciclo ativo no momento.", 404);

    const { data: participant, error } = await supabase
      .from("quiz_participants")
      .select("*")
      .eq("cpf", cleanCpf)
      .maybeSingle();

    if (error) throw error;

    if (!participant) {
      return ok({
        exists: false,
        already_classified: false,
        active_cycle_stage_order: activeCycle.stage_order,
        active_cycle_id: activeCycle.id
      });
    }

    const { data: cycles, error: cyclesError } = await supabase
      .from("quiz_cycles")
      .select("id,title,slug,stage_order,status")
      .order("stage_order", { ascending: true });

    if (cyclesError) throw cyclesError;

    const { data: attempts, error: attemptsError } = await supabase
      .from("quiz_attempts")
      .select("id,cycle_id,correct_answers,total_questions,is_classified,status,finished_at,created_at")
      .eq("participant_id", participant.id)
      .eq("status", "finished")
      .order("finished_at", { ascending: false, nullsFirst: false });

    if (attemptsError) throw attemptsError;

    const bestByCycle = {};
    (attempts || []).forEach((attempt) => {
      if (!attempt.cycle_id) return;
      bestByCycle[attempt.cycle_id] = chooseBestAttempt(bestByCycle[attempt.cycle_id], attempt);
    });

    const cycleHistory = (cycles || [])
      .filter((cycle) => Number(cycle.stage_order || 0) >= 1 && Number(cycle.stage_order || 0) <= 5)
      .map((cycle) => {
        const best = bestByCycle[cycle.id] || null;

        return {
          id: cycle.id,
          title: cycle.title,
          slug: cycle.slug,
          stage_order: cycle.stage_order,
          status: cycle.status,
          best_result: best ? {
            attempt_id: best.id,
            correct_answers: best.correct_answers,
            total_questions: best.total_questions,
            score_text: scoreText(best),
            is_classified: !!best.is_classified,
            finished_at: best.finished_at || best.created_at || null
          } : null
        };
      });

    const activeBest = bestByCycle[activeCycle.id] || null;
    const alreadyClassified = !!activeBest?.is_classified;

    return ok({
      exists: true,
      already_classified: alreadyClassified,
      score_text: activeBest ? scoreText(activeBest) : null,
      active_cycle_stage_order: activeCycle.stage_order,
      active_cycle_id: activeCycle.id,
      cycle_history: cycleHistory,
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
