# Sécurité, RGPD et accessibilité (aspects transversaux)

## Sécurité applicative (OWASP Top 10)

| Risque | Mesure | Vérifié par |
|---|---|---|
| **A01 Contrôle d'accès défaillant** | Rôle relu en base à chaque requête ; contrôle de propriété (réservation = son auteur) ; responsable limité à ses ressources ; routes `admin` réservées | `tests/security` — Contrôle d'accès, IDOR |
| **A02 Défaillances cryptographiques** | bcrypt (coût 12) ; jetons de réinitialisation 256 bits stockés en SHA-256 ; HTTPS + HSTS en production ; cookie `Secure` | `api.test.js` (hash `$2…`), configuration Caddy |
| **A03 Injection** | Requêtes préparées ; filtres Mongo typés ; validation zod ; aucune concaténation | `tests/security` — Injection SQL / NoSQL |
| **A03 XSS** | Gabarits Vue qui échappent le HTML, `v-html` interdit (ESLint), CSP sans `unsafe-inline`, cookie HttpOnly | `tests/security` — XSS (dont analyse statique de `client/`) |
| **A04 Conception non sécurisée** | Double contrôle des conflits (application + base), verrou transactionnel du quota, moindre privilège sur la base | Tests de concurrence |
| **A05 Mauvaise configuration** | Helmet, `X-Powered-By` retiré, erreurs génériques, démarrage refusé sans secret fort, aucun port de base exposé | `tests/security` — En-têtes |
| **A06 Composants vulnérables** | `npm audit` et Trivy en CI, dépendances à jour | CI |
| **A07 Authentification** | Politique de mot de passe, verrouillage après 5 échecs, message neutre, délai constant (hash factice), expiration de session, révocation d'un compte désactivé | `api.test.js`, `tests/security` |
| **A08 Intégrité** | Image construite par la CI, tags de version, `npm ci` avec lockfile | CI / CD |
| **A09 Journalisation** | Journal d'audit MongoDB (connexions, échecs, actions sensibles, IP) | `api.test.js` — Journal d'audit |
| **A10 SSRF** | Aucune requête sortante pilotée par l'utilisateur ; l'URL de photo est seulement affichée par le navigateur, restreinte à `https://` ou `/img/` | `schemas.test.js` |
| **CSRF** | Cookie `SameSite=Strict` + jeton en double soumission + contrôle `Origin` | `tests/security` — CSRF |
| **Déni de service** | Limitation de débit, corps ≤ 50 Ko | Configuration `app.js` |

### Points d'attention connus (à traiter avant une exploitation réelle)

- L'inscription indique qu'un email est déjà utilisé (compromis d'ergonomie) ; la connexion et la réinitialisation, elles, ne divulguent rien.
- Pas d'authentification multifacteur (recommandée par l'ANSSI pour les comptes administrateurs).
- Pas de vérification de l'adresse email à l'inscription.
- Les limiteurs de débit sont en mémoire : avec plusieurs instances de l'application, utiliser un magasin partagé (Redis).
- Les sauvegardes et la supervision restent à mettre en place par l'exploitation.

## RGPD

| Exigence | Réponse |
|---|---|
| Base légale | Exécution du service demandé par l'utilisateur (réservation) |
| Minimisation | Email, nom, prénom uniquement |
| Durées de conservation | Journal d'audit : 365 jours (TTL) ; jeton de réinitialisation : 1 h ; compte supprimé : anonymisé immédiatement |
| Droit d'accès / portabilité | Export JSON en un clic (« Mon espace ») |
| Droit à l'effacement | Suppression de compte en un clic : anonymisation, effacement des notifications, retrait des IP du journal |
| Sécurité | Voir tableau ci-dessus |
| Traçabilité | Export et suppression journalisés |
| Registre des traitements | À rédiger avec le responsable de traitement de l'organisation (finalités, durées, destinataires) |

## Accessibilité (RGAA)

Détail et correspondance critère par critère : [04-maquettes.md](04-maquettes.md#accessibilité-rgaa-4). Points structurants : calendrier en vrai tableau HTML avec boutons natifs, états indiqués par du texte, annonces `aria-live`, focus géré à chaque changement de page, boîtes de dialogue natives, contrastes ≥ 5:1 (calculés), respect de `prefers-reduced-motion`.
