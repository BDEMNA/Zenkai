// ════════════════════════════════════════════════════
// QUIZ — Zenkai Whitelist Trainer
// ════════════════════════════════════════════════════

// Définition des catégories disponibles.
// `file` = chemin du JSON. `sub` = sous-filtres optionnels (ex: village pour le RPK).
const CATEGORIES = [
  {
    id: 'lore-suna',
    emoji: '📜',
    label: 'Lore — Suna',
    desc: "Chronologie des Kazekage, clan Sabaku, la Lance, Demna Thot.",
    files: ['data/questions-lore-suna.json']
  },
  {
    id: 'rpk',
    emoji: '⚔️',
    label: 'RPK par lieu',
    desc: "Zones RPK, grades éligibles, immunités. Filtrable par village.",
    files: ['data/questions-rpk-suna.json', 'data/questions-rpk-konoha.json', 'data/questions-rpk-ame.json'],
    sub: [
      { id: 'suna', label: 'Suna', file: 'data/questions-rpk-suna.json' },
      { id: 'konoha', label: 'Konoha', file: 'data/questions-rpk-konoha.json' },
      { id: 'ame', label: 'Ame', file: 'data/questions-rpk-ame.json' }
    ]
  },
  {
    id: 'hrp-rp',
    emoji: '📋',
    label: 'Règles HRP / RP',
    desc: "Fairplay, metagaming, NLR, Fear RP, masques, commandes.",
    files: ['data/questions-hrp-rp.json']
  },
  {
    id: 'clans-diplo',
    emoji: '🏯',
    label: 'Clans & Diplomatie',
    desc: "Candidature, obligations du chef, perte de slot, traités.",
    files: ['data/questions-clans-diplomatie.json']
  }
];

// ── STATE ──
let selectedCategories = new Set();
let selectedVillages = new Set(['suna', 'konoha', 'ame']); // sous-filtre RPK, tout activé par défaut
let quizQuestions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let userAnswers = []; // { question, selectedLabel, correct }

// ── INIT : construire la grille de catégories ──
function renderCategoryGrid() {
  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = CATEGORIES.map(cat => `
    <label class="chip" id="chip-${cat.id}" onclick="event.target.tagName !== 'INPUT' && toggleCategoryByClick('${cat.id}')">
      <input type="checkbox" id="cb-${cat.id}" onchange="toggleCategory('${cat.id}')" />
      <div class="chip-emoji">${cat.emoji}</div>
      <div class="chip-text">
        <strong>${cat.label}</strong>
        <span>${cat.desc}</span>
        ${cat.sub ? `<div class="chip-sub" id="sub-${cat.id}">
          ${cat.sub.map(s => `<span class="chip-sub-pill selected" id="pill-${cat.id}-${s.id}" onclick="event.stopPropagation(); toggleVillage('${s.id}')">${s.label}</span>`).join('')}
        </div>` : ''}
      </div>
    </label>
  `).join('');
}

function toggleCategoryByClick(catId) {
  const cb = document.getElementById('cb-' + catId);
  cb.checked = !cb.checked;
  toggleCategory(catId);
}

function toggleCategory(catId) {
  const cb = document.getElementById('cb-' + catId);
  const chip = document.getElementById('chip-' + catId);
  if (cb.checked) {
    selectedCategories.add(catId);
    chip.classList.add('selected');
  } else {
    selectedCategories.delete(catId);
    chip.classList.remove('selected');
  }
  updateStartButton();
}

function toggleVillage(villageId) {
  const pill = document.getElementById('pill-rpk-' + villageId);
  if (selectedVillages.has(villageId)) {
    selectedVillages.delete(villageId);
    pill.classList.remove('selected');
  } else {
    selectedVillages.add(villageId);
    pill.classList.add('selected');
  }
  updateStartButton();
}

function onTypeToggle() {
  const qcm = document.getElementById('typeQcm').checked;
  const vf = document.getElementById('typeVf').checked;
  document.getElementById('chipQcm').classList.toggle('selected', qcm);
  document.getElementById('chipVf').classList.toggle('selected', vf);
  updateStartButton();
}

function onCountChange() {
  const val = document.getElementById('qCount').value;
  document.getElementById('qCountVal').textContent = val;
  document.getElementById('qCountHint').textContent =
    `${val} questions seront tirées au hasard parmi les catégories sélectionnées.`;
}

function updateStartButton() {
  const hasCategory = selectedCategories.size > 0;
  const hasType = document.getElementById('typeQcm').checked || document.getElementById('typeVf').checked;
  const rpkOk = !selectedCategories.has('rpk') || selectedVillages.size > 0;
  document.getElementById('startBtn').disabled = !(hasCategory && hasType && rpkOk);
}

// ── LANCEMENT DU QUIZ ──
async function startQuiz() {
  const startBtn = document.getElementById('startBtn');
  startBtn.disabled = true;
  startBtn.textContent = 'Chargement…';

  // Construire la liste des fichiers à charger selon la sélection
  const filesToLoad = new Set();
  CATEGORIES.forEach(cat => {
    if (!selectedCategories.has(cat.id)) return;
    if (cat.id === 'rpk') {
      cat.sub.forEach(s => { if (selectedVillages.has(s.id)) filesToLoad.add(s.file); });
    } else {
      cat.files.forEach(f => filesToLoad.add(f));
    }
  });

  const allLoaded = await Promise.all([...filesToLoad].map(loadJSON));
  let pool = allLoaded.flat();

  // Filtrer par type sélectionné
  const allowQcm = document.getElementById('typeQcm').checked;
  const allowVf = document.getElementById('typeVf').checked;
  pool = pool.filter(q => (q.type === 'qcm' && allowQcm) || (q.type === 'vf' && allowVf));

  if (pool.length === 0) {
    alert('Aucune question disponible pour cette combinaison. Élargis ta sélection.');
    startBtn.disabled = false;
    startBtn.textContent = 'Lancer le quiz →';
    return;
  }

  const requested = parseInt(document.getElementById('qCount').value, 10);
  quizQuestions = pickRandom(pool, requested);
  currentIndex = 0;
  score = 0;
  userAnswers = [];

  document.getElementById('configCard').classList.remove('visible');
  document.getElementById('playCard').classList.add('visible');
  document.getElementById('quizScoreLabel').textContent = `Score : 0 / ${quizQuestions.length}`;

  renderQuestion();
}

