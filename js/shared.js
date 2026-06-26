// ════════════════════════════════════════════════════
// SHARED UTILS — Zenkai Whitelist Trainer
// ════════════════════════════════════════════════════

/** Mélange un tableau (Fisher-Yates) sans muter l'original. */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tire `n` éléments aléatoires d'un tableau (sans doublon, sans dépasser sa taille). */
function pickRandom(arr, n) {
  return shuffleArray(arr).slice(0, Math.min(n, arr.length));
}

/** Charge un fichier JSON local et retourne le tableau parsé (ou [] en cas d'échec). */
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.error('Erreur de chargement', path, e);
    return [];
  }
}

/** Stocke/relit la clé API Gemini en localStorage (jamais committée, jamais envoyée ailleurs). */
const ApiKeyStore = {
  KEY: 'zenkai_gemini_api_key',
  get() { return localStorage.getItem(this.KEY) || ''; },
  set(val) { localStorage.setItem(this.KEY, val); },
  clear() { localStorage.removeItem(this.KEY); }
};
