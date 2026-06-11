const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, checkAdmin } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();

    if (event.httpMethod === "GET") {
      const { data, error } = await supabase
        .from("v_cycle_summary")
        .select("*")
        .order("stage_order", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return ok({ cycles: data || [] });
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

      const { data: cycle, error: cError } = await supabase
        .from("quiz_cycles")
        .upsert(cyclePayload, { onConflict: "slug" })
        .select("*")
        .single();
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
