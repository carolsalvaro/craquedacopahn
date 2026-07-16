const crypto = require("crypto");
const { getSupabase } = require("./_lib/supabase");
const { ok, bad, checkAdmin } = require("./_lib/utils");

exports.handler = async (event) => {
  try {
    checkAdmin(event);

    if (event.httpMethod !== "POST") {
      return bad("Método não permitido.", 405);
    }

    const supabase = getSupabase();
    const body = JSON.parse(event.body || "{}");
    const cycleId = body.cycle_id;
    const tickets = Array.isArray(body.tickets) ? body.tickets : [];

    if (!cycleId) return bad("Informe o ciclo.");
    if (!tickets.length) return bad("Nenhum ticket informado para confirmar.");

    const printBatchId = crypto.randomUUID();

    const rows = tickets
      .map(t => ({
        cycle_id: cycleId,
        participant_id: t.participant_id,
        ticket_number: Number(t.ticket_number),
        total_entries: Number(t.total_entries || t.final_raffle_entries || 0) || null,
        print_batch_id: printBatchId,
        printed_at: new Date().toISOString()
      }))
      .filter(t =>
        t.cycle_id &&
        t.participant_id &&
        Number.isInteger(t.ticket_number) &&
        t.ticket_number > 0
      );

    if (!rows.length) return bad("Nenhum ticket válido para confirmar.");

    const { error } = await supabase
      .from("quiz_raffle_printed_tickets")
      .upsert(rows, {
        onConflict: "cycle_id,participant_id,ticket_number",
        ignoreDuplicates: true
      });

    if (error) throw error;

    return ok({
      print_batch_id: printBatchId,
      marked_count: rows.length
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
