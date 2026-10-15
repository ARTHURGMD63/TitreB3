// Règles de quota (pures) : nombre de réservations actives, durée maximale, délai maximal à l'avance.
import { interdit } from '../../utils/erreurs.js';
import { ajouterJours } from '../../utils/temps.js';

export function verifierQuota({ profil, nbActives, debut, fin, maintenant }) {
  if (nbActives >= profil.max_reservations_actives) {
    throw interdit(`Quota atteint : ${profil.max_reservations_actives} réservation(s) active(s) maximum pour votre profil.`);
  }
  const duree = (fin - debut) / 60000;
  if (duree > profil.duree_max_minutes) {
    throw interdit(`Durée trop longue : ${profil.duree_max_minutes} minutes maximum par réservation pour votre profil.`);
  }
  if (debut > ajouterJours(maintenant, profil.delai_max_jours)) {
    throw interdit(`Trop tôt : on ne peut réserver que ${profil.delai_max_jours} jours à l'avance pour votre profil.`);
  }
}

// Quota restant affiché sur le tableau de bord de l'utilisateur.
export function quotaRestant(profil, nbActives) {
  return {
    profil: profil.profil_libelle ?? profil.libelle,
    reservations_actives: nbActives,
    reservations_max: profil.max_reservations_actives,
    reservations_restantes: Math.max(0, profil.max_reservations_actives - nbActives),
    duree_max_minutes: profil.duree_max_minutes,
    delai_max_jours: profil.delai_max_jours
  };
}
