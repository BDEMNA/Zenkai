// ════════════════════════════════════════════════════
// ENTRETIEN IA — Zenkai Whitelist Trainer
// Porté depuis le simulateur original, clé API sécurisée via localStorage
// ════════════════════════════════════════════════════

// ── STATE ──
let apiKey = '';
let currentStep = 0;
let formData = {};
let messages = [];
let questionCount = 0;
const MAX_QUESTIONS = 5;
let waitingForAI = false;
let oralEnded = false;

// ──────────────────────────────────────────────
// API KEY
// ──────────────────────────────────────────────
function saveApiKey() {
  const val = document.getElementById('apiKeyInput').value.trim();
  if (!val) {
    alert('Colle ta clé API Gemini avant de continuer.');
    return;
  }
  apiKey = val;
  ApiKeyStore.set(val);
  document.getElementById('apiSetup').classList.remove('visible');
}

// ──────────────────────────────────────────────
// INTRO → STEP 1
// ──────────────────────────────────────────────
function startSim() {
  if (!apiKey) {
    alert('Entre ta clé API Gemini d\'abord !');
    document.getElementById('apiSetup').classList.add('visible');
    document.getElementById('apiKeyInput').focus();
    return;
  }
  document.getElementById('introCard').style.display = 'none';
  document.getElementById('progressBar').style.display = 'flex';
  showStep(1);
}

// ──────────────────────────────────────────────
// PROGRESS
// ──────────────────────────────────────────────
function showStep(n) {
  currentStep = n;
  [1, 2, 3].forEach(i => {
    document.getElementById('step' + i).classList.remove('visible');
    const seal = document.getElementById('seal' + i);
    const label = document.getElementById('label' + i);
    if (i < n) {
      seal.className = 'step-seal done';
      label.className = 'step-label done';
    } else if (i === n) {
      seal.className = 'step-seal active';
      label.className = 'step-label active';
    } else {
      seal.className = 'step-seal';
      label.className = 'step-label';
    }
  });
  const conn1 = document.getElementById('conn1');
  const conn2 = document.getElementById('conn2');
  conn1.className = n >= 2 ? 'step-connector active' : 'step-connector';
  conn2.className = n >= 3 ? 'step-connector active' : 'step-connector';

  if (n <= 3) document.getElementById('step' + n).classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ──────────────────────────────────────────────
// FORM HELPERS
// ──────────────────────────────────────────────
function updateCounter(fieldId, counterId, min) {
  const val = document.getElementById(fieldId).value.length;
  const el = document.getElementById(counterId);
  el.textContent = val + '/' + min + ' min';
  el.className = 'counter' + (val >= min ? ' ok' : val > min * 0.6 ? ' warn' : '');
}

function checkAge() {
  const dob = document.getElementById('dob').value;
  if (!dob) return;
  const age = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000));
  const badge = document.getElementById('ageBadge');
  badge.className = age < 16 ? 'age-badge visible' : 'age-badge';
}

function showError(id, show) {
  const el = document.getElementById('e-' + id);
  if (el) el.className = show ? 'form-error visible' : 'form-error';
}

// ──────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────
function goStep1() { showStep(1); }

function goStep2() {
  const dob = document.getElementById('dob').value;
  const motivation = document.getElementById('motivation').value;
  const experience = document.getElementById('experience').value;

  let ok = true;
  if (!dob) { ok = false; }
  const age = dob ? Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000)) : 0;
  if (age < 16) { document.getElementById('ageBadge').className = 'age-badge visible'; ok = false; }
  if (motivation.length < 150) { showError('motivation', true); ok = false; } else showError('motivation', false);
  if (experience.length < 150) { showError('experience', true); ok = false; } else showError('experience', false);

  if (!ok) return;

  formData.dob = dob;
  formData.age = age;
  formData.motivation = motivation;
  formData.experience = experience;
  showStep(2);
}

