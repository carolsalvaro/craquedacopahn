const { getSupabase } = require("./_lib/supabase");
const { ok, bad, checkAdmin } = require("./_lib/utils");

function toTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();

    const { data: cycles, error: cyclesError } = await supabase
      .from("quiz_cycles")
      .select("id,title,slug,stage_order,status,start_at,end_at,draw_at")
      .order("stage_order", { ascending: true });

    if (cyclesError) throw cyclesError;

    const { data: participants, error: participantsError } = await supabase
      .from("quiz_participants")
      .select("id,name,cpf,whatsapp,city,created_at")
      .order("name", { ascending: true })
      .limit(2000);

    if (participantsError) throw participantsError;

    const participantIds = (participants || []).map(p => p.id);

    let attempts = [];
    if (participantIds.length) {
      const { data: attemptsRows, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select("id,participant_id,cycle_id,status,is_classified,correct_answers,total_questions,started_at,finished_at,created_at")
        .in("participant_id", participantIds)
        .order("created_at", { ascending: false });

      if (attemptsError) throw attemptsError;
      attempts = attemptsRows || [];
    }

    const cycleById = new Map((cycles || []).map(c => [c.id, c]));
    const participantMap = new Map();

    (participants || []).forEach(p => {
      const cycleState = {};
      (cycles || []).forEach(c => {
        cycleState[c.id] = {
          cycle_id: c.id,
          participated: false,
          attempts: 0,
          finished_attempts: 0,
          classified: false,
          best_result: null,
          last_attempt_at: null
        };
      });

      participantMap.set(p.id, {
        ...p,
        cycles: cycleState,
        total_attempts: 0,
        last_attempt_at: null
      });
    });

    attempts.forEach(a => {
      const participant = participantMap.get(a.participant_id);
      if (!participant || !cycleById.has(a.cycle_id)) return;

      const state = participant.cycles[a.cycle_id];
      state.participated = true;
      state.attempts += 1;
      participant.total_attempts += 1;

      const dateValue = a.finished_at || a.started_at || a.created_at;
      if (dateValue && toTime(dateValue) > toTime(state.last_attempt_at)) {
        state.last_attempt_at = dateValue;
      }

      if (dateValue && toTime(dateValue) > toTime(participant.last_attempt_at)) {
        participant.last_attempt_at = dateValue;
      }

      if (a.status === "finished") {
        state.finished_attempts += 1;
        const score = Number(a.correct_answers || 0);
        const total = Number(a.total_questions || 0);

        if (a.is_classified) {
          state.classified = true;
        }

        if (
          !state.best_result ||
          score > Number(state.best_result.correct_answers || 0) ||
          (
            score === Number(state.best_result.correct_answers || 0) &&
            toTime(dateValue) > toTime(state.best_result.finished_at || state.best_result.created_at)
          )
        ) {
          state.best_result = {
            attempt_id: a.id,
            correct_answers: score,
            total_questions: total,
            score_text: `${score}/${total}`,
            is_classified: !!a.is_classified,
            finished_at: a.finished_at,
            started_at: a.started_at,
            created_at: a.created_at
          };
        }
      }
    });

    const resultParticipants = [...participantMap.values()]
      .sort((a, b) => toTime(b.last_attempt_at || b.created_at) - toTime(a.last_attempt_at || a.created_at));

    return ok({
      cycles: cycles || [],
      participants: resultParticipants
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
