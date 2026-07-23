const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, checkAdmin, digits } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();

    if (event.httpMethod === "GET") {
      const { data: participants, error } = await supabase
        .from("quiz_participants")
        .select("id,name,cpf,whatsapp,city,created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;

      const { data: cycles, error: cyclesError } = await supabase
        .from("quiz_cycles")
        .select("id,title,slug,stage_order")
        .order("stage_order", { ascending: true });
      if (cyclesError) throw cyclesError;

      const cycleLabelById = new Map(
        (cycles || []).map(c => [
          c.id,
          Number(c.stage_order || 0) > 0 ? `C${c.stage_order}` : (c.title || c.slug || c.id)
        ])
      );

      const cycleOrderById = new Map(
        (cycles || []).map(c => [c.id, Number(c.stage_order || 999)])
      );

      const ids = (participants || []).map(p => p.id);
      let attempts = [];
      if (ids.length) {
        const { data: a, error: aError } = await supabase
          .from("quiz_attempts")
          .select("participant_id,cycle_id,is_classified,status,started_at,finished_at,created_at,correct_answers,total_questions")
          .in("participant_id", ids);
        if (aError) throw aError;
        attempts = a || [];
      }

      const byParticipant = new Map();
      attempts.forEach(a => {
        if (!byParticipant.has(a.participant_id)) {
          byParticipant.set(a.participant_id, {
            total_attempts: 0,
            has_classified: false,
            last_attempt_at: null,
            participated_cycles: new Set(),
            classified_cycles: new Set()
          });
        }

        const item = byParticipant.get(a.participant_id);
        item.total_attempts++;

        const finishedOrStarted = a.status === "finished" || a.started_at || a.finished_at || a.created_at;
        if (a.cycle_id && finishedOrStarted) {
          item.participated_cycles.add(a.cycle_id);
        }

        if (a.is_classified && a.status === "finished") {
          item.has_classified = true;
          if (a.cycle_id) item.classified_cycles.add(a.cycle_id);
        }

        const dateValue = a.finished_at || a.started_at || a.created_at;
        if (dateValue) {
          const current = item.last_attempt_at ? new Date(item.last_attempt_at).getTime() : 0;
          const candidate = new Date(dateValue).getTime();
          if (candidate > current) item.last_attempt_at = dateValue;
        }
      });

      function cycleLabels(cycleSet) {
        return [...cycleSet]
          .map(id => ({
            id,
            order: cycleOrderById.get(id) || 999,
            label: cycleLabelById.get(id) || id
          }))
          .sort((a, b) => a.order - b.order)
          .map(c => c.label);
      }

      return ok({
        participants: (participants || []).map(p => {
          const info = byParticipant.get(p.id);
          const participatedLabels = cycleLabels(info?.participated_cycles || new Set());
          const classifiedLabels = cycleLabels(info?.classified_cycles || new Set());

          return {
            ...p,
            total_attempts: info?.total_attempts || 0,
            has_classified: info?.has_classified || false,
            last_attempt_at: info?.last_attempt_at || null,
            participated_cycles: participatedLabels,
            participated_cycles_text: participatedLabels.join(", "),
            classified_cycles: classifiedLabels,
            classified_cycles_text: classifiedLabels.join(", ")
          };
        })
      });
    }

    if (event.httpMethod === "POST") {
      const b = parseBody(event);
      if (!b.id) return bad("Participante não informado.");
      const name = String(b.name || "").trim();
      const whatsapp = digits(b.whatsapp);
      const city = String(b.city || "").trim();
      if (!name) return bad("Informe o nome.");
      if (whatsapp.length < 10 || whatsapp.length > 11) return bad("WhatsApp inválido.");
      if (!city) return bad("Informe a cidade.");

      const { data, error } = await supabase
        .from("quiz_participants")
        .update({ name, whatsapp, city })
        .eq("id", b.id)
        .select("*")
        .single();
      if (error) throw error;
      return ok({ participant: data });
    }

    if (event.httpMethod === "DELETE") {
      const b = parseBody(event);
      const participantId = b.id || b.participant_id;
      if (!participantId) return bad("Participante não informado.");

      const { data: participant, error: participantError } = await supabase
        .from("quiz_participants")
        .select("id,name")
        .eq("id", participantId)
        .maybeSingle();
      if (participantError) throw participantError;
      if (!participant) return bad("Participante não encontrado.", 404);

      const { data: activeCycle, error: cycleError } = await supabase
        .from("quiz_cycles")
        .select("id,title")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (cycleError) throw cycleError;
      if (!activeCycle) return bad("Nenhum ciclo ativo encontrado.");

      const { data: attempts, error: attemptsError } = await supabase
        .from("quiz_attempts")
        .select("id")
        .eq("participant_id", participantId)
        .eq("cycle_id", activeCycle.id);
      if (attemptsError) throw attemptsError;

      const attemptIds = (attempts || []).map(a => a.id);

      const { error: winnersError } = await supabase
        .from("quiz_winners")
        .delete()
        .eq("participant_id", participantId)
        .eq("cycle_id", activeCycle.id);
      if (winnersError) throw winnersError;

      const { error: usageError } = await supabase
        .from("quiz_question_participant_usage")
        .delete()
        .eq("participant_id", participantId)
        .eq("cycle_id", activeCycle.id);
      if (usageError) throw usageError;

      if (attemptIds.length) {
        const { error: answersError } = await supabase
          .from("quiz_attempt_questions")
          .delete()
          .in("attempt_id", attemptIds);
        if (answersError) throw answersError;

        const { error: deleteAttemptsError } = await supabase
          .from("quiz_attempts")
          .delete()
          .in("id", attemptIds);
        if (deleteAttemptsError) throw deleteAttemptsError;
      }

      return ok({
        deleted: true,
        participant_id: participantId,
        cycle_id: activeCycle.id,
        attempts_deleted: attemptIds.length,
        message: "Participação excluída. O participante já pode tentar novamente no ciclo ativo."
      });
    }

    return bad("Método não permitido.", 405);
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