function goStep3() {
  const charFirst = document.getElementById('charFirst').value.trim();
  const charLast = document.getElementById('charLast').value.trim();
  const village = document.getElementById('village').value;
  const charHistory = document.getElementById('charHistory').value;
  const charGoals = document.getElementById('charGoals').value;
  const charPersonality = document.getElementById('charPersonality').value;

  let ok = true;
  if (!charFirst) { showError('charFirst', true); ok = false; } else showError('charFirst', false);
  if (!charLast) { showError('charLast', true); ok = false; } else showError('charLast', false);
  if (!village) { showError('village', true); ok = false; } else showError('village', false);
  if (charHistory.length < 200) { showError('charHistory', true); ok = false; } else showError('charHistory', false);
  if (charGoals.length < 150) { showError('charGoals', true); ok = false; } else showError('charGoals', false);
  if (charPersonality.length < 100) { showError('charPersonality', true); ok = false; } else showError('charPersonality', false);

  if (!ok) return;

  formData.charFirst = charFirst;
  formData.charLast = charLast;
  formData.village = village;
  formData.charHistory = charHistory;
  formData.charGoals = charGoals;
  formData.charPersonality = charPersonality;
  formData.visual = document.getElementById('visual').value;

  showStep(3);
  initChat();
}

// ──────────────────────────────────────────────
// SYSTEM PROMPT
// ──────────────────────────────────────────────
function buildSystemPrompt() {
  return `Tu es un recruteur strict mais bienveillant du serveur de roleplay Naruto "Zenkai Shinobi RP". Tu dois mener l'entretien oral de la whitelist d'un candidat.

CONTEXTE DU SERVEUR :
- Serveur RP Naruto sérieux, immersif, minimum 16 ans
- 3 villages : Konoha, Suna, Ame
- Temporalité : époque des premiers Kage (Hashirama, Tobirama)
- L'IA pour rédiger les candidatures est interdit
- Une bonne candidature doit répondre : Quand ? Comment ? Pourquoi ?

RÈGLES STRICTES — INTERDICTIONS ABSOLUES :
Nom troll ou jeux de mots (ex: Uzumarking, Jean Bon)
Prénom sans nom (sauf exception rare)
Être enfant de Kage ou personnage légendaire
Venir d'une dimension parallèle ou d'un lieu inexistant sur la carte
Ancien membre d'organisation rang S (Akatsuki, etc.)
Nukenin/espion de haut niveau dès le début
Artefacts mythiques hors temporalité
Maîtrise de nature de chakra supérieure au rang (un Genin ne connaît pas l'Izanagi)
Secrets d'État ou localisation de repaires
Connaissances sur les Biju/Jinchuriki
Senjutsu/Mode Ermite interdit au départ
Kinjutsu dès la création
Jutsu Hiden de clans dont on n'est pas issu
Techniques "uniques" non validées
Powergaming : "plus fort que les autres", "prodige", "maîtrise plusieurs natures de chakra"

OBJECTIFS REFUSÉS (trop bateau/puissants) :
"Devenir fort/le plus fort", "Devenir Hokage/Kage", rejoindre l'ANBU, venger un personnage fictif, rechercher un père inconnu sans développement, "faire des missions", "progresser en tant que shinobi"

CE QU'ON ATTEND :
Objectifs créatifs à court/moyen/long terme
Cohérence histoire/caractère/objectifs
Respect du lore
Implication des autres joueurs
Originalité

CANDIDATURE DU JOUEUR :
Prénom/Nom : ${formData.charFirst} ${formData.charLast}
Village : ${formData.village}
Âge réel : ${formData.age} ans
Motivation à rejoindre : ${formData.motivation}
Expérience RP : ${formData.experience}
Histoire du personnage : ${formData.charHistory}
Objectifs : ${formData.charGoals}
Caractère : ${formData.charPersonality}

TON RÔLE :
1. Commence par accueillir le candidat chaleureusement mais professionnellement
2. Pose UNE question à la fois, basée sur sa candidature (points flous, incohérences, approfondissements)
3. Après exactement ${MAX_QUESTIONS} questions/réponses, dis "C'est la dernière question." puis pose-la
4. Après la dernière réponse, produis le verdict FINAL dans ce format JSON exact (et rien d'autre après) :

VERDICT_JSON:{"decision":"accepté" ou "refusé","raison":"résumé court en 1-2 phrases","points_positifs":["point1","point2","point3"],"points_negatifs":["point1","point2"],"scores":{"coherence":X,"originalite":X,"lore":X,"objectifs":X,"rp_quality":X},"conseil":"conseil final personnalisé"}

Les scores vont de 0 à 100.

IMPORTANT :
- Sois en français, ton professionnel mais humain
- Ne pose qu'UNE seule question par message
- Repère les red flags dans la candidature et questionne-les
- Si tu détectes un nom troll, une filiation abusive ou du powergaming, signale-le pendant l'oral
- Ne révèle pas ton verdict avant la fin`;
}

