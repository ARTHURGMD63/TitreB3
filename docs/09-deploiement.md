# Compétence 10 — Déploiement et exploitation

Ce document est destiné à une personne qui n'a pas participé au développement : il suffit de le suivre pour déployer, vérifier, sauvegarder et revenir en arrière.

## 1. Environnements

| | Développement | Recette (préproduction) | Production |
|---|---|---|---|
| **But** | Coder, déboguer | Valider une version avant livraison avec des données réalistes | Service réel |
| **Lieu** | Poste du développeur | Serveur dédié (ou VM) distinct | Serveur de production |
| **Déclenchement** | `npm run dev` | Automatique à chaque fusion sur `main` (CD) | Tag `vX.Y.Z` + **validation manuelle** dans GitHub |
| **Fichier compose** | `docker-compose.yml` | `docker-compose.prod.yml` + `.env.recette` | `docker-compose.prod.yml` + `.env.prod` |
| **Image** | Construite en local | `ghcr.io/arthurgmd63/titreb3:main` | `ghcr.io/arthurgmd63/titreb3:X.Y.Z` (version figée) |
| **Données** | Jeu de démonstration (`db:seed`) | Copie anonymisée ou jeu de test | Données réelles ; jamais de seed |
| **Emails** | Mailhog (`localhost:8025`) | Mailhog (`--profile recette`) ou SMTP de test | SMTP réel |
| **HTTPS** | Non (localhost) | Oui (Caddy, Let's Encrypt) | Oui, HSTS |
| **Secrets** | `.env` local, valeurs factices | `.env.recette`, secrets propres à la recette | `.env.prod`, secrets distincts, accès restreint |
| **Ports exposés** | 3000 (app), 5432, 27017, 1025, 8025 | 80 et 443 uniquement | 80 et 443 uniquement |
| **Journaux** | Console | `docker compose logs` | `docker compose logs`, conservation à définir |
| **Variables clés** | `NODE_ENV=development` | `NODE_ENV=production`, `ENVIRONNEMENT=recette` | `NODE_ENV=production`, `ENVIRONNEMENT=prod` |

Règle : on ne déploie jamais en production une version qui n'est pas passée par la recette. Les secrets ne sont jamais partagés entre environnements.

## 2. Prérequis serveur (recette et production)

- Linux (Debian / Ubuntu LTS) à jour, accès SSH par clé uniquement, pare-feu n'autorisant que 22, 80, 443 ;
- Docker Engine et plugin Docker Compose installés ;
- Un nom de domaine dont l'enregistrement DNS (A / AAAA) pointe vers le serveur (nécessaire au certificat TLS) ;
- Un utilisateur de déploiement membre du groupe `docker`, dossier `/opt/reservation` ;
- Un serveur SMTP (en production).

## 3. Première installation

```bash
# 1. Sur le serveur
sudo mkdir -p /opt/reservation/deploy && cd /opt/reservation
# 2. Copier docker-compose.prod.yml et deploy/Caddyfile depuis le dépôt (git clone ou scp)
# 3. Créer le fichier d'environnement à partir du modèle
cp deploy/.env.prod.example .env.prod
chmod 600 .env.prod
# 4. Générer les secrets et les renseigner dans .env.prod
openssl rand -hex 32     # POSTGRES_ADMIN_PASSWORD
openssl rand -hex 32     # APP_DB_PASSWORD
openssl rand -hex 48     # JWT_SECRET
# 5. Se connecter au registre (si l'image est privée) puis démarrer
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <utilisateur> --password-stdin
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Au démarrage, dans l'ordre : PostgreSQL et MongoDB deviennent sains → le conteneur ponctuel `migrate` applique les migrations et configure le compte applicatif → l'application démarre → Caddy obtient le certificat HTTPS.

**Créer le premier administrateur** (aucun seed en production) : s'inscrire via l'interface, puis promouvoir le compte :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec postgres \
  psql -U postgres -d reservation -c "UPDATE utilisateurs SET role='admin' WHERE email='vous@exemple.fr';"
```

## 4. Mise à jour (déploiement d'une nouvelle version)

Automatique via GitHub Actions (voir [10-devops.md](10-devops.md)) ; manuellement :

```bash
cd /opt/reservation
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Les migrations s'appliquent automatiquement (une migration déjà appliquée est ignorée). Pendant la mise à jour de l'application, l'indisponibilité est de quelques secondes.

### Liste de vérification avant production (*go / no-go*)

- [ ] CI verte sur le commit à livrer (lint, tests, audit, image)
- [ ] Version validée en recette (parcours R-01 à R-09 de [08-plan-de-tests.md](08-plan-de-tests.md))
- [ ] Sauvegarde récente de PostgreSQL et MongoDB
- [ ] Migrations relues (aucune destruction de données sans plan)
- [ ] Procédure de retour arrière relue
- [ ] Tag `vX.Y.Z` créé, déploiement validé dans GitHub (environnement `production`)

## 5. Vérification après déploiement

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps            # tous les services « healthy » / migrate « Exited (0) »
curl -fsS https://reservation.exemple.fr/api/health                          # {"statut":"ok"}
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail 50 app
```

Puis connexion avec un compte test, ouverture du catalogue, création d'une réservation.

## 6. Retour arrière (*rollback*)

1. Repérer la dernière version saine (ex. `1.2.0`) dans les tags / paquets GitHub.
2. Modifier `APP_IMAGE` dans `.env.prod` : `ghcr.io/arthurgmd63/titreb3:1.2.0`.
3. `docker compose … pull && docker compose … up -d`.
4. Si une migration destructive a eu lieu : restaurer la sauvegarde (section 7). Les migrations du projet sont **additives** ; toute migration future doit rester compatible avec la version précédente de l'application (principe *expand / contract*).

## 7. Sauvegarde et restauration

Sauvegarde quotidienne recommandée (cron, conservation 14 jours, copie hors du serveur) :

```bash
# PostgreSQL
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U postgres -Fc reservation > sauvegarde-pg-$(date +%F).dump
# MongoDB (journal d'audit)
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T mongo \
  mongodump --archive --db reservation_audit > sauvegarde-mongo-$(date +%F).archive
```

Restauration :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_restore -U postgres -d reservation --clean --if-exists < sauvegarde-pg-AAAA-MM-JJ.dump
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T mongo \
  mongorestore --archive --drop < sauvegarde-mongo-AAAA-MM-JJ.archive
```

Tester une restauration sur la recette au moins une fois par trimestre. Les sauvegardes contiennent des données personnelles : chiffrées, accès restreint, durée de conservation limitée (RGPD).

## 8. Exploitation courante

| Tâche | Commande |
|---|---|
| Voir les journaux | `docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f app` |
| Redémarrer l'application | `… restart app` |
| Rotation du `JWT_SECRET` | Modifier `.env.prod`, `up -d` : toutes les sessions sont déconnectées |
| Changer le mot de passe du compte applicatif | Modifier `APP_DB_PASSWORD`, `up -d` (le conteneur `migrate` met à jour le rôle) |
| Purge du journal d'audit | Automatique (index TTL, `AUDIT_RETENTION_DAYS`) |
| Espace disque | `docker system df` ; `docker image prune -f` (fait à chaque déploiement) |

## 9. Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| L'application ne démarre pas, erreur `JWT_SECRET` | Secret absent ou < 32 caractères | Corriger `.env.prod` |
| `migrate` en échec | Mot de passe administrateur incorrect, PostgreSQL pas prêt | Lire `logs migrate`, vérifier `POSTGRES_ADMIN_PASSWORD` (attention : appliqué uniquement à la création du volume) |
| Pas de HTTPS | DNS non propagé ou ports 80 / 443 fermés | Vérifier le DNS et le pare-feu, `logs proxy` |
| Emails non reçus | SMTP mal configuré | `logs app` (message « Email non envoyé »), les notifications internes restent disponibles |
| Erreur 429 | Limitation de débit atteinte | Attendre 15 minutes ; en cas de reverse proxy supplémentaire, vérifier `TRUST_PROXY` |
| Compte verrouillé | 5 échecs de connexion | Attendre 15 min ou `UPDATE utilisateurs SET verrouille_jusqua = NULL, tentatives_echec = 0 WHERE email = '…'` |
