const { getSupabase } = require("./_lib/supabase");
const { ok, bad, parseBody, digits } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const body = parseBody(event);

    const cpf = digits(body.cpf);
    const whatsapp = digits(body.whatsapp);
    const name = String(body.name || "").trim();
    const city = String(body.city || "").trim();

    if (cpf.length !== 11) return bad("CPF inválido.");
    if (whatsapp.length < 10 || whatsapp.length > 11) return bad("WhatsApp inválido.");
    if (!name) return bad("Informe o nome completo.");
    if (!city) return bad("Informe a cidade.");
    if (!body.is_18_confirmed || !body.regulation_accepted) return bad("É necessário confirmar idade mínima e aceite do regulamento.");

    const { data, error } = await supabase
      .from("quiz_participants")
      .upsert({
        cpf,
        whatsapp,
        name,
        city,
        is_18_confirmed: true,
        regulation_accepted: true
      }, { onConflict: "cpf" })
      .select("*")
      .single();

    if (error) throw error;

    return ok({
      participant: {
        id: data.id,
        name: data.name,
        cpf: data.cpf,
        whatsapp: data.whatsapp,
        city: data.city
      }
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