// ──────────────────────────────────────────────
// CHAT
// ──────────────────────────────────────────────
function initChat() {
  messages = [];
  questionCount = 0;
  oralEnded = false;
  document.getElementById('chatMessages').innerHTML = '';
  updateQuestionsLeft();
  startOral();
}

async function startOral() {
  setInputState(false);
  showTyping();

  const sysPrompt = buildSystemPrompt();
  const firstMsg = "Bonjour, je suis prêt. Lance l'entretien.";
  messages.push({ role: 'user', content: firstMsg });

  const reply = await callGemini(sysPrompt, messages);
  hideTyping();

  if (reply) {
    messages.push({ role: 'model', content: reply });
    appendMsg('ai', reply);
    questionCount++;
    updateQuestionsLeft();
    setInputState(true);
  }
}

async function sendMessage() {
  if (waitingForAI || oralEnded) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  autoResize(input);
  appendMsg('user', text);
  messages.push({ role: 'user', content: text });
  setInputState(false);
  showTyping();

  const sysPrompt = buildSystemPrompt();
  const reply = await callGemini(sysPrompt, messages);
  hideTyping();

  if (reply) {
    if (reply.includes('VERDICT_JSON:')) {
      oralEnded = true;
      const parts = reply.split('VERDICT_JSON:');
      const beforeVerdict = parts[0].trim();
      if (beforeVerdict) {
        messages.push({ role: 'model', content: beforeVerdict });
        appendMsg('ai', beforeVerdict);
      }
      try {
        const jsonStr = parts[1].trim();
        const verdict = JSON.parse(jsonStr);
        setTimeout(() => displayResult(verdict), 1200);
      } catch (e) {
        console.error('Parse verdict error', e, parts[1]);
        appendMsg('ai', '⚠️ Erreur lors du traitement du verdict. Veuillez relancer la simulation.');
      }
    } else {
      messages.push({ role: 'model', content: reply });
      appendMsg('ai', reply);
      questionCount++;
      updateQuestionsLeft();
      setInputState(!oralEnded);
    }
  }
}

// ──────────────────────────────────────────────
// DEEPSEEK API
// ──────────────────────────────────────────────
async function callGemini(systemPrompt, msgs) {
  waitingForAI = true;
  try {
    const payload = {
      model: 'deepseek-chat',
      temperature: 0.8,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...msgs.map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.content
        }))
      ]
    };

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.error) {
      appendMsg('ai', `❌ Erreur API DeepSeek : ${data.error.message}`);
      return null;
    }

    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    appendMsg('ai', '❌ Erreur réseau. Vérifie ta connexion et ta clé API DeepSeek.');
    return null;
  } finally {
    waitingForAI = false;
  }
}