// ── AFFICHAGE D'UNE QUESTION ──
function categoryLabelFor(qId) {
  if (qId.startsWith('lore-suna')) return '📜 Lore — Suna';
  if (qId.startsWith('rpk-suna')) return '⚔️ RPK — Suna';
  if (qId.startsWith('rpk-konoha')) return '⚔️ RPK — Konoha';
  if (qId.startsWith('rpk-ame')) return '⚔️ RPK — Ame';
  if (qId.startsWith('rpk-grade')) return '⚔️ RPK — Grades';
  if (qId.startsWith('hrprp')) return '📋 Règles HRP/RP';
  if (qId.startsWith('clans') || qId.startsWith('diplo')) return '🏯 Clans & Diplomatie';
  return 'Question';
}

function renderQuestion() {
  answered = false;
  const q = quizQuestions[currentIndex];
  const total = quizQuestions.length;

  document.getElementById('quizCatLabel').textContent = `Question ${currentIndex + 1} / ${total}`;
  document.getElementById('progressFill').style.width = `${(currentIndex / total) * 100}%`;
  document.getElementById('qTag').textContent = categoryLabelFor(q.id);
  document.getElementById('qText').textContent = q.question;

  const optionsContainer = document.getElementById('qOptions');
  optionsContainer.innerHTML = '';

  let options, correctIndex;
  if (q.type === 'vf') {
    options = ['Vrai', 'Faux'];
    correctIndex = q.answer === true ? 0 : 1;
  } else {
    options = q.options;
    correctIndex = q.answer;
  }

  const letters = ['A', 'B', 'C', 'D'];
  options.forEach((opt, i) => {
    const div = document.createElement('div');
    div.className = 'q-option';
    div.innerHTML = `<div class="q-option-letter">${letters[i]}</div><div>${opt}</div>`;
    div.onclick = () => selectAnswer(i, correctIndex, div);
    optionsContainer.appendChild(div);
  });

  document.getElementById('qExplain').classList.remove('visible');
  document.getElementById('qExplain').innerHTML = '';
  document.getElementById('nextBtn').disabled = true;
  document.getElementById('nextBtn').textContent = currentIndex === total - 1 ? 'Voir les résultats →' : 'Suivant →';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectAnswer(chosenIndex, correctIndex, el) {
  if (answered) return;
  answered = true;

  const q = quizQuestions[currentIndex];
  const isCorrect = chosenIndex === correctIndex;
  if (isCorrect) score++;

  const allOptions = document.querySelectorAll('#qOptions .q-option');
  allOptions.forEach((opt, i) => {
    opt.classList.add('locked');
    if (i === correctIndex) opt.classList.add('correct');
    else if (i === chosenIndex) opt.classList.add('wrong');
    else opt.classList.add('dimmed');
  });

  const explainBox = document.getElementById('qExplain');
  explainBox.innerHTML = `<strong>${isCorrect ? '✓ Bonne réponse.' : '✗ Réponse incorrecte.'}</strong> ${q.explanation || ''}`;
  explainBox.classList.add('visible');

  document.getElementById('quizScoreLabel').textContent = `Score : ${score} / ${quizQuestions.length}`;
  document.getElementById('nextBtn').disabled = false;

  userAnswers.push({
    question: q.question,
    correct: isCorrect,
    explanation: q.explanation || ''
  });
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex >= quizQuestions.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

// ── RÉSULTATS ──
function showResults() {
  document.getElementById('playCard').classList.remove('visible');
  document.getElementById('resultCard').classList.add('visible');

  const total = quizQuestions.length;
  const pct = Math.round((score / total) * 100);
  const passed = pct >= 70;

  const reviewHtml = userAnswers.map(a => `
    <div class="review-item ${a.correct ? 'ok' : 'ko'}">
      <div class="review-q">${a.correct ? '✓' : '✗'} ${a.question}</div>
      <div class="review-a">${a.explanation}</div>
    </div>
  `).join('');

  document.getElementById('resultContent').innerHTML = `
    <div class="result-icon">${passed ? '🎉' : '📖'}</div>
    <div class="result-title ${passed ? 'accepted' : 'refused'}">${score} / ${total} bonnes réponses (${pct}%)</div>
    <div class="result-summary">
      ${passed
        ? "Solide ! Tu maîtrises bien cette sélection. Continue à réviser les catégories moins fortes."
        : "Encore du travail sur cette sélection — relis les explications ci-dessous et retente le quiz."}
    </div>
    <div class="btn-row" style="justify-content:center; margin-bottom:8px;">
      <button class="btn-restart" onclick="restartQuiz()">↩ Nouveau quiz</button>
    </div>
    <div class="review-list">${reviewHtml}</div>
  `;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restartQuiz() {
  document.getElementById('resultCard').classList.remove('visible');
  document.getElementById('configCard').classList.add('visible');
  const startBtn = document.getElementById('startBtn');
  startBtn.textContent = 'Lancer le quiz →';
  updateStartButton();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── BOOT ──
window.onload = () => {
  renderCategoryGrid();
  updateStartButton();
};
