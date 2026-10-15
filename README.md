# Plateforme de réservation de salles et de matériel

Application web de réservation (salles, laboratoires, gymnase, vidéoprojecteurs, ordinateurs, caméras) pour un lycée, une association ou une petite entreprise. Projet réalisé par **Arthur Gramond** dans le cadre du Titre Professionnel.

- **Trois profils** : utilisateur, responsable (valide les demandes), administrateur (comptes, ressources, quotas, statistiques, audit).
- **Cœur** : calendrier jour / semaine / mois, **aucun double booking** (contrôle applicatif + contrainte d'exclusion PostgreSQL), alternatives proposées, quotas par profil, workflow de validation, notifications, journal d'audit.
- **Stack** : Node.js 22 · Express · PostgreSQL 16 (données métier) · MongoDB 7 (journal d'audit) · interface **Vue 3** (Vite, Vue Router) · Docker · GitHub Actions.

## Démarrage rapide

Prérequis : Node.js 22+, Git, Docker Desktop.

```bash
git clone https://github.com/ARTHURGMD63/TitreB3.git
cd TitreB3
npm install
cp .env.example .env
docker compose up -d      # PostgreSQL, MongoDB, Mailhog
npm run db:init           # migrations
npm run db:seed           # données de démonstration
npm run build             # construit l'interface Vue (client/dist)
npm run dev               # http://localhost:3000
```

Comptes de démonstration (mot de passe `Demo-Passw0rd!`) : `admin@exemple.local`, `responsable.av@exemple.local`, `responsable.sport@exemple.local`, `prof@exemple.local`, `eleve@exemple.local`. Les emails envoyés sont visibles sur <http://localhost:8025> (Mailhog).

Tout lancer dans Docker, application comprise : `docker compose --profile full up --build`.

## Qualité et tests

```bash
npm run lint
npm test                  # 99 tests : unitaires, intégration, sécurité (bases requises)
npm run test:unit         # sans base de données
```

## Documentation

| Document | Contenu |
|---|---|
| [docs/00-competences.md](docs/00-competences.md) | **Tableau de couverture des 11 compétences** avec les preuves |
| [docs/01-environnement.md](docs/01-environnement.md) | Environnement de travail, choix techniques |
| [docs/02-gestion-projet.md](docs/02-gestion-projet.md) | Scrum, backlog, planning, risques |
| [docs/03-analyse-besoins.md](docs/03-analyse-besoins.md) | Cas d'utilisation, user stories, enchaînement des écrans |
| [docs/04-maquettes.md](docs/04-maquettes.md) | Maquettes, RGAA, éco-conception |
| [docs/05-architecture.md](docs/05-architecture.md) | Architecture multicouche, ANSSI, choix justifiés |
| [docs/06-base-de-donnees.md](docs/06-base-de-donnees.md) | MCD, MLD, MPD, droits, RGPD |
| [docs/07-acces-donnees.md](docs/07-acces-donnees.md) | Accès SQL et NoSQL sécurisés |
| [docs/08-plan-de-tests.md](docs/08-plan-de-tests.md) | Plan de tests et résultats |
| [docs/09-deploiement.md](docs/09-deploiement.md) | Environnements et procédure de déploiement |
| [docs/10-devops.md](docs/10-devops.md) | CI/CD, conteneurs, automatisation |
| [docs/11-securite-rgpd-rgaa.md](docs/11-securite-rgpd-rgaa.md) | Sécurité, RGPD, accessibilité |
| [docs/12-design-registre.md](docs/12-design-registre.md) | Design de l'interface (direction « Registre ») |
| [docs/API.md](docs/API.md) | Référence de l'API |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow Git et conventions |

## Périmètre

MVP complet (authentification, catalogue, calendrier, conflits, quotas, validation, audit MongoDB) **plus** notifications, espaces personnel / responsable / administrateur, statistiques, RGPD. Extension non réalisée : réservations récurrentes.
