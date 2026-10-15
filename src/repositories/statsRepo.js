// Requêtes d'agrégation SQL pour le tableau de bord de l'administrateur.
import { requete } from '../db/postgres.js';

// Taux d'occupation = minutes réservées (validées ou terminées) / minutes d'ouverture sur la période.
export async function tauxOccupation(du, au) {
  const { rows } = await requete(
    `SELECT r.id, r.nom, r.type,
       COALESCE(SUM(EXTRACT(EPOCH FROM (rs.fin - rs.debut)) / 60), 0)::int AS minutes_reservees,
       ROUND(100 * COALESCE(SUM(EXTRACT(EPOCH FROM (rs.fin - rs.debut)) / 60), 0)
         / NULLIF((EXTRACT(EPOCH FROM (r.heure_fermeture - r.heure_ouverture)) / 60)
                  * GREATEST(1, ($2::date - $1::date)), 0), 1) AS taux_occupation
     FROM ressources r
     LEFT JOIN reservations rs ON rs.ressource_id = r.id AND rs.statut IN ('validee', 'terminee')
       AND rs.debut >= $1::date AND rs.debut < $2::date
     GROUP BY r.id ORDER BY taux_occupation DESC NULLS LAST, r.nom`,
    [du, au]
  );
  return rows;
}

export async function ressourcesLesPlusDemandees(du, au, limite = 5) {
  const { rows } = await requete(
    `SELECT r.id, r.nom, count(rs.id)::int AS nb_demandes
     FROM reservations rs JOIN ressources r ON r.id = rs.ressource_id
     WHERE rs.debut >= $1::date AND rs.debut < $2::date
     GROUP BY r.id ORDER BY nb_demandes DESC, r.nom LIMIT $3`,
    [du, au, limite]
  );
  return rows;
}

// Créneaux saturés : nombre de réservations actives par jour de semaine (1 = lundi) et par heure.
export async function creneauxSatures(du, au, fuseau, limite = 8) {
  const { rows } = await requete(
    `SELECT EXTRACT(ISODOW FROM h)::int AS jour_semaine, EXTRACT(HOUR FROM h)::int AS heure, count(*)::int AS nb_reservations
     FROM reservations rs,
       LATERAL generate_series(date_trunc('hour', rs.debut AT TIME ZONE $3),
                               (rs.fin AT TIME ZONE $3) - interval '1 second', interval '1 hour') AS h
     WHERE rs.statut IN ('validee', 'terminee') AND rs.debut >= $1::date AND rs.debut < $2::date
     GROUP BY 1, 2 ORDER BY nb_reservations DESC, 1, 2 LIMIT $4`,
    [du, au, fuseau, limite]
  );
  return rows;
}

export async function repartitionStatuts(du, au) {
  const { rows } = await requete(
    `SELECT statut, count(*)::int AS nb FROM reservations
     WHERE debut >= $1::date AND debut < $2::date GROUP BY statut ORDER BY nb DESC`,
    [du, au]
  );
  return rows;
}

export async function annulations(du, au) {
  const { rows } = await requete(
    `SELECT count(*) FILTER (WHERE statut = 'annulee')::int AS nb_annulations, count(*)::int AS nb_total,
       ROUND(100.0 * count(*) FILTER (WHERE statut = 'annulee') / NULLIF(count(*), 0), 1) AS taux_annulation
     FROM reservations WHERE debut >= $1::date AND debut < $2::date`,
    [du, au]
  );
  return rows[0];
}
