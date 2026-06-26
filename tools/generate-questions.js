/**
 * ════════════════════════════════════════════════════
 * GÉNÉRATEUR DE QUESTIONS — Zenkai Whitelist Trainer
 * ════════════════════════════════════════════════════
 *
 * À exécuter UNIQUEMENT EN LOCAL, jamais sur le serveur déployé.
 * Ce script lit un fichier .md source, demande à Gemini de générer
 * des questions de quiz, et les fusionne dans le fichier JSON cible
 * (sans doublons d'id, en ajoutant à l'existant).
 *
 * INSTALLATION (une seule fois) :
 *   npm init -y
 *   npm install node-fetch dotenv
 *
 * CONFIGURATION :
 *   1. Crée un fichier .env à la racine du projet (jamais committé !)
 *   2. Ajoute la ligne : GEMINI_API_KEY=ta_clé_ici
 *   3. Vérifie que .env est bien dans ton .gitignore
 *
 * UTILISATION :
 *   node tools/generate-questions.js <source.md> <cible.json> <categorie> <nombre>
 *
 * EXEMPLE :
 *   node tools/generate-questions.js \
 *     ../1782407491347_regles_roleplay.md \
 *     ../data/questions-hrp-rp.json \
 *     "Règles HRP/RP" \
 *     20
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-1.5-flash';

if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY manquante. Crée un fichier .env avec GEMINI_API_KEY=ta_clé');
  process.exit(1);
}

const [, , sourceMdPath, targetJsonPath, categoryName, countArg] = process.argv;

if (!sourceMdPath || !targetJsonPath || !categoryName) {
  console.error(`
Usage : node tools/generate-questions.js <source.md> <cible.json> <categorie> [nombre=15]

Exemple :
  node tools/generate-questions.js ../regles_roleplay.md ../data/questions-hrp-rp.json "Règles HRP/RP" 20
`);
  process.exit(1);
}

const count = parseInt(countArg, 10) || 15;

const PROMPT_TEMPLATE = (sourceText, category, n) => `
Tu es un générateur de questions de quiz pour un site d'entraînement à la whitelist
d'un serveur de roleplay Naruto. Le contenu ci-dessous est la SEULE source de vérité —
n'invente AUCUNE information qui n'y figure pas explicitement.

CATÉGORIE : ${category}

DOCUMENT SOURCE :
"""
${sourceText}
"""

CONSIGNE :
Génère exactement ${n} questions de quiz au format JSON, dans un mélange de type "qcm"
(QCM à 4 choix) et "vf" (Vrai/Faux), en respectant strictement ce schéma pour chaque
question :

Pour un QCM :
{
  "id": "identifiant-court-unique-en-kebab-case",
  "type": "qcm",
  "question": "texte de la question",
  "options": ["option A", "option B", "option C", "option D"],
  "answer": 0,
  "explanation": "explication factuelle citant le document source, 1-3 phrases"
}

Pour un Vrai/Faux :
{
  "id": "identifiant-court-unique-en-kebab-case",
  "type": "vf",
  "question": "affirmation à évaluer comme vraie ou fausse",
  "answer": true,
  "explanation": "explication factuelle citant le document source, 1-3 phrases"
}

RÈGLES IMPORTANTES :
- "answer" pour un QCM est l'INDEX (0 à 3) de la bonne réponse dans "options"
- "answer" pour un Vrai/Faux est un booléen (true ou false)
- Les questions doivent couvrir des points variés du document, pas se répéter
- Privilégie les pièges réalistes (confusions fréquentes, exceptions, cas limites)
- Le français doit être correct et naturel
- Ne réponds QUE par un tableau JSON valide, sans markdown, sans texte avant/après,
  sans balises de code

Réponds uniquement avec le tableau JSON.
`;

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 8192 }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Erreur API Gemini : ${data.error.message}`);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Réponse vide de Gemini.');
  return text;
}

function extractJsonArray(rawText) {
  // Nettoie les éventuelles balises markdown ```json ... ```
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Tentative de récupération : isole le premier [ ... ] du texte
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw e;
  }
}

async function main() {
  const sourcePath = path.resolve(__dirname, sourceMdPath);
  const targetPath = path.resolve(__dirname, targetJsonPath);

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Fichier source introuvable : ${sourcePath}`);
    process.exit(1);
  }

  const sourceText = fs.readFileSync(sourcePath, 'utf-8');
  console.log(`📖 Source lue : ${sourcePath} (${sourceText.length} caractères)`);
  console.log(`🤖 Appel Gemini pour générer ${count} questions sur "${categoryName}"...`);

  const prompt = PROMPT_TEMPLATE(sourceText, categoryName, count);
  const rawResponse = await callGemini(prompt);
  const newQuestions = extractJsonArray(rawResponse);

  if (!Array.isArray(newQuestions)) {
    throw new Error('La réponse de Gemini ne contient pas un tableau JSON.');
  }

  console.log(`✅ ${newQuestions.length} questions générées.`);

  // Fusion avec le fichier existant (évite les doublons d'id)
  let existing = [];
  if (fs.existsSync(targetPath)) {
    existing = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
  }

  const existingIds = new Set(existing.map(q => q.id));
  const deduped = newQuestions.filter(q => {
    if (existingIds.has(q.id)) {
      console.warn(`⚠️  id en double ignoré : ${q.id}`);
      return false;
    }
    return true;
  });

  const merged = [...existing, ...deduped];
  fs.writeFileSync(targetPath, JSON.stringify(merged, null, 2), 'utf-8');

  console.log(`💾 Fichier mis à jour : ${targetPath}`);
  console.log(`   Total : ${merged.length} questions (${deduped.length} nouvelles, ${existing.length} existantes)`);
  console.log(`\n👉 Relis les questions générées avant de les committer — vérifie les "answer" et les explications.`);
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
