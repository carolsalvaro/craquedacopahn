const { getSupabase } = require("./_lib/supabase");
const { ok, bad } = require("./_lib/utils");

exports.handler = async () => {
  try {
    const supabase = getSupabase();

    const { data: cycles, error } = await supabase
      .from("quiz_cycles")
      .select("*, prize:quiz_cycle_prizes(*)")
      .eq("status", "active")
      .order("stage_order", { ascending: true })
      .limit(1);

    if (error) throw error;

    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["hn_instagram_url"]);

    const settings = {};
    (settingsRows || []).forEach(r => settings[r.key] = r.value);

    const cycle = cycles?.[0] || null;
    if (cycle) cycle.prize = Array.isArray(cycle.prize) ? cycle.prize[0] : cycle.prize;
    if (cycle) cycle.settings = settings;

    return ok({ cycle });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
