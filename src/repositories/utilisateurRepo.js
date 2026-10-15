// Accès aux données des utilisateurs (PostgreSQL, requêtes préparées uniquement).
import { requete } from '../db/postgres.js';

const COLONNES_PUBLIQUES = `u.id, u.email, u.prenom, u.nom, u.role, u.actif, u.cree_le,
  u.profil_quota_id, p.code AS profil_code, p.libelle AS profil_libelle`;

export async function parEmail(email, client) {
  const { rows } = await requete('SELECT * FROM utilisateurs WHERE email = $1', [email], client);
  return rows[0];
}

export async function parId(id, client) {
  const { rows } = await requete(
    `SELECT ${COLONNES_PUBLIQUES}, p.max_reservations_actives, p.duree_max_minutes, p.delai_max_jours
     FROM utilisateurs u JOIN profils_quota p ON p.id = u.profil_quota_id WHERE u.id = $1`,
    [id],
    client
  );
  return rows[0];
}

export async function creer({ email, hash, prenom, nom }) {
  const { rows } = await requete(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, prenom, nom, profil_quota_id)
     VALUES ($1, $2, $3, $4, (SELECT id FROM profils_quota WHERE code = 'eleve'))
     RETURNING id, email, prenom, nom, role`,
    [email, hash, prenom, nom]
  );
  return rows[0];
}

export async function lister() {
  const { rows } = await requete(
    `SELECT ${COLONNES_PUBLIQUES} FROM utilisateurs u
     JOIN profils_quota p ON p.id = u.profil_quota_id ORDER BY u.nom, u.prenom`
  );
  return rows;
}

export async function listerResponsables() {
  const { rows } = await requete(
    `SELECT id, prenom, nom FROM utilisateurs WHERE role IN ('responsable','admin') AND actif ORDER BY nom`
  );
  return rows;
}

export async function majAdmin(id, { role, profil_quota_id, actif }) {
  const { rows } = await requete(
    `UPDATE utilisateurs SET role = COALESCE($2, role),
       profil_quota_id = COALESCE($3, profil_quota_id), actif = COALESCE($4, actif)
     WHERE id = $1 AND anonymise_le IS NULL RETURNING id, email, role, profil_quota_id, actif`,
    [id, role ?? null, profil_quota_id ?? null, actif ?? null]
  );
  return rows[0];
}

export async function enregistrerEchec(id, maxEchecs, minutesVerrou) {
  const { rows } = await requete(
    `UPDATE utilisateurs SET tentatives_echec = tentatives_echec + 1,
       verrouille_jusqua = CASE WHEN tentatives_echec + 1 >= $2
         THEN now() + make_interval(mins => $3) ELSE verrouille_jusqua END
     WHERE id = $1 RETURNING tentatives_echec, verrouille_jusqua`,
    [id, maxEchecs, minutesVerrou]
  );
  return rows[0];
}

export const reinitialiserEchecs = (id) =>
  requete('UPDATE utilisateurs SET tentatives_echec = 0, verrouille_jusqua = NULL WHERE id = $1', [id]);

export const enregistrerResetToken = (id, hash, expireLe) =>
  requete('UPDATE utilisateurs SET reset_token_hash = $2, reset_expire_le = $3 WHERE id = $1', [id, hash, expireLe]);

export async function parResetToken(hash) {
  const { rows } = await requete(
    'SELECT * FROM utilisateurs WHERE reset_token_hash = $1 AND reset_expire_le > now() AND actif',
    [hash]
  );
  return rows[0];
}

export const changerMotDePasse = (id, hash) =>
  requete(
    `UPDATE utilisateurs SET mot_de_passe_hash = $2, reset_token_hash = NULL, reset_expire_le = NULL,
       tentatives_echec = 0, verrouille_jusqua = NULL WHERE id = $1`,
    [id, hash]
  );

// Droit à l'effacement : les données personnelles sont remplacées, les réservations restent (statistiques).
export const anonymiser = (id, hashAleatoire) =>
  requete(
    `UPDATE utilisateurs SET email = 'supprime-' || id || '@anonyme.invalid', prenom = 'Compte', nom = 'supprimé',
       mot_de_passe_hash = $2, actif = FALSE, reset_token_hash = NULL, reset_expire_le = NULL, anonymise_le = now()
     WHERE id = $1`,
    [id, hashAleatoire]
  );

export async function listerProfils() {
  const { rows } = await requete('SELECT * FROM profils_quota ORDER BY id');
  return rows;
}

export async function majProfil(id, { libelle, max_reservations_actives, duree_max_minutes, delai_max_jours }) {
  const { rows } = await requete(
    `UPDATE profils_quota SET libelle = COALESCE($2, libelle),
       max_reservations_actives = COALESCE($3, max_reservations_actives),
       duree_max_minutes = COALESCE($4, duree_max_minutes), delai_max_jours = COALESCE($5, delai_max_jours)
     WHERE id = $1 RETURNING *`,
    [id, libelle ?? null, max_reservations_actives ?? null, duree_max_minutes ?? null, delai_max_jours ?? null]
  );
  return rows[0];
}
