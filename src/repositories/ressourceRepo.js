// Accès aux données des ressources (salles et matériel).
import { requete } from '../db/postgres.js';

const SELECT_BASE = `SELECT r.id, r.nom, r.type, r.capacite, r.localisation, r.equipements, r.photo_url,
  to_char(r.heure_ouverture, 'HH24:MI') AS heure_ouverture, to_char(r.heure_fermeture, 'HH24:MI') AS heure_fermeture,
  r.validation_requise, r.responsable_id, r.active, r.motif_indisponibilite,
  u.prenom || ' ' || u.nom AS responsable_nom
  FROM ressources r LEFT JOIN utilisateurs u ON u.id = r.responsable_id`;

export async function parId(id, client) {
  const { rows } = await requete(`${SELECT_BASE} WHERE r.id = $1`, [id], client);
  return rows[0];
}

// Filtres : type, capacité minimale, recherche texte et disponibilité à une date (YYYY-MM-DD, heure locale).
export async function lister({ type, capaciteMin, q, date, fuseau, inclureInactives }) {
  const params = [date, fuseau];
  const conditions = [];
  if (!inclureInactives) conditions.push('r.active');
  if (type) {
    params.push(type);
    conditions.push(`r.type = $${params.length}`);
  }
  if (capaciteMin) {
    params.push(capaciteMin);
    conditions.push(`r.capacite >= $${params.length}`);
  }
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    conditions.push(`(r.nom ILIKE $${params.length} OR r.localisation ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  // Taux d'occupation du jour demandé : une ressource est "disponible" s'il reste du temps libre.
  const { rows } = await requete(
    `SELECT t.*, (t.active AND t.minutes_occupees < t.minutes_ouverture) AS disponible_ce_jour FROM (
       SELECT r.id, r.nom, r.type, r.capacite, r.localisation, r.equipements, r.photo_url,
         to_char(r.heure_ouverture, 'HH24:MI') AS heure_ouverture, to_char(r.heure_fermeture, 'HH24:MI') AS heure_fermeture,
         r.validation_requise, r.responsable_id, r.active, r.motif_indisponibilite,
         u.prenom || ' ' || u.nom AS responsable_nom,
         EXTRACT(EPOCH FROM (r.heure_fermeture - r.heure_ouverture)) / 60 AS minutes_ouverture,
         COALESCE((
           SELECT SUM(EXTRACT(EPOCH FROM (
             LEAST(rs.fin, (COALESCE($1::date, CURRENT_DATE) + r.heure_fermeture) AT TIME ZONE $2) -
             GREATEST(rs.debut, (COALESCE($1::date, CURRENT_DATE) + r.heure_ouverture) AT TIME ZONE $2)
           )) / 60)
           FROM reservations rs
           WHERE rs.ressource_id = r.id AND rs.statut IN ('en_attente', 'validee')
             AND rs.periode && tstzrange((COALESCE($1::date, CURRENT_DATE) + r.heure_ouverture) AT TIME ZONE $2,
                                         (COALESCE($1::date, CURRENT_DATE) + r.heure_fermeture) AT TIME ZONE $2)
         ), 0) AS minutes_occupees
       FROM ressources r LEFT JOIN utilisateurs u ON u.id = r.responsable_id
       ${where}
     ) t ORDER BY t.type, t.nom`,
    params
  );
  return rows;
}

export async function creer(d) {
  const { rows } = await requete(
    `INSERT INTO ressources (nom, type, capacite, localisation, equipements, photo_url, heure_ouverture,
       heure_fermeture, validation_requise, responsable_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [d.nom, d.type, d.capacite, d.localisation, d.equipements, d.photo_url ?? null, d.heure_ouverture,
      d.heure_fermeture, d.validation_requise, d.responsable_id ?? null]
  );
  return rows[0].id;
}

export async function modifier(id, d) {
  const { rowCount } = await requete(
    `UPDATE ressources SET nom = $2, type = $3, capacite = $4, localisation = $5, equipements = $6, photo_url = $7,
       heure_ouverture = $8, heure_fermeture = $9, validation_requise = $10, responsable_id = $11 WHERE id = $1`,
    [id, d.nom, d.type, d.capacite, d.localisation, d.equipements, d.photo_url ?? null, d.heure_ouverture,
      d.heure_fermeture, d.validation_requise, d.responsable_id ?? null]
  );
  return rowCount > 0;
}

export async function changerActivation(id, active, motif) {
  const { rowCount } = await requete(
    'UPDATE ressources SET active = $2, motif_indisponibilite = $3 WHERE id = $1',
    [id, active, active ? null : motif ?? null]
  );
  return rowCount > 0;
}
