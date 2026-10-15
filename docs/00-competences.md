# Couverture des 11 compétences du titre

Ce tableau relie chaque compétence aux preuves présentes dans le dépôt (code, documents, configuration).

## Bloc 1 — Développer une application sécurisée

| # | Compétence | Où la trouver | Preuves principales |
|---|---|---|---|
| 1 | Installer et configurer son environnement de travail | [01-environnement.md](01-environnement.md) | `package.json`, `docker-compose.yml`, `.env.example`, `eslint.config.js`, `.gitignore`, `CONTRIBUTING.md` |
| 2 | Développer des interfaces utilisateur (sécurisées, RGAA) | [04-maquettes.md](04-maquettes.md), [12-design-registre.md](12-design-registre.md), [11-securite-rgpd-rgaa.md](11-securite-rgpd-rgaa.md) | `client/` (Vue 3 : composants, vues, routeur), `CalendrierRessource.vue` (calendrier accessible), règle ESLint `vue/no-v-html` (anti-XSS), CSP dans `src/app.js` |
| 3 | Développer des composants métier | [05-architecture.md](05-architecture.md) | `src/services/` : `reservationService.js`, `regles/` (créneaux, quotas, workflow), tests unitaires `tests/unit/` |
| 4 | Contribuer à la gestion d'un projet informatique | [02-gestion-projet.md](02-gestion-projet.md) | Méthode Scrum, backlog, sprints, planning, `.github/` (templates PR et tickets), `CONTRIBUTING.md` |

## Bloc 2 — Concevoir et développer une application organisée en couches

| # | Compétence | Où la trouver | Preuves principales |
|---|---|---|---|
| 5 | Analyser les besoins et maquetter | [03-analyse-besoins.md](03-analyse-besoins.md), [04-maquettes.md](04-maquettes.md) | User stories avec critères d'acceptation, cas d'utilisation, enchaînement des écrans, maquettes, RGAA, éco-conception |
| 6 | Définir l'architecture logicielle | [05-architecture.md](05-architecture.md) | Architecture 3 couches `presentation / services / repositories`, conformité aux recommandations ANSSI, ADR des choix techniques |
| 7 | Concevoir une base de données relationnelle | [06-base-de-donnees.md](06-base-de-donnees.md) | MCD / MLD / MPD, `db/migrations/001_init.sql` (contraintes, contrainte d'exclusion), droits dans `scripts/init-db.js`, RGPD |
| 8 | Composants d'accès aux données SQL et NoSQL | [07-acces-donnees.md](07-acces-donnees.md) | `src/repositories/` (PostgreSQL, requêtes préparées), `auditRepo.js` (MongoDB), tests d'injection |

## Bloc 3 — Préparer le déploiement d'une application sécurisée

| # | Compétence | Où la trouver | Preuves principales |
|---|---|---|---|
| 9 | Préparer et exécuter les plans de tests | [08-plan-de-tests.md](08-plan-de-tests.md) | `tests/unit`, `tests/integration`, `tests/security` : 99 tests exécutés, 97 % de couverture de lignes |
| 10 | Préparer et documenter le déploiement | [09-deploiement.md](09-deploiement.md) | Environnements dev / recette / production, procédure pas à pas, retour arrière, exploitation |
| 11 | Mise en production dans une démarche DevOps | [10-devops.md](10-devops.md) | `.github/workflows/ci.yml` et `cd.yml`, `Dockerfile`, `docker-compose.prod.yml`, `deploy/` |

## Fonctionnalités du cahier des charges

| Fonctionnalité | Implémentation |
|---|---|
| 1. Authentification et comptes | bcrypt, JWT en cookie HttpOnly, verrouillage, réinitialisation par email — `src/services/authService.js` |
| 2. Catalogue des ressources | Filtres type / capacité / disponibilité, administration — `ressourceService.js`, `client/src/views/CatalogueView.vue` |
| 3. Calendrier et réservation | Vues jour / semaine / mois accessibles — `client/src/components/CalendrierRessource.vue` |
| 4. Gestion des conflits | Contrôle applicatif + contrainte d'exclusion PostgreSQL + alternatives proposées |
| 5. Quotas par profil | `regles/quotas.js`, profils éditables par l'administrateur |
| 6. Workflow de validation | `regles/workflow.js` : en attente → validée / refusée → terminée / annulée |
| 7. Notifications | Emails (Mailhog en développement) + notifications internes + rappel la veille |
| 8. Espace personnel | `client/src/views/MonEspaceView.vue` |
| 9. Tableaux de bord | Espace responsable, statistiques SQL d'agrégation — `statsRepo.js` |
| 10. Journal d'audit | MongoDB, index TTL de conservation — `auditRepo.js` |
| Extension non réalisée | Réservations récurrentes (hors MVP, voir backlog) |
