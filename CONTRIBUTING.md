# Contribuer au projet

## Workflow Git (GitHub Flow simplifié)

- `main` : toujours déployable (protégée : PR obligatoire, CI verte requise).
- `develop` : intégration des fonctionnalités du sprint en cours.
- Branches de travail : `feature/<ticket>-<sujet>`, `fix/<ticket>-<sujet>`, `docs/<sujet>`.
- Une fonctionnalité = une branche = une Pull Request relue avant fusion.
- Versions : tags sémantiques `vMAJEUR.MINEUR.CORRECTIF` (un tag déclenche le déploiement en production après validation).

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
