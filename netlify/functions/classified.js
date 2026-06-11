const { getSupabase } = require("./_lib/supabase");
const { ok, bad } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const params = event.queryStringParameters || {};
    let cycleId = params.cycle_id;

    if (!cycleId) {
      const { data: cycles, error: cError } = await supabase
        .from("quiz_cycles")
        .select("id")
        .eq("status", "active")
        .limit(1);
      if (cError) throw cError;
      cycleId = cycles?.[0]?.id;
    }

    if (!cycleId) return ok({ items: [] });

    const { data, error } = await supabase
      .from("v_public_classified")
      .select("*")
      .eq("cycle_id", cycleId)
      .order("display_name", { ascending: true });

    if (error) throw error;

    return ok({ items: data || [] });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