// ──────────────────────────────────────────────
// CHAT UI
// ──────────────────────────────────────────────
function appendMsg(role, text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'ai' ? 'ZK' : '⚡';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const name = document.createElement('div');
  name.className = 'msg-name';
  name.textContent = role === 'ai' ? 'Recruteur Zenkai' : 'Toi';

  const content = document.createElement('div');
  content.textContent = text;

  bubble.appendChild(name);
  bubble.appendChild(content);
  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

let typingEl = null;
function showTyping() {
  const container = document.getElementById('chatMessages');
  typingEl = document.createElement('div');
  typingEl.className = 'msg ai';
  typingEl.id = 'typingIndicator';
  typingEl.innerHTML = `
    <div class="msg-avatar">ZK</div>
    <div class="msg-bubble">
      <div class="msg-name">Recruteur Zenkai</div>
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(typingEl);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function setInputState(enabled) {
  document.getElementById('chatInput').disabled = !enabled;
  document.getElementById('sendBtn').disabled = !enabled;
  if (enabled) document.getElementById('chatInput').focus();
}

function updateQuestionsLeft() {
  const el = document.getElementById('questionsLeft');
  const remaining = MAX_QUESTIONS - questionCount;
  if (remaining > 0 && questionCount > 0) {
    el.textContent = `Question ${questionCount} / ${MAX_QUESTIONS}`;
  } else {
    el.textContent = '';
  }
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// ──────────────────────────────────────────────
// RESULT
// ──────────────────────────────────────────────
function displayResult(verdict) {
  document.getElementById('step3').classList.remove('visible');
  document.getElementById('resultCard').classList.add('visible');
  document.getElementById('seal3').className = 'step-seal done';
  document.getElementById('label3').className = 'step-label done';

  const accepted = verdict.decision === 'accepté';
  const scores = verdict.scores || {};

  const getClass = (v) => v >= 70 ? 'high' : v >= 40 ? 'mid' : 'low';

  const positifs = (verdict.points_positifs || []).map(p =>
    `<div class="feedback-item good"><div class="dot"></div><div>${p}</div></div>`
  ).join('');

  const negatifs = (verdict.points_negatifs || []).map(p =>
    `<div class="feedback-item bad"><div class="dot"></div><div>${p}</div></div>`
  ).join('');

  const conseil = verdict.conseil ?
    `<div class="feedback-item neutral"><div class="dot"></div><div>${verdict.conseil}</div></div>` : '';

  const scoreRows = [
    { label: 'Cohérence', key: 'coherence' },
    { label: 'Originalité', key: 'originalite' },
    { label: 'Respect du lore', key: 'lore' },
    { label: 'Objectifs', key: 'objectifs' },
    { label: 'Qualité RP', key: 'rp_quality' },
  ].map(({ label, key }) => {
    const val = scores[key] || 0;
    return `<div class="score-row">
      <label>${label}</label>
      <div class="score-track"><div class="score-fill ${getClass(val)}" style="width:0%" data-target="${val}%"></div></div>
      <div class="score-val">${val}%</div>
    </div>`;
  }).join('');

  document.getElementById('resultContent').innerHTML = `
    <div class="result-icon ${accepted ? 'accepted' : 'refused'}">${accepted ? '✅' : '❌'}</div>
    <div class="result-title ${accepted ? 'accepted' : 'refused'}">
      Candidature ${accepted ? 'Acceptée' : 'Refusée'}
    </div>
    <div class="result-summary">${verdict.raison || ''}</div>

    <div class="score-bar">
      <h3>📊 Scores par critère</h3>
      ${scoreRows}
    </div>

    <div class="result-feedback">
      <h3>✅ Points positifs</h3>
      ${positifs || '<div class="feedback-item neutral"><div class="dot"></div><div>Aucun point positif notable.</div></div>'}
    </div>

    ${negatifs ? `<div class="result-feedback">
      <h3>❌ Points à améliorer</h3>
      ${negatifs}
    </div>` : ''}

    ${conseil ? `<div class="result-feedback">
      <h3>💡 Conseil du recruteur</h3>
      ${conseil}
    </div>` : ''}

    <button class="btn-restart" onclick="restart()">↩ Recommencer</button>
  `;

  window.scrollTo({ top: 0, behavior: 'smooth' });

  setTimeout(() => {
    document.querySelectorAll('.score-fill').forEach(el => {
      el.style.width = el.dataset.target;
    });
  }, 300);
}

function restart() {
  formData = {};
  messages = [];
  questionCount = 0;
  oralEnded = false;
  waitingForAI = false;

  ['dob', 'motivation', 'experience', 'charFirst', 'charLast', 'charHistory', 'charGoals', 'charPersonality', 'visual', 'chatInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('village').value = '';
  ['c1', 'c2', 'c3', 'c4', 'c5'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0/' + (id === 'c3' ? 200 : id === 'c5' ? 100 : 150) + ' min';
  });
  document.getElementById('ageBadge').className = 'age-badge';
  document.getElementById('chatMessages').innerHTML = '';

  document.getElementById('resultCard').classList.remove('visible');

  document.getElementById('progressBar').style.display = 'none';
  document.getElementById('introCard').style.display = 'block';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ──────────────────────────────────────────────
// BOOT — relit la clé API stockée localement si elle existe déjà
// ──────────────────────────────────────────────
window.onload = () => {
  const stored = ApiKeyStore.get();
  if (stored) {
    apiKey = stored;
    document.getElementById('apiKeyInput').value = stored;
  } else {
    document.getElementById('apiSetup').classList.add('visible');
  }
};
