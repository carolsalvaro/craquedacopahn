const { getSupabase } = require("./_lib/supabase");
const { ok, bad, checkAdmin } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();
    const cycleId = event.queryStringParameters?.cycle_id;
    if (!cycleId) return bad("Informe o ciclo.");

    const { data, error } = await supabase
      .from("v_admin_classified")
      .select("*")
      .eq("cycle_id", cycleId)
      .order("correct_answers", { ascending: false })
      .order("finished_at", { ascending: true });

    if (error) throw error;
    return ok({ items: data || [] });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
