const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, checkAdmin } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();

    if (event.httpMethod === "GET") {
      const { data: stats, error: statsError } = await supabase
        .from("v_question_stats")
        .select("*")
        .order("question_text", { ascending: true });
      if (statsError) throw statsError;

      const ids = (stats || []).map(q => q.question_id);
      let details = [];
      if (ids.length) {
        const { data: d, error: dError } = await supabase
          .from("quiz_questions")
          .select("id,question_text,option_a,option_b,option_c,option_d,correct_option,category,difficulty,status")
          .in("id", ids);
        if (dError) throw dError;
        details = d || [];
      }

      const { data: links, error: lError } = await supabase
        .from("quiz_cycle_questions")
        .select("question_id,cycle_id,cycle:quiz_cycles(title)")
        .eq("status", "active");
      if (lError) throw lError;

      const detailMap = new Map(details.map(d => [d.id, d]));
      const linkMap = new Map();
      (links || []).forEach(l => {
        if (!linkMap.has(l.question_id)) linkMap.set(l.question_id, { ids: [], titles: [] });
        linkMap.get(l.question_id).ids.push(l.cycle_id);
        if (l.cycle?.title) linkMap.get(l.question_id).titles.push(l.cycle.title);
      });

      const questions = (stats || []).map(s => {
        const d = detailMap.get(s.question_id) || {};
        const l = linkMap.get(s.question_id) || { ids: [], titles: [] };
        return {
          ...s,
          option_a: d.option_a || "",
          option_b: d.option_b || "",
          option_c: d.option_c || "",
          option_d: d.option_d || "",
          correct_option: d.correct_option || "A",
          cycle_ids: l.ids,
          cycle_titles: l.titles.length ? [...new Set(l.titles)].join(", ") : (s.cycle_titles || "Sem ciclo vinculado")
        };
      });

      return ok({ questions });
    }

    if (event.httpMethod === "POST") {
      const b = parseBody(event);
      const payload = {
        question_text: b.question_text,
        option_a: b.option_a,
        option_b: b.option_b,
        option_c: b.option_c,
        option_d: b.option_d,
        correct_option: b.correct_option,
        category: b.category || null,
        difficulty: b.difficulty || "medium",
        status: "active"
      };

      let q;
      if (b.id) {
        const { data, error } = await supabase.from("quiz_questions").update(payload).eq("id", b.id).select("*").single();
        if (error) throw error;
        q = data;
      } else {
        const { data, error } = await supabase.from("quiz_questions").insert(payload).select("*").single();
        if (error) throw error;
        q = data;
      }

      if (b.cycle_id) {
        const { error: linkError } = await supabase
          .from("quiz_cycle_questions")
          .upsert({ cycle_id: b.cycle_id, question_id: q.id, status: "active" }, { onConflict: "cycle_id,question_id" });
        if (linkError) throw linkError;
      }

      return ok({ question: q });
    }

    return bad("Método não permitido.", 405);
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
