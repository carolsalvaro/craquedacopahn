const { getSupabase } = require("./_lib/supabase");
const { ok, bad, checkAdmin } = require("./_lib/utils");

function lastDigits(cpf) {
  const digits = String(cpf || "").replace(/\D/g, "").slice(-5);
  if (!digits) return "---";
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function getParticipant(attempt) {
  return Array.isArray(attempt.participant) ? attempt.participant[0] : attempt.participant;
}

function cycleSetByParticipant(attempts) {
  const map = new Map();

  (attempts || []).forEach(a => {
    if (!a.participant_id || !a.cycle_id) return;
    if (!map.has(a.participant_id)) map.set(a.participant_id, new Set());
    map.get(a.participant_id).add(a.cycle_id);
  });

  return map;
}

function buildCycleLabelMap(cycles) {
  const map = new Map();
  (cycles || []).forEach(cycle => {
    if (!cycle?.id) return;
    const order = Number(cycle.stage_order || 0);
    const label = order > 0 ? `C${order}` : (cycle.slug || cycle.title || String(cycle.id));
    map.set(cycle.id, label);
  });
  return map;
}

function cycleLabelsFromSet(cycleSet, cycleLabelMap) {
  return [...(cycleSet || new Set())]
    .map(cycleId => ({
      cycleId,
      label: cycleLabelMap.get(cycleId) || String(cycleId)
    }))
    .sort((a, b) => {
      const na = Number(String(a.label).replace(/\D/g, "")) || 999;
      const nb = Number(String(b.label).replace(/\D/g, "")) || 999;
      return na - nb;
    })
    .map(item => item.label);
}

exports.handler = async (event) => {
  try {
    checkAdmin(event);
    const supabase = getSupabase();
    const cycleId = event.queryStringParameters?.cycle_id;
    if (!cycleId) return bad("Informe o ciclo.");

    const { data: selectedCycle, error: cycleError } = await supabase
      .from("quiz_cycles")
      .select("id,title,slug,stage_order,status")
      .eq("id", cycleId)
      .single();

    if (cycleError) throw cycleError;

    const isFinalCycle =
      Number(selectedCycle?.stage_order) === 5 ||
      selectedCycle?.slug === "rede-vale-ciclo-5";

    const { data: allCycles, error: allCyclesError } = await supabase
      .from("quiz_cycles")
      .select("id,title,slug,stage_order");

    if (allCyclesError) throw allCyclesError;

    const cycleLabelMap = buildCycleLabelMap(allCycles);

    if (isFinalCycle) {
      const isCycleOpen = selectedCycle?.status === "active";

      // Último ciclo:
      // - Durante o ciclo: só pré-imprime quem já ficou apto/classificado no Ciclo 5.
      // - Após o fechamento: imprime todos os elegíveis pendentes, desde que tenham participado/finalizado o Ciclo 5.
      // - Em ambos os casos: só imprime os tickets ainda não confirmados como impressos.
      const { data: finalAttempts, error: finalAttemptsError } = await supabase
        .from("quiz_attempts")
        .select("id,cycle_id,participant_id,correct_answers,total_questions,finished_at,is_classified,participant:quiz_participants(id,name,cpf,whatsapp,city)")
        .eq("cycle_id", cycleId)
        .eq("status", "finished")
        .order("correct_answers", { ascending: false })
        .order("finished_at", { ascending: true });

      if (finalAttemptsError) throw finalAttemptsError;

      const participantIds = [...new Set((finalAttempts || []).map(a => a.participant_id).filter(Boolean))];

      if (!participantIds.length) {
        return ok({
          items: [],
          is_final_cycle: true,
          preprint_mode: isCycleOpen,
          cycle: selectedCycle,
          total_tickets: 0,
          total_people: 0
        });
      }

      const { data: allClassifiedAttempts, error: allClassifiedError } = await supabase
        .from("quiz_attempts")
        .select("participant_id,cycle_id")
        .in("participant_id", participantIds)
        .eq("status", "finished")
        .eq("is_classified", true);

      if (allClassifiedError) throw allClassifiedError;

      const classifiedCyclesByParticipant = cycleSetByParticipant(allClassifiedAttempts);

      const { data: printedRows, error: printedError } = await supabase
        .from("quiz_raffle_printed_tickets")
        .select("participant_id,ticket_number")
        .eq("cycle_id", cycleId);

      if (printedError) throw printedError;

      const printedByParticipant = new Map();

      (printedRows || []).forEach(row => {
        if (!printedByParticipant.has(row.participant_id)) {
          printedByParticipant.set(row.participant_id, new Set());
        }
        printedByParticipant.get(row.participant_id).add(Number(row.ticket_number));
      });

      const finalClassifiedParticipants = new Set(
        (finalAttempts || [])
          .filter(a => a.is_classified === true)
          .map(a => a.participant_id)
      );

      const seen = new Set();
      const items = [];

      (finalAttempts || []).forEach(a => {
        if (seen.has(a.participant_id)) return;
        seen.add(a.participant_id);

        const p = getParticipant(a);
        if (!p) return;

        const classifiedCyclesSet = classifiedCyclesByParticipant.get(a.participant_id) || new Set();
        const classifiedCyclesCount = classifiedCyclesSet.size;
        const classifiedCyclesLabels = cycleLabelsFromSet(classifiedCyclesSet, cycleLabelMap);

        if (classifiedCyclesCount <= 0) return;

        const isClassifiedInFinalCycle = finalClassifiedParticipants.has(a.participant_id);

        // Enquanto o ciclo está aberto, só imprime quem já travou a participação classificando no Ciclo 5.
        if (isCycleOpen && !isClassifiedInFinalCycle) return;

        const printedSet = printedByParticipant.get(a.participant_id) || new Set();
        const pendingTicketNumbers = [];

        for (let n = 1; n <= Math.min(5, classifiedCyclesCount); n += 1) {
          if (!printedSet.has(n)) pendingTicketNumbers.push(n);
        }

        if (!pendingTicketNumbers.length) return;

        items.push({
          cycle_id: a.cycle_id,
          participant_id: a.participant_id,
          name: p.name,
          cpf: p.cpf,
          cpf_last_digits: lastDigits(p.cpf),
          whatsapp: p.whatsapp,
          city: p.city,
          attempt_id: a.id,
          correct_answers: a.correct_answers,
          total_questions: a.total_questions,
          score_text: `${a.correct_answers}/${a.total_questions}`,
          finished_at: a.finished_at,
          classified_in_selected_cycle: isClassifiedInFinalCycle,
          participated_last_cycle: true,
          classified_cycles_count: classifiedCyclesCount,
          classified_cycles_labels: classifiedCyclesLabels,
          final_raffle_entries: classifiedCyclesCount,
          already_printed_count: printedSet.size,
          pending_ticket_numbers: pendingTicketNumbers,
          print_copies: pendingTicketNumbers.length,
          is_final_cycle: true
        });
      });

      const totalTickets = items.reduce((sum, item) => sum + Number(item.print_copies || 0), 0);

      return ok({
        items,
        is_final_cycle: true,
        preprint_mode: isCycleOpen,
        cycle: selectedCycle,
        total_tickets: totalTickets,
        total_people: items.length
      });
    }

    // Regra normal dos demais ciclos: imprime uma vez cada classificado do ciclo.
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("id,cycle_id,participant_id,correct_answers,total_questions,finished_at,participant:quiz_participants(id,name,cpf,whatsapp,city)")
      .eq("cycle_id", cycleId)
      .eq("status", "finished")
      .eq("is_classified", true)
      .order("correct_answers", { ascending: false })
      .order("finished_at", { ascending: true });

    if (error) throw error;

    const participantIds = [...new Set((data || []).map(a => a.participant_id).filter(Boolean))];

    const classifiedCyclesByParticipant = new Map();

    if (participantIds.length) {
      const { data: allClassifiedAttempts, error: allClassifiedError } = await supabase
        .from("quiz_attempts")
        .select("participant_id,cycle_id")
        .in("participant_id", participantIds)
        .eq("status", "finished")
        .eq("is_classified", true);

      if (allClassifiedError) throw allClassifiedError;

      (allClassifiedAttempts || []).forEach(a => {
        if (!classifiedCyclesByParticipant.has(a.participant_id)) {
          classifiedCyclesByParticipant.set(a.participant_id, new Set());
        }
        if (a.cycle_id) classifiedCyclesByParticipant.get(a.participant_id).add(a.cycle_id);
      });
    }

    const seen = new Set();
    const items = [];

    (data || []).forEach(a => {
      if (seen.has(a.participant_id)) return;
      seen.add(a.participant_id);

      const p = getParticipant(a);
      if (!p) return;

      const classifiedCyclesSet = classifiedCyclesByParticipant.get(a.participant_id) || new Set([a.cycle_id]);
      const classifiedCyclesCount = classifiedCyclesSet.size || 1;
      const classifiedCyclesLabels = cycleLabelsFromSet(classifiedCyclesSet, cycleLabelMap);

      items.push({
        cycle_id: a.cycle_id,
        participant_id: a.participant_id,
        name: p.name,
        cpf: p.cpf,
        cpf_last_digits: lastDigits(p.cpf),
        whatsapp: p.whatsapp,
        city: p.city,
        attempt_id: a.id,
        correct_answers: a.correct_answers,
        total_questions: a.total_questions,
        score_text: `${a.correct_answers}/${a.total_questions}`,
        finished_at: a.finished_at,
        classified_cycles_count: classifiedCyclesCount,
        classified_cycles_labels: classifiedCyclesLabels,
        final_raffle_entries: classifiedCyclesCount,
        already_printed_count: 0,
        pending_ticket_numbers: [1],
        print_copies: 1,
        is_final_cycle: false
      });
    });

    return ok({
      items,
      is_final_cycle: false,
      preprint_mode: false,
      cycle: selectedCycle,
      total_tickets: items.length,
      total_people: items.length
    });
  } catch (e) {
    return bad(e.message, e.statusCode || 500);
  }
};
