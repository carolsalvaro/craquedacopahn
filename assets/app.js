const API = "/api";
const state = {
  activeCycle: null,
  participant: null,
  attempt: null,
  questions: [],
  currentIndex: 0,
  selectedOption: null,
  answers: {},
  savedAnswers: {},
  isStartingAttempt: false
};

const $ = (id) => document.getElementById(id);

// Link oficial do Instagram do HN Notícias
const HN_INSTAGRAM_URL = "https://www.instagram.com/hnnoticiascriciuma/";

function onlyDigits(v){ return (v || "").replace(/\D/g, ""); }

function formatCPF(v){
  v = onlyDigits(v).slice(0,11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCPF(v){
  const clean = onlyDigits(v).slice(0,11);
  if(clean.length !== 11) return "***.***.***-**";
  return `***.***.***-${clean.slice(-3)}`;
}

function escapeHTML(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(iso){
  if(!iso) return "A definir";
  return new Date(iso).toLocaleString("pt-BR", {
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function cycleStatusLabel(cycle){
  if(!cycle) return "Em breve";
  if(cycle.best_result){
    const suffix = cycle.best_result.is_classified ? "classificado" : "não classificado";
    return `${cycle.best_result.score_text} — ${suffix}`;
  }
  if(cycle.status === "active") return "Disponível para participar agora";
  if(cycle.status === "scheduled") return "Em breve";
  if(["closed", "draw_pending", "completed"].includes(cycle.status)) return "Encerrado";
  return "Em breve";
}

function cycleStatusClass(cycle){
  if(!cycle) return "soon";
  if(cycle.status === "active") return cycle.best_result?.is_classified ? "done" : "active";
  if(cycle.best_result?.is_classified) return "done";
  if(cycle.best_result) return "missed";
  return "soon";
}

function renderParticipantSummary(data){
  const participant = data.participant || {};
  const history = data.cycle_history || [];
  const activeStage = state.activeCycle?.stage_order || data.active_cycle_stage_order;
  const firstName = (participant.name || "").split(" ")[0] || "participante";

  const cyclesHtml = history.map(cycle => {
    const title = cycle.stage_order ? `Ciclo ${cycle.stage_order}` : (cycle.title || "Ciclo");
    const isActive = state.activeCycle?.id && cycle.id === state.activeCycle.id;
    const statusText = cycleStatusLabel(cycle);
    const className = cycleStatusClass(cycle);

    return `
      <div class="participant-cycle-row ${className}">
        <div>
          <strong>${escapeHTML(title)}</strong>
          ${isActive ? `<span class="badge gold">Aberto agora</span>` : ""}
        </div>
        <span>${escapeHTML(statusText)}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="participant-summary">
      <p class="participant-summary-intro">Encontramos seu cadastro. Você não precisa se cadastrar novamente para participar dos próximos ciclos.</p>

      <div class="participant-profile">
        <div>
          <span>Nome</span>
          <strong>${escapeHTML(participant.name)}</strong>
        </div>
        <div>
          <span>WhatsApp</span>
          <strong>${formatPhone(participant.whatsapp)}</strong>
        </div>
        <div>
          <span>Cidade</span>
          <strong>${escapeHTML(participant.city)}</strong>
        </div>
        <div>
          <span>CPF</span>
          <strong>${maskCPF(participant.cpf)}</strong>
        </div>
      </div>

      <div class="participant-history">
        <h3>Histórico da promoção</h3>
        ${cyclesHtml || `<p class="meta">O histórico dos ciclos ainda não está disponível.</p>`}
      </div>

      <p class="participant-summary-note">Olá, ${escapeHTML(firstName)}! Se o ciclo atual estiver aberto, clique no botão abaixo para participar.</p>
    </div>
  `;
}

function hideRankingFeature(){
  if($("ranking")) $("ranking").classList.add("hidden");
  document.querySelectorAll('[data-show-section="ranking"]').forEach(el => {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
  });
}

function formatPhone(v){
  v = onlyDigits(v).slice(0,11);
  if(v.length <= 10) {
    return v
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  return v
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function fmtDate(iso){
  if(!iso) return "A definir";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day:"2-digit",
    month:"2-digit",
    year:"numeric"
  });
}

function drawDateText(){
  const iso = state.activeCycle?.draw_at;
  if(!iso) return "A data do sorteio será divulgada pelo HN Notícias.";
  return `O sorteio está previsto para ${fmtDate(iso)}.`;
}

function activeQuestionTotal(){
  return state.activeCycle?.questions_per_attempt || 10;
}

function activeMinimumCorrect(){
  return state.activeCycle?.minimum_correct_answers || 6;
}

function cycleValidationText(){
  return state.activeCycle?.public_notes || "As exigências do ciclo serão informadas pela organização e poderão incluir seguir a Rede Vale e o HN Notícias no Instagram, estar em um grupo de notícias do HN ou ter baixado o aplicativo de descontos da Rede Vale.";
}

function updateDynamicRules(){
  const total = activeQuestionTotal();
  const minimum = activeMinimumCorrect();

  const fields = {
    questionTotalText: total,
    questionTotalCard: total,
    minCorrectText: minimum,
    minCorrectCard: minimum,
    rulesTotalQuestions: `${total} perguntas`,
    rulesMinimumCorrect: `${minimum} perguntas`
  };

  Object.entries(fields).forEach(([id, value]) => {
    if($(id)) $(id).textContent = value;
  });

  if($("cycleValidationRule")) {
    $("cycleValidationRule").textContent = cycleValidationText();
  }
}

async function api(path, options = {}){
  const res = await fetch(API + path, {
    headers: {
      "Content-Type":"application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if(!res.ok) {
    throw new Error(data.error || "Erro na solicitação");
  }

  return data;
}

function hideFlow(){
  [
    "identifySection",
    "registerSection",
    "knownSection",
    "alreadyClassifiedSection",
    "quizSection",
    "resultSection"
  ].forEach(id => {
    if($(id)) $(id).classList.add("hidden");
  });
}

function showNotice(msg){
  const n = $("homeNotice");
  n.textContent = msg;
  n.classList.remove("hidden");
}

function setPartnerLinks(){
  const prize = state.activeCycle?.prize || {};
  const partnerUrl = prize.partner_instagram_url || "#";
  const hnUrl = HN_INSTAGRAM_URL;

  document.querySelectorAll(".partner-link").forEach(a => a.href = partnerUrl);
  document.querySelectorAll(".hn-link").forEach(a => a.href = hnUrl);
}

async function showPublicSection(section){
  if(section === "regras"){
    $("regras").classList.remove("hidden");
    updateDynamicRules();
    window.scrollTo({
      top:$("regras").offsetTop - 20,
      behavior:"smooth"
    });
  }

  if(section === "ranking"){
    hideRankingFeature();
    return;
  }

  if(section === "classificados"){
    $("classificados").classList.remove("hidden");
    await loadClassified();
    window.scrollTo({
      top:$("classificados").offsetTop - 20,
      behavior:"smooth"
    });
  }
}

async function loadActiveCycle(){
  try{
    const data = await api("/active-cycle");
    state.activeCycle = data.cycle;

    const c = data.cycle;

    $("cycleTitle").textContent = c?.title || "Nenhum ciclo ativo";
    $("cyclePeriod").textContent = c ? `${fmtDate(c.start_at)} a ${fmtDate(c.end_at)}` : "";
    $("prizeName").textContent = c?.prize?.prize_name || "Prêmio do ciclo a definir";
    $("prizeDescription").textContent = c?.prize?.prize_description || "O prêmio deste ciclo será divulgado em breve.";

    updateDynamicRules();

    if ($("partnerName")) {
      $("partnerName").textContent = c?.prize?.partner_name || "Parceiro da semana";
    }

    if ($("partnerBtn")) {
      $("partnerBtn").textContent = c?.prize?.partner_button_text || "Seguir parceiro";
      $("partnerBtn").href = c?.prize?.partner_instagram_url || "#";
    }

    if ($("hnBtn")) {
      $("hnBtn").href = HN_INSTAGRAM_URL;
    }

    setPartnerLinks();
    hideRankingFeature();

    if(!c){
      $("startBtn").disabled = true;
      showNotice("No momento não há ciclo ativo. Volte em breve.");
    } else {
      $("startBtn").disabled = false;
    }

  }catch(e){
    showNotice(e.message);
  }
}

async function loadRanking(){
  // Ranking público removido para não gerar frustração entre participantes empatados.
  hideRankingFeature();
}

let allClassified = [];

async function loadClassified(){
  try{
    const data = await api("/classified");
    allClassified = data.items || [];
    renderClassified();
  }catch(e){
    console.error(e);
  }
}

function renderClassified(){
  const q = ($("classifiedSearch").value || "").toLowerCase();
  const rows = allClassified.filter(r => (r.display_name || "").toLowerCase().includes(q));

  $("classifiedBody").innerHTML = rows.map(r => `
    <tr>
      <td>${r.display_name}</td>
      <td>${r.city}</td>
      <td>${r.score_text}</td>
      <td><span class="badge success">${r.status}</span></td>
    </tr>
  `).join("");
}

async function identify(){
  const cpf = onlyDigits($("cpfInput").value);

  if(cpf.length !== 11) {
    return alert("Informe um CPF válido com 11 números.");
  }

  try{
    const data = await api("/identify", {
      method:"POST",
      body:JSON.stringify({cpf})
    });

    hideFlow();

    if(data.already_classified){
      state.participant = data.participant;
      $("alreadyText").innerHTML = `
        <strong>${escapeHTML(data.participant.name)}</strong>, você já está classificado neste ciclo com <strong>${escapeHTML(data.score_text)}</strong>.
        Agora é só aguardar o sorteio junto com os demais acertadores. ${drawDateText()}
        ${renderParticipantSummary(data)}
      `;
      $("alreadyClassifiedSection").classList.remove("hidden");
      return;
    }

    if(data.exists){
      state.participant = data.participant;
      const firstName = data.participant.name.split(" ")[0] || "participante";
      $("knownTitle").textContent = `Olá, ${firstName}!`;
      $("knownData").innerHTML = renderParticipantSummary(data);
      if($("startAttemptKnownBtn")) {
        const activeStage = state.activeCycle?.stage_order || data.active_cycle_stage_order || "";
        $("startAttemptKnownBtn").textContent = activeStage ? `Participar do Ciclo ${activeStage}` : "Participar deste ciclo";
      }
      $("knownSection").classList.remove("hidden");
    } else {
      state.participant = {cpf};
      $("registerSection").classList.remove("hidden");
    }

  }catch(e){
    alert(e.message);
  }
}

function setStartButtonsLoading(isLoading){
  [
    "registerBtn",
    "startAttemptKnownBtn",
    "tryAgainBtn",
    "startBtn",
    "rulesStartBtn"
  ].forEach(id => {
    const el = $(id);
    if(el) el.disabled = !!isLoading;
  });
}

async function register(){
  const ageOk = $("ageInput")
    ? $("ageInput").checked
    : ($("acceptInput") ? $("acceptInput").checked : false);

  const rulesOk = $("rulesAcceptedInput")
    ? $("rulesAcceptedInput").checked
    : ($("acceptInput") ? $("acceptInput").checked : false);

  const payload = {
    cpf: onlyDigits($("cpfInput").value),
    name: $("nameInput").value.trim(),
    whatsapp: onlyDigits($("whatsappInput").value),
    city: $("cityInput").value.trim(),
    is_18_confirmed: ageOk,
    regulation_accepted: rulesOk
  };

  if(!payload.name || payload.whatsapp.length < 10 || !payload.city || !ageOk || !rulesOk){
    return alert("Preencha todos os campos, confirme que tem 18 anos ou mais e aceite as regras da promoção.");
  }

  try{
    const data = await api("/register", {
      method:"POST",
      body:JSON.stringify(payload)
    });

    state.participant = data.participant;
    await startAttempt();

  }catch(e){
    alert(e.message);
  }
}

async function startAttempt(){
  if(state.isStartingAttempt) return;

  if(!state.activeCycle) {
    return alert("Nenhum ciclo ativo.");
  }

  if(!state.participant?.id) {
    return alert("Participante não identificado.");
  }

  state.isStartingAttempt = true;
  setStartButtonsLoading(true);

  try{
    const data = await api("/start-attempt", {
      method:"POST",
      body:JSON.stringify({
        cycle_id: state.activeCycle.id,
        participant_id: state.participant.id
      })
    });

    state.attempt = data.attempt;
    state.questions = data.questions;
    state.currentIndex = 0;
    state.selectedOption = null;
    state.answers = {};
    state.savedAnswers = {};

    hideFlow();
    $("quizSection").classList.remove("hidden");
    renderQuestion();

    window.scrollTo({
      top:$("quizSection").offsetTop - 20,
      behavior:"smooth"
    });

  }catch(e){
    alert(e.message);
    setStartButtonsLoading(false);
  }finally{
    state.isStartingAttempt = false;
  }
}

function answerKeyFor(q){
  return q.attempt_question_id || q.id;
}

function renderQuestion(){
  const q = state.questions[state.currentIndex];
  const key = answerKeyFor(q);

  state.selectedOption = state.answers[key] || null;

  $("nextQuestionBtn").disabled = !state.selectedOption;
  $("questionCounter").textContent = `Pergunta ${state.currentIndex + 1} de ${state.questions.length}`;
  $("progressBar").style.width = `${((state.currentIndex + 1) / state.questions.length) * 100}%`;
  $("questionText").textContent = q.question_text;

  $("optionsWrap").innerHTML = ["A","B","C","D"].map(letter => `
    <div class="option ${state.selectedOption === letter ? "selected" : ""}" data-option="${letter}">
      <strong>${letter}</strong>
      <span>${q.options[letter]}</span>
    </div>
  `).join("");

  document.querySelectorAll(".option").forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));

      el.classList.add("selected");
      state.selectedOption = el.dataset.option;
      state.answers[key] = state.selectedOption;

      $("nextQuestionBtn").disabled = false;
    });
  });

  $("nextQuestionBtn").textContent =
    state.currentIndex === state.questions.length - 1
      ? "Finalizar quiz"
      : "Avançar";
}

async function saveCurrentAnswer(){
  const q = state.questions[state.currentIndex];
  const key = answerKeyFor(q);
  const selected = state.selectedOption || state.answers[key];

  if(!selected) return false;

  if(state.savedAnswers[key] === selected) return true;

  await api("/answer", {
    method:"POST",
    body:JSON.stringify({
      attempt_id: state.attempt.id,
      attempt_question_id: q.attempt_question_id || null,
      question_id: q.id,
      position: q.position || (state.currentIndex + 1),
      selected_option: selected
    })
  });

  state.savedAnswers[key] = selected;
  return true;
}

async function nextQuestion(){
  if(!state.selectedOption) return;

  const btn = $("nextQuestionBtn");
  const originalText = btn.textContent;
  const isLast = state.currentIndex === state.questions.length - 1;

  btn.disabled = true;
  btn.textContent = isLast ? "Salvando e finalizando..." : "Salvando...";

  try{
    const saved = await saveCurrentAnswer();

    if(!saved) {
      throw new Error("Selecione uma alternativa antes de avançar.");
    }

    if(!isLast){
      state.currentIndex++;
      renderQuestion();
      return;
    }

    await finishAttempt();

  }catch(e){
    alert(e.message || "Não foi possível salvar/finalizar. Tente novamente.");
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function buildAnswersPayload(){
  return state.questions.map((q, idx) => {
    const key = answerKeyFor(q);

    return {
      attempt_question_id: q.attempt_question_id || null,
      question_id: q.id,
      position: q.position || (idx + 1),
      selected_option: state.answers[key] || null
    };
  });
}

function renderAnswerReview(answers){
  const box = $("answerReview");

  if(!answers || !answers.length){
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");

  box.innerHTML = `
    <h3>Seu desempenho nas perguntas</h3>
    <p class="answer-review-note">
      Você pode conferir quais perguntas acertou e quais errou. Nas perguntas erradas, a resposta correta não é exibida para preservar sua nova tentativa neste ciclo.
    </p>
    <div class="answer-list">
      ${answers.map(a => `
        <div class="answer-item ${a.is_correct ? "correct" : "wrong"}">
          <div class="answer-head">
            <div class="answer-question">${a.position}. ${a.question_text}</div>
            <span class="badge ${a.is_correct ? "success" : ""}">
              ${a.is_correct ? "Acertou" : "Errou"}
            </span>
          </div>
          <div class="answer-picked">
            <strong>Sua resposta:</strong> ${a.selected_option}) ${a.selected_text || ""}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function finishAttempt(){
  const data = await api("/finish-attempt", {
    method:"POST",
    body:JSON.stringify({
      attempt_id: state.attempt.id,
      answers: buildAnswersPayload()
    })
  });

  hideFlow();
  $("resultSection").classList.remove("hidden");
  renderAnswerReview(data.answers || []);

  const partnerUrl = state.activeCycle?.prize?.partner_instagram_url || "#";
  const partnerText = state.activeCycle?.prize?.partner_button_text || "Seguir Rede Vale";

  const shareMessage = encodeURIComponent(
    "Eu participei do Craque da Copa HN Notícias e Rede Vale de Postos! Teste seus conhecimentos sobre a Copa e concorra a um tanque de combustível: " + window.location.origin
  );

  const shareUrl = "https://wa.me/?text=" + shareMessage;
  const hnUrl = HN_INSTAGRAM_URL;

  if(data.is_classified){
    $("resultTitle").textContent = "Parabéns, você está classificado!";

    $("resultText").textContent =
      `Você acertou ${data.correct_answers} de ${data.total_questions} perguntas e já está na lista de classificados deste ciclo. Agora é só aguardar o sorteio junto com os demais acertadores. ${drawDateText()} A validação das regras do ciclo poderá ser conferida antes da entrega do prêmio.`;

    $("resultActions").innerHTML = `
      <a class="btn share-btn" href="${shareUrl}" target="_blank" rel="noopener">Compartilhe o quiz</a>
      <a class="btn secondary" href="${hnUrl}" target="_blank" rel="noopener">Seguir HN Notícias</a>
      <a class="btn gold" href="${partnerUrl}" target="_blank" rel="noopener">${partnerText}</a>
      <a class="btn secondary" href="https://w.app/bze3ol" target="_blank" rel="noopener">Suporte</a>
    `;

  } else {
    $("resultTitle").textContent = "Não foi dessa vez, mas você pode tentar de novo!";

    $("resultText").textContent =
      `Você acertou ${data.correct_answers} de ${data.total_questions}. Para entrar na lista de classificados, precisa acertar pelo menos ${data.minimum_correct_answers}. Como você ainda não classificou neste ciclo, pode participar novamente com novas perguntas.`;

    $("resultActions").innerHTML = `
      <button class="btn big result-primary-action" id="tryAgainBtn" type="button">Participar novamente</button>
      <a class="btn share-btn" href="${shareUrl}" target="_blank" rel="noopener">Compartilhe o quiz</a>
      <a class="btn secondary" href="${hnUrl}" target="_blank" rel="noopener">Seguir HN Notícias</a>
      <a class="btn gold" href="${partnerUrl}" target="_blank" rel="noopener">${partnerText}</a>
      <a class="btn secondary" href="https://w.app/bze3ol" target="_blank" rel="noopener">Suporte</a>
    `;

    setTimeout(() => {
      $("tryAgainBtn")?.addEventListener("click", startAttempt);
    }, 0);
  }

  hideRankingFeature();

  window.scrollTo({
    top:$("resultSection").offsetTop - 20,
    behavior:"smooth"
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  $("cpfInput").addEventListener("input", e => e.target.value = formatCPF(e.target.value));
  $("whatsappInput").addEventListener("input", e => e.target.value = formatPhone(e.target.value));

  $("startBtn").addEventListener("click", () => {
    hideFlow();
    $("identifySection").classList.remove("hidden");
    window.scrollTo({
      top:$("identifySection").offsetTop - 20,
      behavior:"smooth"
    });
  });

  if($("rulesStartBtn")) {
    $("rulesStartBtn").addEventListener("click", () => {
      hideFlow();
      $("identifySection").classList.remove("hidden");
      window.scrollTo({
        top:$("identifySection").offsetTop - 20,
        behavior:"smooth"
      });
    });
  }

  $("identifyBtn").addEventListener("click", identify);
  $("registerBtn").addEventListener("click", register);
  $("startAttemptKnownBtn").addEventListener("click", startAttempt);
  $("nextQuestionBtn").addEventListener("click", nextQuestion);
  if($("reloadRankingBtn")) $("reloadRankingBtn").addEventListener("click", loadRanking);
  if($("classifiedSearch")) $("classifiedSearch").addEventListener("input", renderClassified);

  document.addEventListener("click", async (e) => {
    const trigger = e.target.closest("[data-show-section]");

    if(!trigger) return;

    e.preventDefault();
    await showPublicSection(trigger.dataset.showSection);
  });

  await loadActiveCycle();
  hideRankingFeature();
});
