const API = "/api";
let ADMIN_PASSWORD = sessionStorage.getItem("admin_password") || "";
let cyclesCache = [];
let questionsCache = [];
let participantsCache = [];
let classifiedCache = [];

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

  const parts = raw.split(",").map(x => x.trim()).filter(Boolean);
  const unique = [...new Set(parts)];

  const valeCycles = unique.filter(x => /^Ciclo [1-5] — Rede Vale$/.test(x));
  if(valeCycles.length >= 5) return '<span class="badge success">Todos os 5 ciclos</span>';
  if(valeCycles.length > 1) return `<span class="badge success">${valeCycles.length} ciclos Rede Vale</span>`;

  return unique.map(x => `<span class="cycle-pill">${x}</span>`).join(" ");
}

function formatPhone(v){ v=onlyDigits(v).slice(0,11); if(v.length<=10) return v.replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{4})(\d)/,"$1-$2"); return v.replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2"); }
function toLocalInput(iso){ if(!iso) return ""; const d=new Date(iso); const pad=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function periodText(c){ const a=c.start_at?new Date(c.start_at).toLocaleDateString("pt-BR"):"A definir"; const b=c.end_at?new Date(c.end_at).toLocaleDateString("pt-BR"):"A definir"; return `${a} a ${b}`; }

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
  $("questionsBody").innerHTML=questionsCache.map(q=>`<tr><td>${q.question_text}</td><td>${q.cycle_titles||"Sem ciclo vinculado"}</td><td>${q.difficulty}</td><td>${q.total_correct||0}</td><td>${q.total_wrong||0}</td><td>${q.correct_rate_percent||0}%</td><td class="actions-cell"><button class="btn small muted edit-question-btn" data-id="${q.question_id}">Editar</button></td></tr>`).join("");
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
  const data=await api("/admin-participants"); participantsCache=data.participants||[];
  $("participantsBody").innerHTML=participantsCache.map(p=>`<tr><td>${p.name}</td><td>${formatCPF(p.cpf)}</td><td>${formatPhone(p.whatsapp)}</td><td>${p.city}</td><td>${p.total_attempts||0}</td><td>${p.has_classified?'<span class="badge success">Sim</span>':'<span class="badge">Não</span>'}</td><td class="actions-cell"><button class="btn small muted edit-participant-btn" data-id="${p.id}">Editar</button><button class="btn small" data-participant-answers="${p.id}">Ver respostas</button></td></tr>`).join("");
  document.querySelectorAll(".edit-participant-btn").forEach(btn=>btn.addEventListener("click",()=>editParticipant(btn.dataset.id)));
  document.querySelectorAll("[data-participant-answers]").forEach(btn=>btn.addEventListener("click",()=>loadParticipantAnswers(btn.dataset.participantAnswers).catch(e=>alert(e.message))));
}
function clearParticipantForm(){ $("participantIdInput").value=""; ["participantNameInput","participantCpfInput","participantWhatsappInput","participantCityInput"].forEach(id=>$(id).value=""); }
function editParticipant(id){ const p=participantsCache.find(x=>x.id===id); if(!p) return; $("participantIdInput").value=p.id; $("participantNameInput").value=p.name||""; $("participantCpfInput").value=formatCPF(p.cpf); $("participantWhatsappInput").value=formatPhone(p.whatsapp); $("participantCityInput").value=p.city||""; window.scrollTo({top:$("tab-participants").offsetTop-20,behavior:"smooth"}); }
async function saveParticipant(){ const payload={id:$("participantIdInput").value,name:$("participantNameInput").value.trim(),whatsapp:onlyDigits($("participantWhatsappInput").value),city:$("participantCityInput").value.trim()}; if(!payload.id) return alert("Clique em editar em um participante primeiro."); if(!payload.name||!payload.whatsapp||!payload.city) return alert("Preencha nome, WhatsApp e cidade."); await api("/admin-participants",{method:"POST",body:JSON.stringify(payload)}); show("Participante atualizado."); clearParticipantForm(); await loadParticipants(); }


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

