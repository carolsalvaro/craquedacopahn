const API = "/api";
let ADMIN_PASSWORD = sessionStorage.getItem("admin_password") || "";
let cyclesCache = [];
let classifiedCache = [];

const $ = id => document.getElementById(id);

async function api(path, options = {}){
  const res = await fetch(API + path, {
    headers:{
      "Content-Type":"application/json",
      "x-admin-password": ADMIN_PASSWORD,
      ...(options.headers || {})
    },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || "Erro na solicitação");
  return data;
}
function show(msg){
  const n = $("adminNotice");
  n.textContent = msg;
  n.classList.remove("hidden");
  setTimeout(() => n.classList.add("hidden"), 4000);
}
function toLocalInput(iso){
  if(!iso) return "";
  const d = new Date(iso);
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function requireLogin(){
  if(ADMIN_PASSWORD){
    $("loginBox").classList.add("hidden");
    $("adminApp").classList.remove("hidden");
    loadAdmin();
  }
}
async function loadAdmin(){
  await loadCycles();
  await loadQuestions();
}
async function loadCycles(){
  const data = await api("/admin-cycles");
  cyclesCache = data.cycles || [];
  const active = cyclesCache.find(c => c.status === "active") || cyclesCache[0] || {};
  const totals = cyclesCache.reduce((acc,c) => {
    acc.participants += Number(c.unique_participants || 0);
    acc.attempts += Number(c.total_attempts || 0);
    acc.classified += Number(c.classified_participants || 0);
    return acc;
  }, {participants:0, attempts:0, classified:0});

  $("statsGrid").innerHTML = `
    <div class="stat"><span>Ciclo ativo</span><strong>${active.title ? "1" : "0"}</strong><small>${active.title || "Nenhum"}</small></div>
    <div class="stat"><span>Participantes</span><strong>${totals.participants}</strong><small>únicos</small></div>
    <div class="stat"><span>Tentativas</span><strong>${totals.attempts}</strong><small>totais</small></div>
    <div class="stat"><span>Classificados</span><strong>${totals.classified}</strong><small>aptos</small></div>
  `;
  $("cycleSummaryBody").innerHTML = cyclesCache.map(c => `
    <tr>
      <td>${c.title}</td>
      <td><span class="badge">${c.status}</span></td>
      <td>${c.prize_name || "A definir"}</td>
      <td>${c.unique_participants || 0}</td>
      <td>${c.classified_participants || 0}</td>
    </tr>
  `).join("");

  const opts = cyclesCache.map(c => `<option value="${c.cycle_id}">${c.title}</option>`).join("");
  ["questionCycleInput","classifiedCycleInput","winnerCycleInput"].forEach(id => $(id).innerHTML = opts);
}
async function loadQuestions(){
  const data = await api("/admin-questions");
  $("questionsBody").innerHTML = (data.questions || []).map(q => `
    <tr>
      <td>${q.question_text}</td>
      <td>${q.difficulty}</td>
      <td>${q.total_correct || 0}</td>
      <td>${q.total_wrong || 0}</td>
      <td>${q.correct_rate_percent || 0}%</td>
    </tr>
  `).join("");
}
async function saveCycle(){
  const payload = {
    title: $("cycleTitleInput").value.trim(),
    slug: $("cycleSlugInput").value.trim(),
    stage: $("cycleStageInput").value,
    start_at: $("cycleStartInput").value || null,
    end_at: $("cycleEndInput").value || null,
    draw_at: $("cycleDrawInput").value || null,
    status: $("cycleStatusInput").value,
    prize_name: $("prizeNameInput").value.trim(),
    prize_description: $("prizeDescriptionInput").value.trim(),
    partner_name: $("partnerNameInput").value.trim(),
    partner_instagram_url: $("partnerUrlInput").value.trim(),
    partner_button_text: $("partnerButtonInput").value.trim()
  };
  if(!payload.title || !payload.slug) return alert("Informe título e slug.");
  await api("/admin-cycles", {method:"POST", body:JSON.stringify(payload)});
  show("Ciclo salvo.");
  await loadCycles();
}
async function saveQuestion(){
  const payload = {
    question_text: $("questionTextInput").value.trim(),
    option_a: $("optionAInput").value.trim(),
    option_b: $("optionBInput").value.trim(),
    option_c: $("optionCInput").value.trim(),
    option_d: $("optionDInput").value.trim(),
    correct_option: $("correctInput").value,
    category: $("categoryInput").value.trim(),
    difficulty: $("difficultyInput").value,
    cycle_id: $("questionCycleInput").value || null
  };
  if(!payload.question_text || !payload.option_a || !payload.option_b || !payload.option_c || !payload.option_d) return alert("Preencha a pergunta e alternativas.");
  await api("/admin-questions", {method:"POST", body:JSON.stringify(payload)});
  ["questionTextInput","optionAInput","optionBInput","optionCInput","optionDInput","categoryInput"].forEach(id => $(id).value = "");
  show("Pergunta cadastrada.");
  await loadQuestions();
}
async function loadClassifiedAdmin(){
  const cycleId = $("classifiedCycleInput").value;
  const data = await api(`/admin-classified?cycle_id=${encodeURIComponent(cycleId)}`);
  classifiedCache = data.items || [];
  $("adminClassifiedBody").innerHTML = classifiedCache.map(r => `
    <tr><td>${r.name}</td><td>${r.cpf_last_digits}</td><td>${r.whatsapp}</td><td>${r.city}</td><td>${r.score_text}</td></tr>
  `).join("");
  $("winnerParticipantInput").innerHTML = classifiedCache.map(r => `<option value="${r.participant_id}" data-attempt="${r.attempt_id}">${r.name} — ${r.score_text}</option>`).join("");
}
function printRaffle(){
  const html = classifiedCache.map(r => `
    <div style="border:1px dashed #333;padding:14px;margin:10px;width:280px;display:inline-block;font-family:Arial">
      <strong>${r.name}</strong><br>
      ${r.city}<br>
      CPF final: ${r.cpf_last_digits}<br>
      Pontuação: ${r.score_text}
    </div>
  `).join("");
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Urna</title></head><body>${html}</body></html>`);
  w.document.close();
  w.print();
}
async function saveWinner(){
  const participantId = $("winnerParticipantInput").value;
  const selected = $("winnerParticipantInput").selectedOptions[0];
  const payload = {
    cycle_id: $("winnerCycleInput").value,
    participant_id: participantId,
    attempt_id: selected?.dataset?.attempt || null,
    draw_date: $("winnerDateInput").value || null,
    status: $("winnerStatusInput").value,
    notes: $("winnerNotesInput").value
  };
  if(!payload.cycle_id || !payload.participant_id) return alert("Selecione ciclo e participante.");
  await api("/admin-winner", {method:"POST", body:JSON.stringify(payload)});
  show("Vencedor registrado.");
}

document.addEventListener("DOMContentLoaded", () => {
  $("loginBtn").addEventListener("click", () => {
    ADMIN_PASSWORD = $("adminPassword").value;
    sessionStorage.setItem("admin_password", ADMIN_PASSWORD);
    requireLogin();
  });
  $("logoutBtn").addEventListener("click", e => {
    e.preventDefault();
    sessionStorage.removeItem("admin_password");
    location.reload();
  });
  document.querySelectorAll(".admin-nav[data-tab]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      document.querySelectorAll(".admin-nav").forEach(x => x.classList.remove("active"));
      a.classList.add("active");
      document.querySelectorAll(".admin-tab").forEach(x => x.classList.add("hidden"));
      $(`tab-${a.dataset.tab}`).classList.remove("hidden");
    });
  });
  $("reloadAdminBtn").addEventListener("click", loadAdmin);
  $("saveCycleBtn").addEventListener("click", () => saveCycle().catch(e => alert(e.message)));
  $("saveQuestionBtn").addEventListener("click", () => saveQuestion().catch(e => alert(e.message)));
  $("loadClassifiedBtn").addEventListener("click", () => loadClassifiedAdmin().catch(e => alert(e.message)));
  $("printRaffleBtn").addEventListener("click", printRaffle);
  $("winnerCycleInput").addEventListener("change", () => { $("classifiedCycleInput").value = $("winnerCycleInput").value; loadClassifiedAdmin().catch(()=>{}); });
  $("saveWinnerBtn").addEventListener("click", () => saveWinner().catch(e => alert(e.message)));
  requireLogin();
});
