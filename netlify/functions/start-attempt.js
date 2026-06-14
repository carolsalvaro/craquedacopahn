const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody } = require("./_lib/utils");

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickByDifficulty(pool, difficulty, qty, usageMap) {
  const filtered = pool
    .filter(q => q.difficulty === difficulty)
    .sort((a, b) => {
      const ua = usageMap.get(a.id)?.usage_count || 0;
      const ub = usageMap.get(b.id)?.usage_count || 0;
      if (ua !== ub) return ua - ub;
      return Math.random() - 0.5;
    });
  return filtered.slice(0, qty);
}

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const { cycle_id, participant_id } = parseBody(event);
    if (!cycle_id || !participant_id) return bad("Dados incompletos.");

    const { data: cycle, error: cycleError } = await supabase
      .from("quiz_cycles")
      .select("*")
      .eq("id", cycle_id)
      .eq("status", "active")
      .single();
    if (cycleError) throw cycleError;

    const { data: existingClassified, error: classifiedError } = await supabase
      .from("quiz_attempts")
      .select("id")
      .eq("cycle_id", cycle_id)
      .eq("participant_id", participant_id)
      .eq("is_classified", true)
      .eq("status", "finished")
      .maybeSingle();
    if (classifiedError) throw classifiedError;
    if (existingClassified) return bad("Você já está classificado neste ciclo.");

    const { data: links, error: linksError } = await supabase
      .from("quiz_cycle_questions")
      .select("question:quiz_questions(*)")
      .eq("cycle_id", cycle_id)
      .eq("status", "active");
    if (linksError) throw linksError;

    const questions = (links || [])
      .map(l => l.question)
      .filter(q => q && q.status === "active");

    if (questions.length < cycle.questions_per_attempt) {
      return bad(`Este ciclo precisa ter pelo menos ${cycle.questions_per_attempt} perguntas ativas vinculadas.`);
    }

    const { data: usageRows, error: usageError } = await supabase
      .from("quiz_question_participant_usage")
      .select("question_id,usage_count,last_used_at")
      .eq("cycle_id", cycle_id)
      .eq("participant_id", participant_id);
    if (usageError) throw usageError;

    const usageMap = new Map((usageRows || []).map(u => [u.question_id, u]));

    const totalToPick = Number(cycle.questions_per_attempt || 10);
    const easyQty = Math.max(1, Math.round(totalToPick * 0.4));
    const mediumQty = Math.max(1, Math.round(totalToPick * 0.4));
    const hardQty = Math.max(0, totalToPick - easyQty - mediumQty);

    let selected = [
      ...pickByDifficulty(questions, "easy", easyQty, usageMap),
      ...pickByDifficulty(questions, "medium", mediumQty, usageMap),
      ...pickByDifficulty(questions, "hard", hardQty, usageMap)
    ];

    // Se faltar alguma dificuldade, completa com qualquer pergunta menos usada.
    const selectedIds = new Set(selected.map(q => q.id));
    if (selected.length < cycle.questions_per_attempt) {
      const remaining = questions
        .filter(q => !selectedIds.has(q.id))
        .sort((a, b) => {
          const ua = usageMap.get(a.id)?.usage_count || 0;
          const ub = usageMap.get(b.id)?.usage_count || 0;
          if (ua !== ub) return ua - ub;
          return Math.random() - 0.5;
        });
      selected = [...selected, ...remaining.slice(0, totalToPick - selected.length)];
    }

    selected = shuffle(selected).slice(0, totalToPick);

    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        cycle_id,
        participant_id,
        total_questions: totalToPick,
        status: "in_progress"
      })
      .select("*")
      .single();
    if (attemptError) throw attemptError;

    const attemptQuestions = selected.map((q, idx) => ({
      attempt_id: attempt.id,
      question_id: q.id,
      position: idx + 1
    }));
    const { data: insertedAttemptQuestions, error: aqError } = await supabase
      .from("quiz_attempt_questions")
      .insert(attemptQuestions)
      .select("id,question_id,position");
    if (aqError) throw aqError;

    const attemptQuestionMap = new Map(
      (insertedAttemptQuestions || []).map(row => [`${row.question_id}-${row.position}`, row.id])
    );

    // Atualiza uso de perguntas.
    for (const q of selected) {
      const existing = usageMap.get(q.id);
      if (existing) {
        await supabase
          .from("quiz_question_participant_usage")
          .update({
            usage_count: (existing.usage_count || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq("cycle_id", cycle_id)
          .eq("participant_id", participant_id)
          .eq("question_id", q.id);
      } else {
        await supabase
          .from("quiz_question_participant_usage")
          .insert({
            cycle_id,
            participant_id,
            question_id: q.id,
            usage_count: 1,
            last_used_at: new Date().toISOString()
          });
      }
    }

    return ok({
      attempt: { id: attempt.id },
      questions: selected.map((q, idx) => ({
        id: q.id,
        position: idx + 1,
        attempt_question_id: attemptQuestionMap.get(`${q.id}-${idx + 1}`) || null,
        question_text: q.question_text,
        options: {
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d
        }
      }))
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
