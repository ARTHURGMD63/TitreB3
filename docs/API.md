# Référence de l'API

Base : `/api`. Format JSON. Authentification par cookie `token` (HttpOnly) posé à la connexion. Toute requête **modifiante** (POST, PUT, PATCH, DELETE) doit envoyer l'en-tête `X-CSRF-Token` dont la valeur est celle du cookie `csrf_token` (obtenu via `GET /api/csrf`).

Erreurs : `{ "erreur": "message", ... }` avec les codes `400` (saisie invalide, avec `details`), `401` (non connecté), `403` (droits ou CSRF), `404`, `409` (conflit), `423` (compte verrouillé), `429` (trop de requêtes).

## Authentification et profil

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/csrf` | public | Émet le jeton CSRF |
| POST | `/auth/register` | public | `{ email, mot_de_passe, prenom, nom }` → 201 |
| POST | `/auth/login` | public | `{ email, mot_de_passe }` → cookie de session |
| POST | `/auth/logout` | connecté | Termine la session |
| POST | `/auth/forgot-password` | public | `{ email }` → réponse identique dans tous les cas |
| POST | `/auth/reset-password` | public | `{ token, mot_de_passe }` |
| GET | `/me` | connecté | Utilisateur courant |
| GET | `/me/quota` | connecté | Quota restant |
| GET | `/me/notifications` · POST `/me/notifications/lues` | connecté | Notifications internes |
| GET | `/me/export` | connecté | Export RGPD (JSON) |
| DELETE | `/me` | connecté | Suppression (anonymisation) du compte |

## Ressources

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/ressources?type=&capacite_min=&date=AAAA-MM-JJ&q=` | connecté | Catalogue filtré (indique `disponible_ce_jour`) |
| GET | `/ressources/:id` | connecté | Fiche |
| GET | `/ressources/:id/occupation?du=&au=` | connecté | Créneaux pris (ISO 8601), sans identité |
| POST | `/ressources` · PUT `/ressources/:id` | admin | Création / modification |
| PATCH | `/ressources/:id/activation` | admin | `{ active, motif }` (maintenance) |

## Réservations

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `/reservations` | connecté | `{ ressource_id, debut, fin, motif }` → 201, ou 409 avec `alternatives` |
| GET | `/reservations/mes?periode=avenir\|passe\|tous` | connecté | Mes réservations |
| PUT | `/reservations/:id` | propriétaire | Modifier (≥ 24 h avant le début) |
| POST | `/reservations/:id/annuler` | propriétaire, responsable de la ressource, admin | Annuler |
| GET | `/reservations/a-traiter` | responsable, admin | Demandes en attente |
| GET | `/reservations/planning?du=&au=` | responsable, admin | Planning de ses ressources |
| POST | `/reservations/:id/decision` | responsable de la ressource, admin | `{ decision: "validee"\|"refusee", motif }` |

## Administration (rôle `admin`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/utilisateurs` · PATCH `/admin/utilisateurs/:id` | Comptes : `{ role, profil_quota_id, actif }` |
| GET | `/admin/responsables` | Responsables possibles |
| GET | `/admin/profils-quota` · PATCH `/admin/profils-quota/:id` | Quotas |
| GET | `/admin/stats?du=AAAA-MM-JJ&au=AAAA-MM-JJ` | Statistiques (au exclu) |
| GET | `/admin/audit?acteur_id=&action=&entite=&du=&au=&page=` | Journal d'audit (MongoDB) |

`GET /api/health` : `{ "statut": "ok" }` (supervision).
