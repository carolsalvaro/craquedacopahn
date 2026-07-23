const API = "/api";
let ADMIN_PASSWORD = sessionStorage.getItem("admin_password") || "";
let cyclesCache = [];
let questionsCache = [];
let participantsCache = [];
let participantReportSelection = new Set();
let classifiedCache = [];
let pendingPrintedTicketsBatch = [];
let cycleManagementCache = { cycles: [], participants: [] };
let cycleManagementVisibleParticipants = [];

const $ = id => document.getElementById(id);

async function api(path, options = {}){
  const res = await fetch(API + path, {
    headers:{"Content-Type":"application/json","x-admin-password":ADMIN_PASSWORD,...(options.headers || {})},
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || "Erro na solicitação");
  return data;
}
function show(msg){ const n=$("adminNotice"); n.textContent=msg; n.classList.remove("hidden"); setTimeout(()=>n.classList.add("hidden"),4500); }
function onlyDigits(v){ return String(v || "").replace(/\D/g, ""); }
function formatCPF(v){ v=onlyDigits(v).slice(0,11); return v.replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"); }

function formatQuestionCycles(text){
  const raw = String(text || "").trim();
  if(!raw || raw === "Sem ciclo vinculado") return '<span class="badge warning">Sem ciclo</span>';

  const cycleNumbers = [...raw.matchAll(/Ciclo\s*([1-5])/g)].map(m => m[1]);
  const uniqueNumbers = [...new Set(cycleNumbers)];

  if(["1","2","3","4","5"].every(n => uniqueNumbers.includes(n))){
    return '<span class="badge success">Todos os 5 ciclos</span>';
  }

  if(uniqueNumbers.length > 1){
    return `<span class="badge success">${uniqueNumbers.length} ciclos</span>`;
  }

  const parts = raw.split(",").map(x => x.trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.map(x => `<span class="cycle-pill">${x}</span>`).join(" ");
}

function formatPhone(v){ v=onlyDigits(v).slice(0,11); if(v.length<=10) return v.replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{4})(\d)/,"$1-$2"); return v.replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2"); }
function whatsappInternationalNumber(v){
  const d = onlyDigits(v);
  if(!d) return "";
  if(d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if(d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}
function csvCell(value){
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}
function toLocalInput(iso){ if(!iso) return ""; const d=new Date(iso); const pad=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function periodText(c){ const a=c.start_at?new Date(c.start_at).toLocaleDateString("pt-BR"):"A definir"; const b=c.end_at?new Date(c.end_at).toLocaleDateString("pt-BR"):"A definir"; return `${a} a ${b}`; }
function formatDateTime(iso){
  if(!iso) return "Nunca";
  try{
    return new Date(iso).toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit"});
  }catch(e){
    return "Nunca";
  }
}


function formatCpfFinal(value){
  const digits = onlyDigits(value).slice(-5);
  if(!digits) return "---";
  if(digits.length <= 3) return digits;
  return `${digits.slice(0,3)}-${digits.slice(3)}`;
}

function formatRaffleDate(iso){
  if(!iso) return "A confirmar";
  try{
    const d = new Date(iso);
    const date = d.toLocaleDateString("pt-BR", {day:"2-digit", month:"2-digit", year:"numeric"});
    const time = d.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
    return `${date} às ${time}`;
  }catch(e){
    return "A confirmar";
  }
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function requireLogin(){ if(ADMIN_PASSWORD){ $("loginBox").classList.add("hidden"); $("adminApp").classList.remove("hidden"); loadAdmin().catch(e=>alert(e.message)); } }
async function loadAdmin(){ await loadCycles(); await loadQuestions(); await loadParticipants(); }

async function loadCycles(){
  const data=await api("/admin-cycles");
  cyclesCache=data.cycles || [];
  const active=cyclesCache.find(c=>c.status==="active") || cyclesCache[0] || {};
  const totals=cyclesCache.reduce((acc,c)=>{ acc.participants+=Number(c.unique_participants||0); acc.attempts+=Number(c.total_attempts||0); acc.classified+=Number(c.classified_participants||0); return acc; },{participants:0,attempts:0,classified:0});
  $("statsGrid").innerHTML=`
    <div class="stat"><span>Ciclo ativo</span><strong>${active.title?"1":"0"}</strong><small>${active.title||"Nenhum"}</small></div>
    <div class="stat"><span>Participantes</span><strong>${totals.participants}</strong><small>únicos</small></div>
    <div class="stat"><span>Tentativas</span><strong>${totals.attempts}</strong><small>totais</small></div>
    <div class="stat"><span>Classificados</span><strong>${totals.classified}</strong><small>aptos</small></div>`;
  $("cycleSummaryBody").innerHTML=cyclesCache.map(c=>`<tr><td>${c.title}</td><td><span class="badge ${c.status==="active"?"success":""}">${c.status}</span></td><td>${c.prize_name||"A definir"}</td><td>${c.unique_participants||0}</td><td>${c.classified_participants||0}</td></tr>`).join("");
  if($("cyclesEditBody")){
    $("cyclesEditBody").innerHTML=cyclesCache.map(c=>`<tr><td>${c.title}</td><td><span class="badge ${c.status==="active"?"success":""}">${c.status}</span></td><td>${periodText(c)}</td><td>${c.prize_name||"A definir"}</td><td class="actions-cell"><button class="btn small muted edit-cycle-btn" data-id="${c.cycle_id}">Editar</button></td></tr>`).join("");
    document.querySelectorAll(".edit-cycle-btn").forEach(btn=>btn.addEventListener("click",()=>editCycle(btn.dataset.id)));
  }
  const opts=cyclesCache.map(c=>`<option value="${c.cycle_id}">${c.title}</option>`).join("");
  ["questionCycleInput","classifiedCycleInput","winnerCycleInput"].forEach(id=>{ if($(id)) $(id).innerHTML=opts; });
}
function clearCycleForm(){
  $("cycleId").value=""; $("cycleFormTitle").textContent="Novo ciclo";
  ["cycleTitleInput","cycleSlugInput","cycleStartInput","cycleEndInput","cycleDrawInput","prizeNameInput","prizeDescriptionInput","cycleNotesInput","partnerNameInput","partnerUrlInput","partnerButtonInput"].forEach(id=>$(id).value=""); if($("questionsPerAttemptInput")) $("questionsPerAttemptInput").value="10"; if($("minimumCorrectInput")) $("minimumCorrectInput").value="6";
  $("cycleStageInput").value="group_stage"; $("cycleStatusInput").value="draft";
}
function editCycle(id){
  const c=cyclesCache.find(x=>x.cycle_id===id); if(!c) return;
  $("cycleFormTitle").textContent="Editar ciclo"; $("cycleId").value=c.cycle_id;
  $("cycleTitleInput").value=c.title||""; $("cycleSlugInput").value=c.slug||""; $("cycleStageInput").value=c.stage||"special";
  $("cycleStartInput").value=toLocalInput(c.start_at); $("cycleEndInput").value=toLocalInput(c.end_at); $("cycleDrawInput").value=toLocalInput(c.draw_at);
  $("cycleStatusInput").value=c.status||"draft"; if($("questionsPerAttemptInput")) $("questionsPerAttemptInput").value=c.questions_per_attempt||10; if($("minimumCorrectInput")) $("minimumCorrectInput").value=c.minimum_correct_answers||6; $("prizeNameInput").value=c.prize_name||""; $("prizeDescriptionInput").value=c.prize_description||""; if($("cycleNotesInput")) $("cycleNotesInput").value=c.public_notes||"";
  $("partnerNameInput").value=c.partner_name||""; $("partnerUrlInput").value=c.partner_instagram_url||""; $("partnerButtonInput").value=c.partner_button_text||"";
  window.scrollTo({top:$("tab-cycles").offsetTop-20,behavior:"smooth"});
}
async function saveCycle(){
  const payload={id:$("cycleId").value||null,title:$("cycleTitleInput").value.trim(),slug:$("cycleSlugInput").value.trim(),stage:$("cycleStageInput").value,start_at:$("cycleStartInput").value||null,end_at:$("cycleEndInput").value||null,draw_at:$("cycleDrawInput").value||null,status:$("cycleStatusInput").value,prize_name:$("prizeNameInput").value.trim(),prize_description:$("prizeDescriptionInput").value.trim(),public_notes: $("cycleNotesInput") ? $("cycleNotesInput").value.trim() : "", questions_per_attempt: Number($("questionsPerAttemptInput")?.value || 10), minimum_correct_answers: Number($("minimumCorrectInput")?.value || 6), partner_name:$("partnerNameInput").value.trim(),partner_instagram_url:$("partnerUrlInput").value.trim(),partner_button_text:$("partnerButtonInput").value.trim()};
  if(!payload.title||!payload.slug) return alert("Informe título e slug.");
  await api("/admin-cycles",{method:"POST",body:JSON.stringify(payload)}); show("Ciclo salvo."); clearCycleForm(); await loadCycles();
}

async function loadQuestions(){
  const data=await api("/admin-questions"); questionsCache=data.questions||[];
  $("questionsBody").innerHTML=questionsCache.map(q=>`<tr><td>${q.question_text}</td><td>${formatQuestionCycles(q.cycle_titles)}</td><td>${q.difficulty}</td><td>${q.total_correct||0}</td><td>${q.total_wrong||0}</td><td>${q.correct_rate_percent||0}%</td><td class="actions-cell"><button class="btn small muted edit-question-btn" data-id="${q.question_id}">Editar</button></td></tr>`).join("");
  document.querySelectorAll(".edit-question-btn").forEach(btn=>btn.addEventListener("click",()=>editQuestion(btn.dataset.id)));
}
function clearQuestionForm(){ $("questionFormTitle").textContent="Nova pergunta"; $("questionIdInput").value=""; ["questionTextInput","optionAInput","optionBInput","optionCInput","optionDInput","categoryInput"].forEach(id=>$(id).value=""); $("correctInput").value="A"; $("difficultyInput").value="easy"; }
function editQuestion(id){
  const q=questionsCache.find(x=>x.question_id===id); if(!q) return;
  $("questionFormTitle").textContent="Editar pergunta"; $("questionIdInput").value=q.question_id; $("questionTextInput").value=q.question_text||"";
  $("optionAInput").value=q.option_a||""; $("optionBInput").value=q.option_b||""; $("optionCInput").value=q.option_c||""; $("optionDInput").value=q.option_d||"";
  $("correctInput").value=q.correct_option||"A"; $("categoryInput").value=q.category||""; $("difficultyInput").value=q.difficulty||"medium";
  if(q.cycle_ids&&q.cycle_ids[0]) $("questionCycleInput").value=q.cycle_ids[0];
  window.scrollTo({top:$("tab-questions").offsetTop-20,behavior:"smooth"});
}
async function saveQuestion(){
  const payload={id:$("questionIdInput").value||null,question_text:$("questionTextInput").value.trim(),option_a:$("optionAInput").value.trim(),option_b:$("optionBInput").value.trim(),option_c:$("optionCInput").value.trim(),option_d:$("optionDInput").value.trim(),correct_option:$("correctInput").value,category:$("categoryInput").value.trim(),difficulty:$("difficultyInput").value,cycle_id:$("questionCycleInput").value||null};
  if(!payload.question_text||!payload.option_a||!payload.option_b||!payload.option_c||!payload.option_d) return alert("Preencha a pergunta e alternativas.");
  await api("/admin-questions",{method:"POST",body:JSON.stringify(payload)}); show(payload.id?"Pergunta atualizada.":"Pergunta cadastrada."); clearQuestionForm(); await loadQuestions();
}

async function loadParticipants(){
  if(!$("participantsBody")) return;

  const data = await api("/admin-participants");
  participantsCache = data.participants || [];
  participantReportSelection = new Set(participantsCache.map(p => p.id));

  renderParticipantsTable();
}

function updateParticipantsExportMeta(){
  const selected = participantReportSelection.size;
  const total = participantsCache.length;

  if($("participantsExportMeta")){
    $("participantsExportMeta").textContent = `${selected} de ${total} participantes marcados para exportação. Desmarque quem não deve entrar no relatório.`;
  }

  if($("selectAllParticipantsCheckbox")){
    $("selectAllParticipantsCheckbox").checked = total > 0 && selected === total;
    $("selectAllParticipantsCheckbox").indeterminate = selected > 0 && selected < total;
  }
}

function renderParticipantsTable(){
  if(!$("participantsBody")) return;

  if(!participantsCache.length){
    $("participantsBody").innerHTML = `<tr><td colspan="10">Nenhum participante encontrado.</td></tr>`;
    updateParticipantsExportMeta();
    return;
  }

  $("participantsBody").innerHTML = participantsCache.map(p => `
    <tr>
      <td><input type="checkbox" class="participant-report-checkbox" data-id="${p.id}" ${participantReportSelection.has(p.id) ? "checked" : ""} title="Incluir no relatório"></td>
      <td>${p.name}</td>
      <td>${formatCPF(p.cpf)}</td>
      <td>${formatPhone(p.whatsapp)}</td>
      <td>${p.city}</td>
      <td>${p.participated_cycles_text || "-"}</td>
      <td>${formatDateTime(p.last_attempt_at)}</td>
      <td>${p.total_attempts || 0}</td>
      <td>${p.has_classified ? '<span class="badge success">Sim</span>' : '<span class="badge">Não</span>'}</td>
      <td class="actions-cell">
        <div class="admin-actions">
          <button class="btn small muted edit-participant-btn" data-id="${p.id}">Editar</button>
          <button class="btn small" data-participant-answers="${p.id}">Ver respostas</button>
          <button class="btn small danger delete-participation-btn" data-delete-participation="${p.id}">Excluir participação</button>
        </div>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".participant-report-checkbox").forEach(input => {
    input.addEventListener("change", () => {
      if(input.checked) participantReportSelection.add(input.dataset.id);
      else participantReportSelection.delete(input.dataset.id);
      updateParticipantsExportMeta();
    });
  });

  document.querySelectorAll(".edit-participant-btn").forEach(btn => {
    btn.addEventListener("click", () => editParticipant(btn.dataset.id));
  });

  document.querySelectorAll("[data-participant-answers]").forEach(btn => {
    btn.addEventListener("click", () => loadParticipantAnswers(btn.dataset.participantAnswers).catch(e => alert(e.message)));
  });

  document.querySelectorAll("[data-delete-participation]").forEach(btn => {
    btn.addEventListener("click", () => deleteParticipation(btn.dataset.deleteParticipation).catch(e => alert(e.message)));
  });

  updateParticipantsExportMeta();
}

function setAllParticipantsReportSelection(checked){
  participantReportSelection = new Set(checked ? participantsCache.map(p => p.id) : []);
  renderParticipantsTable();
}

function exportParticipantsReport(){
  const selectedParticipants = participantsCache.filter(p => participantReportSelection.has(p.id));

  if(!selectedParticipants.length){
    alert("Nenhum participante selecionado para exportar.");
    return;
  }

  const headers = [
    "Nome",
    "CPF",
    "WhatsApp",
    "Cidade",
    "Ciclos participados",
    "Ciclos aptos/classificados",
    "Última participação",
    "Tentativas",
    "Classificado em algum ciclo"
  ];

  const rows = selectedParticipants.map(p => [
    p.name || "",
    formatCPF(p.cpf),
    formatPhone(p.whatsapp),
    p.city || "",
    p.participated_cycles_text || "",
    p.classified_cycles_text || "",
    formatDateTime(p.last_attempt_at),
    p.total_attempts || 0,
    p.has_classified ? "Sim" : "Não"
  ]);

  const htmlRows = [headers, ...rows].map((row, rowIndex) => {
    const tag = rowIndex === 0 ? "th" : "td";
    return `<tr>${row.map(value => `<${tag}>${String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</${tag}>`).join("")}</tr>`;
  }).join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <table>${htmlRows}</table>
      </body>
    </html>
  `;

  const blob = new Blob(["\ufeff" + html], {type:"application/vnd.ms-excel;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `participantes-vale-rede-de-postos-${today}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  show(`${selectedParticipants.length} participantes exportados para Excel.`);
}

function clearParticipantForm(){
  $("participantIdInput").value = "";
  ["participantNameInput","participantCpfInput","participantWhatsappInput","participantCityInput"].forEach(id => $(id).value = "");
}

function editParticipant(id){
  const p = participantsCache.find(x => x.id === id);
  if(!p) return;

  $("participantIdInput").value = p.id;
  $("participantNameInput").value = p.name || "";
  $("participantCpfInput").value = formatCPF(p.cpf);
  $("participantWhatsappInput").value = formatPhone(p.whatsapp);
  $("participantCityInput").value = p.city || "";

  window.scrollTo({top:$("tab-participants").offsetTop - 20, behavior:"smooth"});
}

async function saveParticipant(){
  const payload = {
    id: $("participantIdInput").value,
    name: $("participantNameInput").value.trim(),
    whatsapp: onlyDigits($("participantWhatsappInput").value),
    city: $("participantCityInput").value.trim()
  };

  if(!payload.id) return alert("Clique em editar em um participante primeiro.");
  if(!payload.name || !payload.whatsapp || !payload.city) return alert("Preencha nome, WhatsApp e cidade.");

  await api("/admin-participants", {method:"POST", body:JSON.stringify(payload)});
  show("Participante atualizado.");
  clearParticipantForm();
  await loadParticipants();
}

async function deleteParticipation(participantId){
  const p = participantsCache.find(x => x.id === participantId);
  if(!p) return alert("Participante não encontrado.");

  const okDelete = confirm(
    `Excluir a participação de ${p.name}?\n\n` +
    `Isso apaga as tentativas e respostas deste participante no ciclo ativo, como se ele ainda não tivesse participado. O cadastro será mantido.`
  );

  if(!okDelete) return;

  const data = await api("/admin-participants", {
    method:"DELETE",
    body:JSON.stringify({id: participantId})
  });

  show(data.message || "Participação excluída. O participante já pode tentar novamente.");

  if($("participantAnswersCard")) {
    $("participantAnswersCard").classList.add("hidden");
  }

  await loadParticipants();
  await loadCycles();
}


function answerStatusBadge(isCorrect){
  return isCorrect ? '<span class="badge success">Acertou</span>' : '<span class="badge">Errou</span>';
}
function formatAttemptDate(iso){
  if(!iso) return "Em andamento";
  return new Date(iso).toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"});
}
async function loadParticipantAnswers(participantId){
  const data = await api(`/admin-participant-answers?participant_id=${encodeURIComponent(participantId)}`);
  const p = data.participant || {};
  const attempts = data.attempts || [];
  $("participantAnswersCard").classList.remove("hidden");
  $("participantAnswersTitle").textContent = `Respostas de ${p.name || "participante"}`;
  if(!attempts.length){
    $("participantAnswersWrap").innerHTML = `<p class="meta">Este participante ainda não tem tentativas registradas.</p>`;
    return;
  }
  $("participantAnswersWrap").innerHTML = attempts.map(a => `
    <div class="card" style="box-shadow:none;margin:14px 0;border-color:#dfe8f6">
      <strong>${a.cycle_title || "Ciclo"}</strong>
      <p class="meta">${formatAttemptDate(a.finished_at || a.started_at)} — ${a.correct_answers || 0}/${a.total_questions || 0} acertos — ${a.is_classified ? "Classificado" : "Não classificado"}</p>
      <div class="table-card" style="margin-top:10px">
        <table class="table">
          <thead><tr><th>#</th><th>Pergunta</th><th>Resposta marcada</th><th>Correta</th><th>Status</th></tr></thead>
          <tbody>
            ${(a.answers || []).map(ans => `
              <tr>
                <td>${ans.position}</td>
                <td>${ans.question_text}</td>
                <td>${ans.selected_option || "-"}) ${ans.selected_text || ""}</td>
                <td>${ans.correct_option || "-"}) ${ans.correct_text || ""}</td>
                <td>${answerStatusBadge(ans.is_correct)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `).join("");
  window.scrollTo({top:$("participantAnswersCard").offsetTop - 20, behavior:"smooth"});
}

function cycleShortTitle(cycle){
  if(!cycle) return "Ciclo";
  const match = String(cycle.title || "").match(/Ciclo\s*\d+/i);
  if(match) return match[0].replace(/\s+/g, " ");
  return cycle.stage_order ? `Ciclo ${cycle.stage_order}` : (cycle.title || "Ciclo");
}

function formatCycleCell(info, cycle){
  if(!info || !info.participated){
    return '<span class="cycle-status-empty">Não participou</span>';
  }

  if(info.best_result){
    return `<span class="cycle-status-score">${info.best_result.score_text}</span>`;
  }

  const cycleStatus = String(cycle?.status || "");
  if(cycleStatus === "active"){
    return '<span class="cycle-status-progress">Em andamento</span>';
  }

  return '<span class="cycle-status-incomplete">Não finalizou</span>';
}

function cycleLastDate(info){
  if(!info || !info.last_attempt_at) return "";
  return formatDateTime(info.last_attempt_at);
}

function renderCycleManagementStats(){
  const cycles = cycleManagementCache.cycles || [];
  const participants = cycleManagementCache.participants || [];

  $("cycleManagementStats").innerHTML = cycles.map(c => {
    const count = participants.filter(p => p.cycles?.[c.id]?.participated).length;
    return `
      <div class="cycle-stat-card">
        <span>${cycleShortTitle(c)}</span>
        <strong>${count}</strong>
        <small>participantes</small>
      </div>
    `;
  }).join("");
}

function renderCycleManagementFilters(){
  const cycles = cycleManagementCache.cycles || [];
  const required = $("cycleRequiredFilters");
  const missing = $("cycleMissingFilters");

  if(!required || !missing) return;

  required.innerHTML = cycles.map(c => `
    <label class="cycle-check">
      <input type="checkbox" class="cycle-required-filter" value="${c.id}">
      <span>${cycleShortTitle(c)}</span>
    </label>
  `).join("");

  missing.innerHTML = cycles.map(c => `
    <label class="cycle-check">
      <input type="checkbox" class="cycle-missing-filter" value="${c.id}">
      <span>${cycleShortTitle(c)}</span>
    </label>
  `).join("");

  document.querySelectorAll(".cycle-required-filter,.cycle-missing-filter").forEach(input => {
    input.addEventListener("change", renderCycleManagementTable);
  });
}

function selectedCycleFilters(selector){
  return [...document.querySelectorAll(selector)]
    .filter(input => input.checked)
    .map(input => input.value);
}

function participantMatchesCycleFilters(participant){
  const required = selectedCycleFilters(".cycle-required-filter");
  const missing = selectedCycleFilters(".cycle-missing-filter");
  const q = String($("cycleManagementSearch")?.value || "").toLowerCase().trim();

  const hasRequired = required.every(cycleId => participant.cycles?.[cycleId]?.participated);
  const hasMissing = missing.every(cycleId => !participant.cycles?.[cycleId]?.participated);

  if(!hasRequired || !hasMissing) return false;

  if(q){
    const haystack = [
      participant.name,
      participant.cpf,
      participant.whatsapp,
      participant.city
    ].map(v => String(v || "").toLowerCase()).join(" ");

    if(!haystack.includes(q)) return false;
  }

  return true;
}


function cycleExportStatus(info, cycle){
  if(!info || !info.participated) return "Não participou";
  if(info.best_result) return info.best_result.score_text || "Participou";
  if(String(cycle?.status || "") === "active") return "Em andamento";
  return "Não finalizou";
}

function exportCycleWhatsappContacts(){
  const cycles = cycleManagementCache.cycles || [];
  const participants = cycleManagementVisibleParticipants || [];

  if(!participants.length){
    alert("Não há participantes na listagem atual para exportar.");
    return;
  }

  const headers = [
    "Nome",
    "WhatsApp",
    "Link WhatsApp",
    "Cidade",
    "CPF",
    "Última participação",
    "Ciclos participados",
    ...cycles.map(c => cycleShortTitle(c))
  ];

  const rows = participants.map(p => {
    const number = whatsappInternationalNumber(p.whatsapp);
    const whatsappLink = number ? `https://wa.me/${number}` : "";
    const ciclosParticipados = cycles
      .filter(c => p.cycles?.[c.id]?.participated)
      .map(c => cycleShortTitle(c))
      .join(", ");

    return [
      p.name || "",
      formatPhone(p.whatsapp),
      whatsappLink,
      p.city || "",
      formatCPF(p.cpf),
      formatDateTime(p.last_attempt_at),
      ciclosParticipados,
      ...cycles.map(c => cycleExportStatus(p.cycles?.[c.id], c))
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(";"))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `whatsapp-gestao-ciclos-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  show(`${participants.length} contatos exportados para CSV.`);
}

function renderCycleManagementTable(){
  const cycles = cycleManagementCache.cycles || [];
  const allParticipants = cycleManagementCache.participants || [];
  const participants = allParticipants.filter(participantMatchesCycleFilters);
  cycleManagementVisibleParticipants = participants;

  if($("cycleManagementListTotal")){
    const totalText = participants.length === allParticipants.length
      ? `${participants.length} participantes listados`
      : `${participants.length} de ${allParticipants.length} participantes listados`;
    $("cycleManagementListTotal").textContent = totalText;
  }

  $("cycleManagementHead").innerHTML = `
    <tr>
      <th>Nome</th>
      <th>CPF</th>
      <th>WhatsApp</th>
      <th>Cidade</th>
      ${cycles.map(c => `<th>${cycleShortTitle(c)}</th>`).join("")}
      <th>Última participação</th>
    </tr>
  `;

  if(!participants.length){
    $("cycleManagementBody").innerHTML = `<tr><td colspan="${5 + cycles.length}">Nenhum participante encontrado com estes filtros.</td></tr>`;
    return;
  }

  $("cycleManagementBody").innerHTML = participants.map(p => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${formatCPF(p.cpf)}</td>
      <td>${formatPhone(p.whatsapp)}</td>
      <td>${escapeHtml(p.city)}</td>
      ${cycles.map(c => {
        const info = p.cycles?.[c.id];
        return `<td title="${cycleLastDate(info)}">${formatCycleCell(info, c)}</td>`;
      }).join("")}
      <td>${formatDateTime(p.last_attempt_at)}</td>
    </tr>
  `).join("");
}

async function loadCycleManagement(){
  if(!$("cycleManagementBody")) return;

  const data = await api("/admin-participation-matrix");
  cycleManagementCache = {
    cycles: data.cycles || [],
    participants: data.participants || []
  };

  renderCycleManagementStats();
  renderCycleManagementFilters();
  renderCycleManagementTable();
}

function clearCycleManagementFilters(){
  document.querySelectorAll(".cycle-required-filter,.cycle-missing-filter").forEach(input => input.checked = false);
  if($("cycleManagementSearch")) $("cycleManagementSearch").value = "";
  renderCycleManagementTable();
}

function setupAdminMobileMenu(){
  const sidebar = $("adminSidebar");
  const toggle = $("adminMenuToggle");
  if(!sidebar || !toggle) return;

  const isMobile = () => window.matchMedia("(max-width:860px)").matches;

  const setCollapsed = (collapsed) => {
    if(!isMobile()){
      sidebar.classList.remove("is-collapsed");
      return;
    }
    sidebar.classList.toggle("is-collapsed", collapsed);
  };

  toggle.addEventListener("click", () => {
    if(!isMobile()) return;
    sidebar.classList.toggle("is-collapsed");
  });

  window.addEventListener("scroll", () => {
    if(!isMobile()) return;
    if($("adminApp")?.classList.contains("hidden")) return;
    if(window.scrollY > 80) setCollapsed(true);
  }, { passive: true });

  window.addEventListener("resize", () => {
    if(!isMobile()) sidebar.classList.remove("is-collapsed");
  });
}

async function loadClassifiedAdmin(){
  let cycleId=$("classifiedCycleInput").value;
  if(!cycleId && cyclesCache.length){
    const active=cyclesCache.find(c=>c.status==="active") || cyclesCache[0];
    cycleId=active?.cycle_id;
    if(cycleId) $("classifiedCycleInput").value=cycleId;
  }
  if(!cycleId) return alert("Selecione um ciclo.");

  pendingPrintedTicketsBatch = [];
  updateConfirmPrintedButton();

  const data=await api(`/admin-classified?cycle_id=${encodeURIComponent(cycleId)}`);
  classifiedCache=data.items||[];
  window.rafflePrintMeta = {
    isFinalCycle: data.is_final_cycle === true,
    preprintMode: data.preprint_mode === true,
    totalTickets: Number(data.total_tickets || 0),
    totalPeople: Number(data.total_people || classifiedCache.length || 0),
    cycle: data.cycle || null
  };

  if(!classifiedCache.length){
    let msg = "Nenhum classificado encontrado para este ciclo.";
    if(window.rafflePrintMeta.isFinalCycle){
      msg = window.rafflePrintMeta.preprintMode
        ? "Nenhum ticket pendente para pré-impressão. Durante o ciclo aberto, só aparecem participantes que já ficaram aptos no Ciclo 5 e ainda não tiveram seus tickets confirmados como impressos."
        : "Nenhum ticket pendente para impressão final. Quem já foi confirmado como impresso não aparece novamente.";
    }
    $("adminClassifiedBody").innerHTML=`<tr><td colspan="5">${msg}</td></tr>`;
    $("winnerParticipantInput").innerHTML="";
    show(msg);
    return;
  }

  if(window.rafflePrintMeta.isFinalCycle){
    const label = window.rafflePrintMeta.preprintMode
      ? `Pré-impressão: ${window.rafflePrintMeta.totalPeople} participantes, ${window.rafflePrintMeta.totalTickets} tickets pendentes.`
      : `Impressão final: ${window.rafflePrintMeta.totalPeople} participantes, ${window.rafflePrintMeta.totalTickets} tickets pendentes.`;
    show(label);
  }

  $("adminClassifiedBody").innerHTML=classifiedCache.map(r=>{
    const entries = Number(r.final_raffle_entries || r.classified_cycles_count || 1);
    const pending = Number(r.print_copies || 0);
    const printed = Number(r.already_printed_count || 0);
    const pendingNumbers = Array.isArray(r.pending_ticket_numbers) ? r.pending_ticket_numbers.join(", ") : "";

    const scoreLabel = window.rafflePrintMeta.isFinalCycle
      ? `${r.score_text}<br><small>Urna final: ${entries} total | ${printed} impressos | ${pending} pendentes${pendingNumbers ? ` (${pendingNumbers})` : ""}</small>`
      : r.score_text;

    return `<tr>
      <td>${r.name}</td>
      <td>${r.cpf_last_digits}</td>
      <td>${formatPhone(r.whatsapp)}</td>
      <td>${r.city}</td>
      <td>${scoreLabel}</td>
    </tr>`;
  }).join("");

  $("winnerParticipantInput").innerHTML=classifiedCache.map(r=>`<option value="${r.participant_id}" data-attempt="${r.attempt_id}">${r.name} — ${r.score_text}</option>`).join("");
}

function buildRaffleTicketRecords(){
  const isFinalCycle = window.rafflePrintMeta?.isFinalCycle === true;
  const ticketRecords = [];

  classifiedCache.forEach((r) => {
    if(isFinalCycle){
      const pendingNumbers = Array.isArray(r.pending_ticket_numbers)
        ? r.pending_ticket_numbers.map(Number).filter(n => Number.isInteger(n) && n > 0)
        : [];

      pendingNumbers.forEach(ticketNumber => {
        ticketRecords.push({
          row: r,
          ticketNumber,
          total: Number(r.final_raffle_entries || r.classified_cycles_count || pendingNumbers.length || 1)
        });
      });

      return;
    }

    ticketRecords.push({
      row: r,
      ticketNumber: 1,
      total: 1
    });
  });

  return ticketRecords;
}

function printRaffle(){
  if(!classifiedCache.length){
    alert("Carregue os classificados/elegíveis do ciclo antes de imprimir.");
    return;
  }

  const isFinalCycle = window.rafflePrintMeta?.isFinalCycle === true;
  const ticketRecords = buildRaffleTicketRecords();

  if(!ticketRecords.length){
    alert(isFinalCycle
      ? "Nenhum ticket pendente para imprimir. Quem já foi confirmado como impresso não aparece novamente."
      : "Nenhum ticket para imprimir."
    );
    return;
  }

  const cycleId = $("classifiedCycleInput")?.value || window.rafflePrintMeta?.cycle?.id || null;

  pendingPrintedTicketsBatch = isFinalCycle
    ? ticketRecords.map(({ row: r, ticketNumber, total }) => ({
        cycle_id: cycleId,
        participant_id: r.participant_id,
        ticket_number: ticketNumber,
        total_entries: total
      }))
    : [];

  updateConfirmPrintedButton();

  const tickets = ticketRecords.map(({ row: r, ticketNumber, total }) => {
    const cpfFinal = formatCpfFinal(r.cpf || r.cpf_last_digits);
    const name = escapeHtml((r.name || "Participante").toUpperCase());
    const whatsapp = escapeHtml(formatPhone(r.whatsapp));
    const city = escapeHtml(r.city || "-");
    const classifiedAt = escapeHtml(formatRaffleDate(r.finished_at || r.classified_at));
    const score = escapeHtml(r.score_text || `${r.correct_answers || 0}/${r.total_questions || 10}`);
    const classifiedCycles = Math.max(0, Math.min(5, Number(r.classified_cycles_count || r.final_raffle_entries || total || 1)));
    const classifiedCyclesLabels = Array.isArray(r.classified_cycles_labels)
      ? r.classified_cycles_labels.filter(Boolean)
      : String(r.classified_cycles_labels || "").split(",").map(s => s.trim()).filter(Boolean);
    const classifiedCyclesText = classifiedCyclesLabels.length
      ? `${classifiedCycles}x (${classifiedCyclesLabels.join(",")})`
      : `${classifiedCycles}x`;
    const dateLabel = isFinalCycle ? "PARTICIPOU C5:" : "CLASSIFICOU:";

    return `
      <section class="raffle-ticket">
        <div class="ticket-title">CRAQUE DA COPA HN NOTÍCIAS + VALE REDE DE POSTOS</div>

        <div class="ticket-line ticket-main-line">
          <div class="ticket-name"><span>NOME:</span> <strong>${name}</strong></div>
          <div class="ticket-cpf"><span>CPF FINAL:</span> <strong>${cpfFinal}</strong></div>
        </div>

        <div class="ticket-line ticket-details-line">
          <div><span>WHATSAPP:</span> <strong>${whatsapp}</strong></div>
          <div><span>CIDADE:</span> <strong>${city}</strong></div>
          <div><span>CHANCES AUMENTADAS EM:</span> <strong>${classifiedCyclesText}</strong></div>
        </div>

        <div class="ticket-line ticket-details-line ticket-extra-line">
          <div><span>${dateLabel}</span> <strong>${classifiedAt}</strong></div>
          <div><span>ACERTOS C5:</span> <strong>${score}</strong></div>
        </div>
      </section>
    `;
  });

  const pages = [];
  for(let i = 0; i < tickets.length; i += 6){
    const pageTickets = tickets.slice(i, i + 6).map((ticket, idx, arr) => `
      <div class="ticket-block">
        ${ticket}
        ${idx < arr.length - 1 ? '<div class="cut-line"></div>' : ''}
      </div>
    `).join("");

    pages.push(`<main class="raffle-page">${pageTickets}</main>`);
  }

  const w = window.open("", "_blank");
  w.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Papéis da urna</title>
        <style>
          @page{
            size: A4 portrait;
            margin: 8mm;
          }

          *{
            box-sizing:border-box;
          }

          html,
          body{
            margin:0;
            padding:0;
            background:#fff;
            color:#111;
            font-family:Arial, Helvetica, sans-serif;
          }

          .raffle-page{
            width:100%;
            min-height:281mm;
            display:flex;
            flex-direction:column;
            justify-content:flex-start;
            page-break-after:always;
            break-after:page;
          }

          .raffle-page:last-child{
            page-break-after:auto;
            break-after:auto;
          }

          .ticket-block{
            width:100%;
            margin:0;
            padding:0;
            page-break-inside:avoid;
            break-inside:avoid;
          }

          .raffle-ticket{
            width:100%;
            min-height:39mm;
            border:1.2px solid #111;
            padding:2.6mm 4mm;
            margin:0;
            page-break-inside:avoid;
            break-inside:avoid;
            display:flex;
            flex-direction:column;
            justify-content:space-between;
          }

          .ticket-title{
            font-size:8.1pt;
            font-weight:800;
            letter-spacing:.15px;
            text-transform:uppercase;
            line-height:1.05;
            margin-bottom:1.8mm;
          }

          .ticket-line{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:3.2mm;
            line-height:1.15;
          }

          .ticket-main-line{
            font-size:10.6pt;
            margin-bottom:1.7mm;
          }

          .ticket-details-line{
            font-size:7.9pt;
            gap:2.2mm;
          }

          .ticket-extra-line{
            margin-top:1mm;
          }

          .ticket-name{
            flex:1 1 auto;
            min-width:0;
          }

          .ticket-cpf{
            flex:0 0 auto;
            white-space:nowrap;
          }

          .ticket-details-line > div{
            white-space:nowrap;
            flex:1 1 auto;
          }

          span{
            font-size:.78em;
            font-weight:700;
            color:#333;
          }

          strong{
            font-weight:800;
          }

          .cut-line{
            height:6mm;
            border-top:1.1px dashed #333;
            margin:0;
            padding:0;
            page-break-inside:avoid;
            break-inside:avoid;
          }

          @media print{
            body{
              -webkit-print-color-adjust:exact;
              print-color-adjust:exact;
            }
          }
        </style>
      </head>
      <body>${pages.join("")}</body>
    </html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);

  if(isFinalCycle){
    show(`Lote gerado com ${ticketRecords.length} tickets pendentes. Depois de conferir que imprimiu corretamente, clique em “Confirmar impressão do lote”.`);
  }
}

async function confirmPrintedTicketsBatch(){
  if(!pendingPrintedTicketsBatch.length){
    alert("Nenhum lote aguardando confirmação. Primeiro clique em imprimir os tickets pendentes.");
    return;
  }

  const cycleId = $("classifiedCycleInput")?.value || window.rafflePrintMeta?.cycle?.id || null;
  if(!cycleId) return alert("Selecione o ciclo.");

  const okConfirm = confirm(`Confirmar que ${pendingPrintedTicketsBatch.length} tickets foram impressos corretamente? Depois disso, eles não aparecerão novamente na impressão de pendentes.`);
  if(!okConfirm) return;

  const data = await api("/admin-mark-printed-tickets", {
    method: "POST",
    body: JSON.stringify({
      cycle_id: cycleId,
      tickets: pendingPrintedTicketsBatch
    })
  });

  pendingPrintedTicketsBatch = [];
  updateConfirmPrintedButton();
  show(`${data.marked_count || 0} tickets confirmados como impressos.`);
  await loadClassifiedAdmin();
}

function cancelPrintedTicketsBatch(){
  pendingPrintedTicketsBatch = [];
  updateConfirmPrintedButton();
  show("Lote descartado. Nada foi marcado como impresso.");
}

function setupRafflePrintControls(){
  const printBtn = $("printRaffleBtn");
  if(!printBtn || $("confirmPrintedTicketsBtn")) return;

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "btn green";
  confirmBtn.type = "button";
  confirmBtn.id = "confirmPrintedTicketsBtn";
  confirmBtn.textContent = "Confirmar impressão do lote";
  confirmBtn.style.display = "none";
  confirmBtn.addEventListener("click", () => confirmPrintedTicketsBatch().catch(e => alert(e.message)));

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn secondary";
  cancelBtn.type = "button";
  cancelBtn.id = "cancelPrintedTicketsBtn";
  cancelBtn.textContent = "Cancelar lote";
  cancelBtn.style.display = "none";
  cancelBtn.addEventListener("click", cancelPrintedTicketsBatch);

  printBtn.insertAdjacentElement("afterend", confirmBtn);
  confirmBtn.insertAdjacentElement("afterend", cancelBtn);
}

function updateConfirmPrintedButton(){
  const confirmBtn = $("confirmPrintedTicketsBtn");
  const cancelBtn = $("cancelPrintedTicketsBtn");
  if(!confirmBtn || !cancelBtn) return;

  if(pendingPrintedTicketsBatch.length){
    confirmBtn.style.display = "";
    cancelBtn.style.display = "";
    confirmBtn.textContent = `Confirmar impressão do lote (${pendingPrintedTicketsBatch.length} tickets)`;
  }else{
    confirmBtn.style.display = "none";
    cancelBtn.style.display = "none";
    confirmBtn.textContent = "Confirmar impressão do lote";
  }
}


async function saveWinner(){ const participantId=$("winnerParticipantInput").value; const selected=$("winnerParticipantInput").selectedOptions[0]; const payload={cycle_id:$("winnerCycleInput").value,participant_id:participantId,attempt_id:selected?.dataset?.attempt||null,draw_date:$("winnerDateInput").value||null,status:$("winnerStatusInput").value,notes:$("winnerNotesInput").value}; if(!payload.cycle_id||!payload.participant_id) return alert("Selecione ciclo e participante."); await api("/admin-winner",{method:"POST",body:JSON.stringify(payload)}); show("Vencedor registrado."); }

document.addEventListener("DOMContentLoaded",()=>{
  $("loginBtn").addEventListener("click",()=>{ ADMIN_PASSWORD=$("adminPassword").value; sessionStorage.setItem("admin_password",ADMIN_PASSWORD); requireLogin(); });
  $("logoutBtn").addEventListener("click",e=>{ e.preventDefault(); sessionStorage.removeItem("admin_password"); location.reload(); });
  document.querySelectorAll(".admin-nav[data-tab]").forEach(a=>a.addEventListener("click",e=>{
    e.preventDefault();
    document.querySelectorAll(".admin-nav").forEach(x=>x.classList.remove("active"));
    a.classList.add("active");
    document.querySelectorAll(".admin-tab").forEach(x=>x.classList.add("hidden"));
    $(`tab-${a.dataset.tab}`).classList.remove("hidden");

    if(window.matchMedia("(max-width:860px)").matches){
      $("adminSidebar")?.classList.add("is-collapsed");
    }

    if(a.dataset.tab === "cycle-management"){
      loadCycleManagement().catch(err => alert(err.message));
    }
  }));
  $("reloadAdminBtn").addEventListener("click",()=>loadAdmin().catch(e=>alert(e.message)));
  $("saveCycleBtn").addEventListener("click",()=>saveCycle().catch(e=>alert(e.message))); $("newCycleBtn").addEventListener("click",clearCycleForm);
  $("saveQuestionBtn").addEventListener("click",()=>saveQuestion().catch(e=>alert(e.message))); $("newQuestionBtn").addEventListener("click",clearQuestionForm);
  $("reloadParticipantsBtn").addEventListener("click",()=>loadParticipants().catch(e=>alert(e.message)));
  if($("selectAllParticipantsReportBtn")) $("selectAllParticipantsReportBtn").addEventListener("click",()=>setAllParticipantsReportSelection(true));
  if($("clearParticipantsReportBtn")) $("clearParticipantsReportBtn").addEventListener("click",()=>setAllParticipantsReportSelection(false));
  if($("exportParticipantsReportBtn")) $("exportParticipantsReportBtn").addEventListener("click",exportParticipantsReport);
  if($("selectAllParticipantsCheckbox")) $("selectAllParticipantsCheckbox").addEventListener("change",e=>setAllParticipantsReportSelection(e.target.checked));
  $("saveParticipantBtn").addEventListener("click",()=>saveParticipant().catch(e=>alert(e.message))); $("clearParticipantBtn").addEventListener("click",clearParticipantForm); $("participantWhatsappInput").addEventListener("input",e=>e.target.value=formatPhone(e.target.value)); if($("closeParticipantAnswersBtn")) $("closeParticipantAnswersBtn").addEventListener("click",()=>$("participantAnswersCard").classList.add("hidden"));
  $("loadClassifiedBtn").addEventListener("click",()=>loadClassifiedAdmin().catch(e=>alert(e.message))); $("printRaffleBtn").addEventListener("click",printRaffle);
  $("winnerCycleInput").addEventListener("change",()=>{ $("classifiedCycleInput").value=$("winnerCycleInput").value; loadClassifiedAdmin().catch(()=>{}); }); $("saveWinnerBtn").addEventListener("click",()=>saveWinner().catch(e=>alert(e.message)));

  if($("reloadCycleManagementBtn")) $("reloadCycleManagementBtn").addEventListener("click",()=>loadCycleManagement().catch(e=>alert(e.message)));
  if($("applyCycleManagementFiltersBtn")) $("applyCycleManagementFiltersBtn").addEventListener("click",renderCycleManagementTable);
  if($("clearCycleManagementFiltersBtn")) $("clearCycleManagementFiltersBtn").addEventListener("click",clearCycleManagementFilters);
  if($("exportCycleWhatsappBtn")) $("exportCycleWhatsappBtn").addEventListener("click",exportCycleWhatsappContacts);
  if($("cycleManagementSearch")) $("cycleManagementSearch").addEventListener("input",renderCycleManagementTable);

  setupRafflePrintControls();
  setupAdminMobileMenu();
  requireLogin();
});
