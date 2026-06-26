# Zenkai Whitelist Trainer

Outil communautaire non-officiel pour s'entraîner à la whitelist du serveur RP Naruto **Zenkai Shinobi RP**.

Deux modes :
- **📚 Quiz de révision** — QCM + Vrai/Faux sur le lore, le règlement RPK, les règles HRP/RP et les clans. Catégories et nombre de questions personnalisables.
- **🎤 Simulateur d'entretien** — Formulaire de candidature (HRP + RP) suivi d'un oral mené par une IA (Gemini) qui joue le rôle d'un recruteur Zenkai et donne un verdict détaillé.

## ⚠️ Sécurité — à lire avant de déployer

Ce projet utilise l'API Gemini de deux façons **très différentes** :

| Usage | Où | Clé API exposée ? |
|---|---|---|
| Génération de la banque de questions du quiz | `tools/generate-questions.js`, exécuté **en local par toi** | Non — la clé reste dans ton `.env` local, jamais committé |
| Entretien IA en direct | `js/entretien.js`, exécuté **dans le navigateur du visiteur** | Oui, forcément — chaque visiteur doit entrer sa propre clé Gemini gratuite |

**Ne mets jamais ta clé API en dur dans le code source.** Le `.gitignore` de ce projet bloque déjà `.env` pour éviter toute fuite accidentelle. Si une clé a été collée par erreur dans un commit ou un chat, considère-la compromise et régénère-la immédiatement sur [Google AI Studio](https://aistudio.google.com/apikey).

Pour le simulateur d'entretien, chaque visiteur colle sa propre clé, stockée uniquement dans son `localStorage` — elle n'est jamais envoyée ailleurs qu'à l'API Google, et jamais visible par toi ni par les autres visiteurs.

## Structure du projet

```
zenkai-whitelist-trainer/
├── index.html              ← Hub : choix Quiz ou Entretien
├── quiz.html                ← Quiz QCM/VF
├── entretien.html           ← Simulateur d'entretien IA
├── css/style.css            ← Thème commun
├── js/
│   ├── shared.js             utilitaires communs (shuffle, fetch JSON, clé API)
│   ├── quiz.js                logique du quiz
│   └── entretien.js           logique du chat IA
├── data/
│   ├── questions-lore-suna.json
│   ├── questions-rpk-suna.json
│   ├── questions-rpk-konoha.json
│   ├── questions-rpk-ame.json
│   ├── questions-hrp-rp.json
│   └── questions-clans-diplomatie.json
└── tools/
    └── generate-questions.js  ← génère des questions via Gemini, LOCAL UNIQUEMENT
```

## Lancer le site en local

Aucun build nécessaire — c'est du HTML/CSS/JS statique. Deux options :

```bash
# Avec Python (déjà présent sur la plupart des systèmes)
python3 -m http.server 8000

# Ou avec l'extension VS Code "Live Server"
```

Puis ouvre `http://localhost:8000`.

## Déployer sur GitHub Pages

1. Pousse ce dossier sur un repo GitHub.
2. Repo → Settings → Pages → Source : branche `main`, dossier `/ (root)`.
3. Le site est disponible à `https://<ton-pseudo>.github.io/<nom-du-repo>/`.

Aucune clé API n'est nécessaire pour le déploiement — seul le quiz fonctionne sans configuration. L'entretien demandera une clé Gemini à chaque visiteur (la sienne, gratuite).

## Enrichir la banque de questions

```bash
npm install
cp .env.example .env
# édite .env et mets ta clé Gemini

node tools/generate-questions.js \
  chemin/vers/document_source.md \
  data/questions-hrp-rp.json \
  "Règles HRP/RP" \
  20
```

Le script génère 20 nouvelles questions à partir du `.md` fourni et les fusionne dans le JSON cible, sans écraser les questions existantes. **Relis toujours les questions générées avant de les committer** — vérifie que les "answer" correspondent vraiment à la bonne option et que les explications sont fidèles au document source.

## Roadmap

- [ ] Ajouter le lore narratif de Konoha et Ame (actuellement seul Suna a une chronologie complète — Konoha/Ame n'ont que les règles RPK)
- [ ] Migration vers PHP : déplacer l'appel Gemini de l'entretien côté serveur pour ne plus demander de clé aux visiteurs
- [ ] Persistance des scores (historique de progression par utilisateur)
