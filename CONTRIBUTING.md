# Contribuer au projet

## Workflow Git (GitHub Flow)

Un projet à une seule personne n'a pas besoin d'une branche d'intégration : on garde un flux simple et on s'y tient.

- **`main`** : toujours déployable. Protégée sur GitHub : on n'y pousse pas directement, tout passe par une Pull Request dont la CI est verte.
- **Branches de travail**, une par ticket, créées depuis `main` et supprimées après fusion :
  - `feature/<n°ticket>-<sujet>` pour une fonctionnalité (ex. `feature/20-audit-rgaa`) ;
  - `fix/<n°ticket>-<sujet>` pour une correction ;
  - `docs/<sujet>` pour la documentation.
- **Pull Request** : une par branche, avec `Closes #<n°>` dans la description (le ticket se ferme à la fusion), relue avant fusion. La CI (lint, build, audit, tests, image Docker) doit passer.
- **Fusion** : *squash and merge* pour garder un historique lisible sur `main`.

```
main ──●─────────────●─────────────●──────▶   (chaque point = une PR fusionnée)
        \           /               \
         feature/20-audit-rgaa       fix/31-quota
```

### Réglage de la protection de `main` (GitHub : Settings → Branches → Add rule, motif `main`)

- Require a pull request before merging ;
- Require status checks to pass : `Lint et audit des dépendances`, `Tests (unitaires, intégration, sécurité)`, `Build de l'image Docker` ;
- Do not allow bypassing the above settings.

## Versions et tags

Un **tag** repère un commit précis pour marquer une version livrée, au format sémantique `vMAJEUR.MINEUR.CORRECTIF` :

| Changement | Exemple |
|---|---|
| Correction sans changement de comportement | `v1.0.0` → `v1.0.1` |
| Nouvelle fonctionnalité compatible | `v1.0.1` → `v1.1.0` |
| Changement incompatible (API, base) | `v1.1.0` → `v2.0.0` |

```bash
git switch main && git pull
git tag -a v1.0.0 -m "Première version livrable"
git push origin v1.0.0
```

Pousser un tag déclenche le workflow `cd.yml` : publication de l'image Docker `ghcr.io/arthurgmd63/titreb3:1.0.0`, puis déploiement en production après validation manuelle (environnement GitHub `production`). Le retour arrière consiste à redéployer le tag précédent (voir [docs/09-deploiement.md](docs/09-deploiement.md)).

## Messages de commit (Conventional Commits, en français)

```
feat(reservation): vérifie le quota avant la création
fix(auth): corrige le verrouillage après 5 échecs
docs(deploiement): ajoute la procédure de retour arrière
test(securite): ajoute les tests CSRF
chore(ci): met à jour la version de Node
```

## Avant d'ouvrir une Pull Request

```bash
npm run lint
npm test
```

## Conventions de code

- Code et noms métier en français (cohérents avec le domaine), commentaires légers en français.
- Une couche = une responsabilité : la présentation ne touche pas à la base, la couche métier ne connaît pas Express.
- Jamais de concaténation de saisies dans une requête SQL ou Mongo.
- Aucun secret dans le dépôt (utiliser `.env`, ignoré par Git).
