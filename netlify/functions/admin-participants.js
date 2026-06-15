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

      return ok({
        participants: (participants || []).map(p => ({
          ...p,
          total_attempts: byParticipant.get(p.id)?.total_attempts || 0,
          has_classified: byParticipant.get(p.id)?.has_classified || false,
          last_attempt_at: byParticipant.get(p.id)?.last_attempt_at || null
        }))
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

    return bad("Método não permitido.", 405);
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
