# Compétence 1 — Environnement de travail

## Choix techniques et justifications

| Besoin | Choix | Justification |
|---|---|---|
| Langage / runtime | **Node.js 22 LTS** (JavaScript, modules ES) | Un seul langage côté serveur et navigateur, écosystème riche, support à long terme, démarrage rapide. Le lanceur de tests intégré (`node:test`) évite une dépendance. |
| Framework web | **Express 4** | Minimaliste et très documenté : l'architecture en couches reste visible (pas de « magie » de framework). |
| Base relationnelle | **PostgreSQL 16** | Contrainte d'exclusion (`EXCLUDE USING gist`) pour interdire les chevauchements de créneaux, types `tstzrange`, énumérations. |
| Base NoSQL | **MongoDB 7** | Journal d'audit : volume croissant, documents à structure variable, index TTL, pas de jointure. |
| Interface | **Vue 3** (Composition API, `<script setup>`) + **Vue Router** + **Vite** | Framework réactif léger et lisible : composants réutilisables (champs, boîtes de dialogue, calendrier), routage officiel avec gardes de rôle, échappement automatique du HTML dans les gabarits (protection XSS), chargement à la demande de chaque page (≈ 45 Ko transférés en gzip au premier affichage). Aucune police externe. |
| Validation des saisies | **zod** | Schémas déclaratifs, messages d'erreur clairs, refus des champs inconnus. |
| Mots de passe | **bcryptjs** (coût 12) | Hachage lent et salé ; implémentation JavaScript pure, sans compilation native (portable sous Windows). |
| Qualité | **ESLint** | Détecte les erreurs courantes et interdit `eval` / `new Function`. |
| Versions | **Git + GitHub** | Historique, revues de code par Pull Request, CI intégrée. |
| Conteneurs | **Docker + Docker Compose** | Environnement identique chez tous les développeurs et en production ; bases et Mailhog démarrés en une commande. |
| IDE | Visual Studio Code (ESLint, Docker, PostgreSQL) | Intégration native de Git et de Docker, débogueur Node. |
| Emails de test | **Mailhog** | Capture tous les emails en développement sans rien envoyer. |

## Gestionnaire de dépendances

`npm` avec fichier `package-lock.json` versionné : installation reproductible (`npm ci`) et audit de sécurité (`npm audit`, exécuté en CI). Dépendances de production et de développement séparées ; l'image Docker n'embarque que les premières.

## Installation pas à pas (poste de développement Windows, macOS ou Linux)

Prérequis : Node.js 22+, Git, Docker Desktop.

```bash
git clone https://github.com/ARTHURGMD63/TitreB3.git
cd TitreB3
npm install
cp .env.example .env          # variables locales (jamais committées)
docker compose up -d          # PostgreSQL, MongoDB, Mailhog
npm run db:init               # migrations + création du compte applicatif à droits limités
npm run db:seed               # comptes et ressources de démonstration
npm run build                 # construit l'interface Vue dans client/dist
npm run dev                   # serveur Express (API + interface construite) : http://localhost:3000

# Optionnel, pour développer l'interface avec rechargement à chaud (dans un 2e terminal) :
npm run dev:client            # Vite : http://localhost:5173 (relaie /api vers le port 3000)
```

Comptes de démonstration (mot de passe `SEED_PASSWORD`, par défaut `Demo-Passw0rd!`) :

| Email | Rôle |
|---|---|
| `admin@exemple.local` | Administrateur |
| `responsable.av@exemple.local` | Responsable du matériel audiovisuel |
| `responsable.sport@exemple.local` | Responsable du gymnase |
| `prof@exemple.local` | Utilisateur, profil enseignant |
| `eleve@exemple.local` | Utilisateur, profil élève |

Interface des emails : <http://localhost:8025>.

## Configuration

Toute la configuration passe par des variables d'environnement (principe des 12 facteurs), documentées dans `.env.example`. `src/config.js` refuse de démarrer en production avec un `JWT_SECRET` absent ou trop court.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur Express avec rechargement (sert `client/dist`, donc lancer `npm run build` avant) |
| `npm run dev:client` | Interface Vue avec rechargement à chaud (Vite, port 5173) |
| `npm run build` | Construit l'interface pour la production (`client/dist`) |
| `npm run lint` | Analyse statique |
| `npm test` | Tous les tests (nécessite PostgreSQL et MongoDB) |
| `npm run test:unit` | Tests unitaires seuls (aucune base requise) |
| `docker compose --profile full up --build` | Toute la pile dans Docker |