async function loadClassifiedAdmin(){ const cycleId=$("classifiedCycleInput").value; const data=await api(`/admin-classified?cycle_id=${encodeURIComponent(cycleId)}`); classifiedCache=data.items||[]; $("adminClassifiedBody").innerHTML=classifiedCache.map(r=>`<tr><td>${r.name}</td><td>${r.cpf_last_digits}</td><td>${r.whatsapp}</td><td>${r.city}</td><td>${r.score_text}</td></tr>`).join(""); $("winnerParticipantInput").innerHTML=classifiedCache.map(r=>`<option value="${r.participant_id}" data-attempt="${r.attempt_id}">${r.name} — ${r.score_text}</option>`).join(""); }
function printRaffle(){ const html=classifiedCache.map(r=>`<div style="border:1px dashed #333;padding:14px;margin:10px;width:280px;display:inline-block;font-family:Arial"><strong>${r.name}</strong><br>${r.city}<br>CPF final: ${r.cpf_last_digits}<br>Pontuação: ${r.score_text}</div>`).join(""); const w=window.open("","_blank"); w.document.write(`<html><head><title>Urna</title></head><body>${html}</body></html>`); w.document.close(); w.print(); }
async function saveWinner(){ const participantId=$("winnerParticipantInput").value; const selected=$("winnerParticipantInput").selectedOptions[0]; const payload={cycle_id:$("winnerCycleInput").value,participant_id:participantId,attempt_id:selected?.dataset?.attempt||null,draw_date:$("winnerDateInput").value||null,status:$("winnerStatusInput").value,notes:$("winnerNotesInput").value}; if(!payload.cycle_id||!payload.participant_id) return alert("Selecione ciclo e participante."); await api("/admin-winner",{method:"POST",body:JSON.stringify(payload)}); show("Vencedor registrado."); }

document.addEventListener("DOMContentLoaded",()=>{
  $("loginBtn").addEventListener("click",()=>{ ADMIN_PASSWORD=$("adminPassword").value; sessionStorage.setItem("admin_password",ADMIN_PASSWORD); requireLogin(); });
  $("logoutBtn").addEventListener("click",e=>{ e.preventDefault(); sessionStorage.removeItem("admin_password"); location.reload(); });
  document.querySelectorAll(".admin-nav[data-tab]").forEach(a=>a.addEventListener("click",e=>{ e.preventDefault(); document.querySelectorAll(".admin-nav").forEach(x=>x.classList.remove("active")); a.classList.add("active"); document.querySelectorAll(".admin-tab").forEach(x=>x.classList.add("hidden")); $(`tab-${a.dataset.tab}`).classList.remove("hidden"); }));
  $("reloadAdminBtn").addEventListener("click",()=>loadAdmin().catch(e=>alert(e.message)));
  $("saveCycleBtn").addEventListener("click",()=>saveCycle().catch(e=>alert(e.message))); $("newCycleBtn").addEventListener("click",clearCycleForm);
  $("saveQuestionBtn").addEventListener("click",()=>saveQuestion().catch(e=>alert(e.message))); $("newQuestionBtn").addEventListener("click",clearQuestionForm);
  $("reloadParticipantsBtn").addEventListener("click",()=>loadParticipants().catch(e=>alert(e.message))); $("saveParticipantBtn").addEventListener("click",()=>saveParticipant().catch(e=>alert(e.message))); $("clearParticipantBtn").addEventListener("click",clearParticipantForm); $("participantWhatsappInput").addEventListener("input",e=>e.target.value=formatPhone(e.target.value)); if($("closeParticipantAnswersBtn")) $("closeParticipantAnswersBtn").addEventListener("click",()=>$("participantAnswersCard").classList.add("hidden"));
  $("loadClassifiedBtn").addEventListener("click",()=>loadClassifiedAdmin().catch(e=>alert(e.message))); $("printRaffleBtn").addEventListener("click",printRaffle);
  $("winnerCycleInput").addEventListener("change",()=>{ $("classifiedCycleInput").value=$("winnerCycleInput").value; loadClassifiedAdmin().catch(()=>{}); }); $("saveWinnerBtn").addEventListener("click",()=>saveWinner().catch(e=>alert(e.message)));
  requireLogin();
});
