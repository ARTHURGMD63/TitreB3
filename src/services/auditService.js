// Journalisation des actions importantes dans MongoDB. Une panne du journal ne doit pas bloquer l'application.
import * as auditRepo from '../repositories/auditRepo.js';

export const ACTIONS = {
  INSCRIPTION: 'INSCRIPTION',
  CONNEXION: 'CONNEXION',
  CONNEXION_ECHEC: 'CONNEXION_ECHEC',
  COMPTE_VERROUILLE: 'COMPTE_VERROUILLE',
  DECONNEXION: 'DECONNEXION',
  MDP_RESET_DEMANDE: 'MDP_RESET_DEMANDE',
  MDP_RESET: 'MDP_RESET',
  RESERVATION_CREEE: 'RESERVATION_CREEE',
  RESERVATION_MODIFIEE: 'RESERVATION_MODIFIEE',
  RESERVATION_ANNULEE: 'RESERVATION_ANNULEE',
  RESERVATION_VALIDEE: 'RESERVATION_VALIDEE',
  RESERVATION_REFUSEE: 'RESERVATION_REFUSEE',
  UTILISATEUR_MODIFIE: 'UTILISATEUR_MODIFIE',
  RESSOURCE_CREEE: 'RESSOURCE_CREEE',
  RESSOURCE_MODIFIEE: 'RESSOURCE_MODIFIEE',
  RESSOURCE_ACTIVATION: 'RESSOURCE_ACTIVATION',
  QUOTA_MODIFIE: 'QUOTA_MODIFIE',
  DONNEES_EXPORTEES: 'DONNEES_EXPORTEES',
  COMPTE_SUPPRIME: 'COMPTE_SUPPRIME'
};

// contexte : { acteurId, ip } ; cible : { type, id } ; avant / apres : états libres (JSON)
export async function journaliser(action, contexte, cible, avant, apres) {
  try {
    await auditRepo.inserer({
      date: new Date(),
      action,
      acteur_id: contexte?.acteurId ?? null,
      ip: contexte?.ip ?? null,
      cible: cible ?? null,
      avant: avant ?? null,
      apres: apres ?? null
    });
  } catch (err) {
    console.error("Journal d'audit indisponible :", err.message);
  }
}

export const consulter = (filtres) => auditRepo.rechercher(filtres);
