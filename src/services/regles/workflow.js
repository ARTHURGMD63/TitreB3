// Machine à états d'une réservation : en attente -> validée / refusée -> terminée / annulée.
import { conflit, interdit } from '../../utils/erreurs.js';

export const STATUTS = ['en_attente', 'validee', 'refusee', 'terminee', 'annulee'];

const TRANSITIONS = {
  en_attente: ['validee', 'refusee', 'annulee'],
  validee: ['terminee', 'annulee', 'en_attente'], // retour en attente si l'usager modifie une réservation validée
  refusee: [],
  terminee: [],
  annulee: []
};

export const peutTransiter = (de, vers) => TRANSITIONS[de]?.includes(vers) ?? false;

export function exigerTransition(de, vers) {
  if (!peutTransiter(de, vers)) {
    throw conflit(`Transition impossible : "${de}" vers "${vers}".`);
  }
}

// Statut initial : réservation libre ou soumise à validation (sauf si le demandeur gère déjà la ressource).
export function statutInitial(ressource, demandeur) {
  if (!ressource.validation_requise) return 'validee';
  const gere = demandeur.role === 'admin' || (demandeur.role === 'responsable' && ressource.responsable_id === demandeur.id);
  return gere ? 'validee' : 'en_attente';
}

export const peutGerer = (utilisateur, ressource) =>
  utilisateur.role === 'admin' || (utilisateur.role === 'responsable' && ressource.responsable_id === utilisateur.id);

export function exigerGestionnaire(utilisateur, ressource) {
  if (!peutGerer(utilisateur, ressource)) throw interdit("Vous n'êtes pas responsable de cette ressource.");
}
