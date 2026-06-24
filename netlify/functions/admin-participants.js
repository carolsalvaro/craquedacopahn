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
        .limit(500);
      if (error) throw error;

      const ids = (participants || []).map(p => p.id);
      let attempts = [];
      if (ids.length) {
        const { data: a, error: aError } = await supabase
          .from("quiz_attempts")
          .select("participant_id,is_classified,status,started_at,finished_at,created_at")
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
            last_attempt_at: null
          });
        }

        const item = byParticipant.get(a.participant_id);
        item.total_attempts++;

        if (a.is_classified && a.status === "finished") {
          item.has_classified = true;
        }

        const dateValue = a.finished_at || a.started_at || a.created_at;
        if (dateValue) {
          const current = item.last_attempt_at ? new Date(item.last_attempt_at).getTime() : 0;
          const candidate = new Date(dateValue).getTime();
          if (candidate > current) item.last_attempt_at = dateValue;
        }
      });

      const mappedParticipants = (participants || []).map(p => ({
        ...p,
        total_attempts: byParticipant.get(p.id)?.total_attempts || 0,
        has_classified: byParticipant.get(p.id)?.has_classified || false,
        last_attempt_at: byParticipant.get(p.id)?.last_attempt_at || null
      }));

      // A lista de Participações deve priorizar quem participou por último,
      // não quem cadastrou o CPF por último.
      mappedParticipants.sort((a, b) => {
        const aDate = new Date(a.last_attempt_at || a.created_at || 0).getTime();
        const bDate = new Date(b.last_attempt_at || b.created_at || 0).getTime();
        return bDate - aDate;
      });

      return ok({
        participants: mappedParticipants
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
