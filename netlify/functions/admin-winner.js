const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, checkAdmin } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();
    if (event.httpMethod !== "POST") return bad("Método não permitido.", 405);

    const b = parseBody(event);
    if (!b.cycle_id || !b.participant_id) return bad("Dados incompletos.");

    const { data: prize } = await supabase
      .from("quiz_cycle_prizes")
      .select("prize_name,partner_name")
      .eq("cycle_id", b.cycle_id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("quiz_winners")
      .insert({
        cycle_id: b.cycle_id,
        participant_id: b.participant_id,
        attempt_id: b.attempt_id || null,
        draw_date: b.draw_date || null,
        status: b.status || "pending_validation",
        notes: b.notes || null,
        prize_name_snapshot: prize?.prize_name || null,
        partner_name_snapshot: prize?.partner_name || null
      })
      .select("*")
      .single();

    if (error) throw error;
    return ok({ winner: data });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
