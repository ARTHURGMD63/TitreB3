// Accès aux données des réservations.
import { requete } from '../db/postgres.js';

const SELECT_DETAIL = `SELECT rs.id, rs.ressource_id, rs.utilisateur_id, rs.debut, rs.fin, rs.motif, rs.statut,
  rs.motif_decision, rs.decide_le, rs.cree_le, r.nom AS ressource_nom, r.type AS ressource_type,
  r.responsable_id, r.validation_requise, u.prenom || ' ' || u.nom AS demandeur_nom, u.email AS demandeur_email
  FROM reservations rs
  JOIN ressources r ON r.id = rs.ressource_id
  JOIN utilisateurs u ON u.id = rs.utilisateur_id`;

export async function parId(id, client) {
  const { rows } = await requete(`${SELECT_DETAIL} WHERE rs.id = $1`, [id], client);
  return rows[0];
}

// Réservations actives qui chevauchent [debut, fin[ (règle de conflit côté application).
export async function chevauchements(ressourceId, debut, fin, exclureId, client) {
  const { rows } = await requete(
    `SELECT id, debut, fin FROM reservations
     WHERE ressource_id = $1 AND statut IN ('en_attente', 'validee')
       AND periode && tstzrange($2::timestamptz, $3::timestamptz, '[)') AND id <> COALESCE($4, 0)`,
    [ressourceId, debut, fin, exclureId ?? null],
    client
  );
  return rows;
}

export async function creer({ ressourceId, utilisateurId, debut, fin, motif, statut }, client) {
  const { rows } = await requete(
    `INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, motif, statut)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [ressourceId, utilisateurId, debut, fin, motif, statut],
    client
  );
  return rows[0].id;
}

export const modifierCreneau = (id, { debut, fin, motif, statut }, client) =>
  requete(
    `UPDATE reservations SET debut = $2, fin = $3, motif = $4, statut = $5,
       motif_decision = NULL, decide_par = NULL, decide_le = NULL, rappel_envoye = FALSE WHERE id = $1`,
    [id, debut, fin, motif, statut],
    client
  );

export const changerStatut = (id, statut, { decidePar = null, motifDecision = null } = {}, client) =>
  requete(
    `UPDATE reservations SET statut = $2, decide_par = $3, motif_decision = $4,
       decide_le = CASE WHEN $3::int IS NULL THEN decide_le ELSE now() END WHERE id = $1`,
    [id, statut, decidePar, motifDecision],
    client
  );

export async function compterActives(utilisateurId, client) {
  const { rows } = await requete(
    `SELECT count(*)::int AS n FROM reservations
     WHERE utilisateur_id = $1 AND statut IN ('en_attente', 'validee') AND fin > now()`,
    [utilisateurId],
    client
  );
  return rows[0].n;
}

export async function parUtilisateur(utilisateurId, periode) {
  const filtre =
    periode === 'avenir' ? 'AND rs.fin > now()' : periode === 'passe' ? 'AND rs.fin <= now()' : '';
  const ordre = periode === 'passe' ? 'DESC' : 'ASC';
  const { rows } = await requete(
    `${SELECT_DETAIL} WHERE rs.utilisateur_id = $1 ${filtre} ORDER BY rs.debut ${ordre} LIMIT 200`,
    [utilisateurId]
  );
  return rows;
}

// Demandes à traiter pour un responsable (toutes les ressources si admin).
export async function enAttentePourResponsable(utilisateurId, estAdmin) {
  const { rows } = await requete(
    `${SELECT_DETAIL} WHERE rs.statut = 'en_attente' AND rs.fin > now()
       AND ($2::boolean OR r.responsable_id = $1) ORDER BY rs.debut`,
    [utilisateurId, estAdmin]
  );
  return rows;
}

export async function planningResponsable(utilisateurId, estAdmin, du, au) {
  const { rows } = await requete(
    `${SELECT_DETAIL} WHERE rs.statut IN ('en_attente', 'validee') AND rs.debut < $4 AND rs.fin > $3
       AND ($2::boolean OR r.responsable_id = $1) ORDER BY rs.debut`,
    [utilisateurId, estAdmin, du, au]
  );
  return rows;
}

// Occupation d'une ressource : aucune donnée personnelle, seulement le créneau et un indicateur "à moi".
export async function occupation(ressourceId, du, au, utilisateurId) {
  const { rows } = await requete(
    `SELECT id, debut, fin, statut, (utilisateur_id = $4) AS a_moi FROM reservations
     WHERE ressource_id = $1 AND statut IN ('en_attente', 'validee') AND debut < $3 AND fin > $2 ORDER BY debut`,
    [ressourceId, du, au, utilisateurId]
  );
  return rows;
}

export async function terminerPassees() {
  const { rows } = await requete(
    `UPDATE reservations SET statut = 'terminee' WHERE statut = 'validee' AND fin < now() RETURNING id`
  );
  return rows.length;
}

// Rappels : réservations validées qui commencent dans les 24 prochaines heures.
export async function aRappeler() {
  const { rows } = await requete(
    `UPDATE reservations SET rappel_envoye = TRUE
     WHERE statut = 'validee' AND NOT rappel_envoye AND debut > now() AND debut <= now() + interval '24 hours'
     RETURNING id, utilisateur_id, ressource_id, debut`
  );
  return rows;
}

export async function exporterPourUtilisateur(utilisateurId) {
  const { rows } = await requete(
    `SELECT rs.id, r.nom AS ressource, rs.debut, rs.fin, rs.motif, rs.statut, rs.motif_decision, rs.cree_le
     FROM reservations rs JOIN ressources r ON r.id = rs.ressource_id
     WHERE rs.utilisateur_id = $1 ORDER BY rs.debut`,
    [utilisateurId]
  );
  return rows;
}
