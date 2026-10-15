# Compétence 9 — Plan de tests et résultats

## Stratégie

| Niveau | Objectif | Outils | Dépendances | Dossier |
|---|---|---|---|---|
| **Unitaires** | Vérifier les règles métier pures et la validation des saisies, en isolation | `node:test`, `node:assert` | Aucune (instantanés, millisecondes) | `tests/unit/` |
| **Intégration** | Vérifier l'API complète avec les vraies bases : couches, SQL, MongoDB, transactions, notifications | `node:test`, `supertest` | PostgreSQL + MongoDB | `tests/integration/` |
| **Fonctionnels** | Parcours utilisateur de bout en bout (inscription → réservation → validation → statistiques) | Idem (scénarios dans les tests d'intégration) + recette manuelle de l'interface | Idem | `tests/integration/`, section « Recette manuelle » |
| **Sécurité** | Injections, XSS, CSRF, jetons, contrôle d'accès, droits de la base | Idem + `npm audit` + Trivy | Idem | `tests/security/` |

Les tests tournent sur des bases **dédiées** (`reservation_test`, `reservation_audit_test`), recréées automatiquement : jamais sur les données de développement. Chaque test repart d'un jeu de données propre.

Exécution : `npm test` (ou `test:unit`, `test:integration`, `test:security`). La CI les exécute à chaque *push* et chaque *Pull Request*.

## Plan de tests détaillé

### Unitaires — règles métier et validation (33 tests)

| ID | Cas | Résultat attendu |
|---|---|---|
| U-01 | Heure locale d'été / d'hiver convertie en UTC | 09:00 Paris = 07:00 UTC (juin) / 08:00 UTC (janvier) |
| U-02 | Créneau valide dans les horaires | Accepté |
| U-03 | Fin avant début, créneau dans le passé, hors horaires, sur deux jours, non aligné 30 min, dates invalides | Refusé avec message explicite |
| U-04 | Alternatives proches, triées par proximité | 3 créneaux libres, aucun en conflit ni dans le passé |
| U-05 | Journée complète | Alternatives le(s) jour(s) suivant(s) |
| U-06 | Quota : limite atteinte, durée trop longue, durée exactement maximale, délai trop long | Refus / acceptation correcte aux bornes |
| U-07 | Workflow : transitions autorisées et interdites, états finaux | `refusee`, `terminee`, `annulee` ne mènent plus nulle part |
| U-08 | Statut initial selon ressource et demandeur | Libre → validée ; contrôlée → en attente ; responsable / admin → validée |
| U-09 | Mot de passe : trop court, sans majuscule, sans chiffre, trop long | Refusé |
| U-10 | Inscription : normalisation de l'email, champs inconnus ignorés | Pas de *mass assignment* |
| U-11 | Photo `javascript:`, `data:`, `http:` | Refusé |
| U-12 | Objets `$ne` / `$regex` dans les filtres | Refusé |

### Intégration et fonctionnels (41 tests)

| Domaine | Cas testés |
|---|---|
| Authentification | Inscription (profil par défaut, hash bcrypt), doublon, mot de passe faible, connexion / déconnexion, message neutre, verrouillage après 5 échecs puis déverrouillage, réinitialisation à usage unique, réponse identique que le compte existe ou non |
| Catalogue | Filtres type / capacité / texte, disponibilité à une date, création / modification / désactivation par l'admin, ressource masquée et non réservable, accès refusé aux non-admins |
| Conflits | Réservation libre confirmée, chevauchement refusé avec alternatives réservables, créneaux contigus acceptés, créneau libéré après annulation, **4 réservations simultanées → 1 seule réussit**, **la base refuse un chevauchement en contournant l'application**, créneaux invalides |
| Quotas | Limite élève (3), limites enseignant, durée maximale, délai maximal, quotas modifiés par l'admin, **demandes simultanées sans dépassement** |
| Workflow | Demande en attente + notification, validation, refus avec motif obligatoire, décision unique, responsable non propriétaire refusé, auto-validation responsable / admin, annulation par le responsable |
| Espace personnel | Modification > 24 h, retour en attente, refus < 24 h, conflit en modification, listes à venir / passées, occupation anonymisée |
| Tâches planifiées | Clôture des réservations passées, rappel unique |
| Administration | Gestion des comptes, protection contre l'auto-rétrogradation, statistiques d'occupation / demandes / saturation / annulations |
| Audit MongoDB | Connexion, réservation, validation, annulation avec avant / après ; échecs de connexion ; filtres ; accès réservé à l'admin |
| RGPD | Export complet sans hash, anonymisation à la suppression, IP retirées du journal |

### Sécurité (25 tests)

| Menace (OWASP) | Cas testés |
|---|---|
| A03 Injection SQL | Charges `' OR '1'='1`, `DROP TABLE`, `UNION SELECT`, `pg_sleep` sur connexion et recherche ; identifiants numériques piégés ; jokers LIKE ; la table existe toujours |
| A03 Injection NoSQL | `acteur_id[$ne]`, `action[$regex]`, objet à la place de l'email |
| A03 XSS | `<img onerror>` renvoyé en JSON non interprété ; CSP stricte (`script-src 'self'`, sans `unsafe-inline`) ; **analyse statique** : aucun `v-html`, `innerHTML`, `eval`, script ni style inline dans `client/` |
| A01 CSRF | Requête sans jeton, avec faux jeton, depuis une autre origine ; cookie `HttpOnly` + `SameSite=Strict` |
| A07 Authentification | Routes protégées sans session ; jeton falsifié, `alg=none`, expiré ; rôle du jeton ignoré (relu en base) ; compte désactivé révoqué immédiatement ; hash jamais exposé |
| A01 Contrôle d'accès | Escalade de privilèges à l'inscription (*mass assignment*), routes admin interdites, champs inconnus refusés, **IDOR** sur annulation / modification / décision |
| A05 Configuration | En-têtes de sécurité, `X-Powered-By` masqué, pas de trace d'erreur, corps trop volumineux refusé |
| A04 Conception | Compte applicatif sans droit `DROP`, `DELETE`, `TRUNCATE`, ni accès à `schema_migrations` |
| A06 Composants vulnérables | `npm audit` (CI), analyse Trivy de l'image (CI) |

## Résultats d'exécution

Exécution complète sur le poste de développement (Node.js 24, PostgreSQL 16, MongoDB 7 sous Docker) :

| Suite | Tests | Réussis | Échecs |
|---|---:|---:|---:|
| Unitaires | 33 | 33 | 0 |
| Intégration / fonctionnels | 41 | 41 | 0 |
| Sécurité | 25 | 25 | 0 |
| **Total** | **99** | **99** | **0** |

Couverture du code serveur (`node --test --experimental-test-coverage`) :

| Indicateur | Valeur |
|---|---:|
| Lignes | **97,4 %** |
| Branches | 88,1 % |
| Fonctions | 91,6 % |

Lignes non couvertes : envoi réel d'email (désactivé en test, vérifié manuellement avec Mailhog), limiteurs de débit (désactivés en test), arrêt du serveur, quelques branches d'erreur d'infrastructure.

Autres contrôles : `npm run lint` sans erreur ni avertissement ; `npm audit` : 0 vulnérabilité (une version vulnérable de `nodemailer` a été détectée par l'audit puis corrigée par la mise à jour en v10).

### Anomalie détectée par les tests puis corrigée

| Anomalie | Découverte par | Correction |
|---|---|---|
| Le test de quotas simultanés échouait (1 réservation au lieu de 3) | Intégration | Défaut d'isolation des tests : le quota modifié par un test précédent n'était pas réinitialisé. `tests/helpers.js` remet maintenant les profils à leurs valeurs initiales avant chaque test. |

## Recette manuelle de l'interface (parcours à dérouler en recette)

| # | Parcours | Résultat attendu |
|---|---|---|
| R-01 | Se connecter avec `prof@exemple.local` | Catalogue affiché, menu adapté au rôle |
| R-02 | Filtrer « Matériel », capacité ≥ 1 | Seules les ressources de type matériel |
| R-03 | Ouvrir une salle, cliquer deux cases libres | Date / début / fin du formulaire renseignés, sélection surlignée |
| R-04 | Réserver, puis réserver le même créneau avec un autre compte | Message de conflit + 3 créneaux proches ; un clic remplit le formulaire |
| R-05 | Réserver la caméra en tant qu'élève, valider en tant que `responsable.av@` | Statut « En attente » puis « Validée », notification reçue (Mailhog : <http://localhost:8025>) |
| R-06 | Refuser sans motif | Message d'erreur, rien n'est enregistré |
| R-07 | Parcours complet au clavier (Tab, Entrée, Échap dans les boîtes de dialogue) | Tout est atteignable, focus toujours visible |
| R-08 | Exporter puis supprimer son compte | Fichier JSON téléchargé ; connexion impossible ensuite |
| R-09 | Administration : changer un quota, désactiver une ressource | Effet immédiat sur les réservations suivantes |

Vérifications faites sur l'application lancée : connexion, catalogue, calendrier hebdomadaire et réservation par clics dans le navigateur ; pile de production complète (migrations, application, HTTPS) démarrée avec Docker Compose.
