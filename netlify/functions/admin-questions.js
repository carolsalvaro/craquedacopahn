const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, checkAdmin } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();

    if (event.httpMethod === "GET") {
      const { data, error } = await supabase
        .from("v_question_stats")
        .select("*")
        .order("question_text", { ascending: true });
      if (error) throw error;
      return ok({ questions: data || [] });
    }

    if (event.httpMethod === "POST") {
      const b = parseBody(event);
      const { data: q, error } = await supabase
        .from("quiz_questions")
        .insert({
          question_text: b.question_text,
          option_a: b.option_a,
          option_b: b.option_b,
          option_c: b.option_c,
          option_d: b.option_d,
          correct_option: b.correct_option,
          category: b.category || null,
          difficulty: b.difficulty || "medium",
          status: "active"
        })
        .select("*")
        .single();
      if (error) throw error;

      if (b.cycle_id) {
        const { error: linkError } = await supabase
          .from("quiz_cycle_questions")
          .insert({ cycle_id: b.cycle_id, question_id: q.id, status: "active" });
        if (linkError) throw linkError;
      }

      return ok({ question: q });
    }

    return bad("Método não permitido.", 405);
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
