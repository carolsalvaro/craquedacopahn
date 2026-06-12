const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, checkAdmin } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();

    if (event.httpMethod === "GET") {
      const { data: cycles, error } = await supabase
        .from("quiz_cycles")
        .select("*, prize:quiz_cycle_prizes(*)")
        .order("stage_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const { data: summaries, error: sError } = await supabase
        .from("v_cycle_summary")
        .select("*");
      if (sError) throw sError;

      const summaryMap = new Map((summaries || []).map(s => [s.cycle_id, s]));
      const formatted = (cycles || []).map(c => {
        const prize = Array.isArray(c.prize) ? c.prize[0] : c.prize;
        const s = summaryMap.get(c.id) || {};
        return {
          cycle_id: c.id,
          title: c.title,
          slug: c.slug,
          stage: c.stage,
          stage_label: c.stage_label,
          stage_order: c.stage_order,
          is_brazil_dependent: c.is_brazil_dependent,
          start_at: c.start_at,
          end_at: c.end_at,
          draw_at: c.draw_at,
          status: c.status,
          questions_per_attempt: c.questions_per_attempt,
          minimum_correct_answers: c.minimum_correct_answers,
          public_notes: c.public_notes,
          prize_name: prize?.prize_name || null,
          prize_description: prize?.prize_description || null,
          partner_name: prize?.partner_name || null,
          partner_instagram_url: prize?.partner_instagram_url || null,
          partner_button_text: prize?.partner_button_text || null,
          unique_participants: s.unique_participants || 0,
          total_attempts: s.total_attempts || 0,
          classified_participants: s.classified_participants || 0,
          average_correct_answers: s.average_correct_answers || null
        };
      });

      return ok({ cycles: formatted });
    }

    if (event.httpMethod === "POST") {
      const b = parseBody(event);
      const cyclePayload = {
        title: b.title,
        slug: b.slug,
        stage: b.stage || "special",
        stage_label: b.stage === "group_stage" ? "Fase de grupos" : null,
        start_at: b.start_at || null,
        end_at: b.end_at || null,
        draw_at: b.draw_at || null,
        status: b.status || "draft",
        questions_per_attempt: 20,
        minimum_correct_answers: 11
      };

      let cycleQuery;
      if (b.id) {
        cycleQuery = supabase.from("quiz_cycles").update(cyclePayload).eq("id", b.id).select("*").single();
      } else {
        cycleQuery = supabase.from("quiz_cycles").upsert(cyclePayload, { onConflict: "slug" }).select("*").single();
      }
      const { data: cycle, error: cError } = await cycleQuery;
      if (cError) throw cError;

      const { error: pError } = await supabase
        .from("quiz_cycle_prizes")
        .upsert({
          cycle_id: cycle.id,
          prize_name: b.prize_name || "Prêmio do ciclo a definir",
          prize_description: b.prize_description || "O prêmio deste ciclo será divulgado em breve.",
          partner_name: b.partner_name || "Parceiro da semana",
          partner_instagram_url: b.partner_instagram_url || null,
          partner_button_text: b.partner_button_text || "Seguir parceiro da semana"
        }, { onConflict: "cycle_id" });
      if (pError) throw pError;

      return ok({ cycle });
    }

    return bad("Método não permitido.", 405);
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
