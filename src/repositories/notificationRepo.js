// Notifications internes (en complément des emails).
import { requete } from '../db/postgres.js';

export const creer = (utilisateurId, type, message) =>
  requete('INSERT INTO notifications (utilisateur_id, type, message) VALUES ($1, $2, $3)', [utilisateurId, type, message]);

export async function lister(utilisateurId) {
  const { rows } = await requete(
    'SELECT id, type, message, lue, cree_le FROM notifications WHERE utilisateur_id = $1 ORDER BY cree_le DESC LIMIT 50',
    [utilisateurId]
  );
  return rows;
}

export const toutMarquerLu = (utilisateurId) =>
  requete('UPDATE notifications SET lue = TRUE WHERE utilisateur_id = $1 AND NOT lue', [utilisateurId]);

export const supprimerDeUtilisateur = (utilisateurId) =>
  requete('DELETE FROM notifications WHERE utilisateur_id = $1', [utilisateurId]);
