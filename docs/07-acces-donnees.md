# Compétence 8 — Composants d'accès aux données SQL et NoSQL

Tous les accès passent par `src/repositories/` (les services ne manipulent jamais de requête). Deux technologies sont utilisées, chacune pour ce qu'elle fait de mieux.

## SQL — PostgreSQL avec le pilote `pg`

`src/db/postgres.js` fournit un pool de connexions, la fonction `requete(texte, params)` et `transaction(fn)` (BEGIN / COMMIT / ROLLBACK automatiques).

### Requêtes préparées (protection contre l'injection SQL)

Toute valeur issue d'un utilisateur est transmise par paramètre (`$1`, `$2`…), jamais concaténée :

```js
// src/repositories/utilisateurRepo.js
export async function parEmail(email, client) {
  const { rows } = await requete('SELECT * FROM utilisateurs WHERE email = $1', [email], client);
  return rows[0];
}
```

Cas particuliers traités :

| Situation | Solution |
|---|---|
| Recherche `ILIKE` avec saisie libre | Les caractères `%`, `_` et `\` sont échappés avant d'être passés en paramètre (`ressourceRepo.lister`) ; la clause `WHERE` est construite avec des placeholders, jamais avec les valeurs |
| Identifiants dynamiques (nom de rôle dans `init-db.js`) | `client.escapeIdentifier()` / `escapeLiteral()`, valeurs issues de la configuration et non de l'utilisateur |
| Mise à jour partielle | `COALESCE($2, colonne)` : une seule requête fixe, pas de SQL assemblé |
| Types | Les paramètres sont castés (`$1::date`, `$3::timestamptz`) ; zod a déjà validé le format |

### Transactions et concurrence

La création d'une réservation (`reservationService.creer`) s'exécute dans une transaction :

1. `SELECT … FROM utilisateurs WHERE id = $1 FOR UPDATE` — sérialise les demandes d'un même utilisateur : son quota ne peut pas être dépassé par des requêtes parallèles ;
2. vérification du quota et du chevauchement (contrôle applicatif) ;
3. `INSERT` — la contrainte d'exclusion de PostgreSQL arbitre définitivement ; une violation (`23P01`) est convertie en réponse 409 avec alternatives.

### Requêtes d'agrégation (tableau de bord administrateur)

`src/repositories/statsRepo.js` regroupe des requêtes SQL d'agrégation :

| Indicateur | Techniques SQL |
|---|---|
| Taux d'occupation par ressource | `LEFT JOIN`, `SUM(EXTRACT(EPOCH …))`, `GROUP BY`, `NULLIF` pour éviter la division par zéro |
| Ressources les plus demandées | `COUNT`, `GROUP BY`, `ORDER BY … LIMIT` |
| Créneaux les plus saturés | `LATERAL generate_series` pour découper chaque réservation en heures, `EXTRACT(ISODOW …)`, fuseau horaire explicite |
| Annulations | `COUNT(*) FILTER (WHERE statut = 'annulee')` |
| Répartition par statut | `GROUP BY statut` |

La requête du catalogue calcule aussi la disponibilité d'une ressource à une date (sous-requête corrélée avec opérateur de chevauchement `&&` sur `tstzrange`).

## NoSQL — MongoDB avec le pilote officiel

### Pourquoi MongoDB pour le journal d'audit

- volume croissant (une ligne par action), jamais modifié, rarement relu : écriture rapide ;
- structure variable : le contenu de `avant` / `apres` diffère selon l'action ;
- aucune jointure nécessaire ;
- l'index **TTL** supprime automatiquement les événements anciens (obligation de conservation limitée du RGPD).

### Structure d'un document (`audit_logs`)

```json
{
  "date": "2026-10-14T14:26:57.435Z",
  "action": "RESERVATION_VALIDEE",
  "acteur_id": 3,
  "ip": "203.0.113.7",
  "cible": { "type": "reservation", "id": 42 },
  "avant": { "ressource_id": 5, "statut": "en_attente", "debut": "…", "fin": "…", "motif": "Atelier vidéo" },
  "apres": { "ressource_id": 5, "statut": "validee", "debut": "…", "fin": "…", "motif": "Atelier vidéo" }
}
```

### Index (`src/db/mongo.js`)

| Index | Usage |
|---|---|
| `{ acteur_id: 1, date: -1 }` | Historique d'une personne (export RGPD, filtre admin) |
| `{ action: 1, date: -1 }` | Recherche par type d'événement |
| `{ date: 1 }` avec `expireAfterSeconds` | Purge automatique après `AUDIT_RETENTION_DAYS` (365 j par défaut) |

### Sécurité des requêtes NoSQL

L'injection NoSQL consiste à envoyer un objet (`{"$ne": null}`) à la place d'une valeur. Trois protections :

1. **zod** refuse tout paramètre qui n'est pas du type attendu (`acteur_id[$ne]=1` → 400) ;
2. `auditRepo.rechercher` force les types (`Number(...)`, `String(...)`) avant de construire le filtre ;
3. le champ `action` est limité à `[A-Z_]{3,40}` et `entite` à une liste fermée.

Ces cas sont couverts par `tests/security` (« Injection NoSQL ») et `tests/unit/schemas.test.js`.

### Droits RGPD sur le journal

- `exporterPourActeur` : fournit les événements de la personne (droit d'accès) ;
- `pseudonymiserActeur` : retire l'adresse IP et marque les événements (droit à l'effacement) tout en conservant la traçabilité des actions ;
- l'écriture dans le journal ne bloque jamais le métier : `auditService.journaliser` capture les erreurs.
