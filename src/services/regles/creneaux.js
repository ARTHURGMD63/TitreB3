// Règles pures sur les créneaux (sans accès base) : faciles à tester unitairement.
import { composantesLocales, heureEnMinutes, localVersUtc, memeJourLocal, minutesDepuisMinuit } from '../../utils/temps.js';
import { invalide } from '../../utils/erreurs.js';

// Vérifie qu'un créneau demandé est cohérent avec les horaires de la ressource.
export function validerCreneau({ debut, fin, ressource, maintenant, fuseau, pas }) {
  if (!(debut instanceof Date) || !(fin instanceof Date) || isNaN(debut) || isNaN(fin)) {
    throw invalide('Dates invalides.');
  }
  if (debut.getTime() % 60000 !== 0 || fin.getTime() % 60000 !== 0) throw invalide('Les secondes ne sont pas autorisées.');
  if (fin <= debut) throw invalide("L'heure de fin doit être postérieure à l'heure de début.");
  if (debut < maintenant) throw invalide('Le créneau ne peut pas commencer dans le passé.');
  if (!memeJourLocal(debut, new Date(fin.getTime() - 1), fuseau)) {
    throw invalide('Une réservation doit commencer et se terminer le même jour.');
  }
  const dMin = minutesDepuisMinuit(debut, fuseau);
  const fMin = minutesDepuisMinuit(new Date(fin.getTime() - 1), fuseau) + 1;
  if (dMin % pas !== 0 || fMin % pas !== 0) {
    throw invalide(`Les horaires doivent être alignés sur ${pas} minutes.`);
  }
  const ouverture = heureEnMinutes(ressource.heure_ouverture);
  const fermeture = heureEnMinutes(ressource.heure_fermeture);
  if (dMin < ouverture || fMin > fermeture) {
    throw invalide(`Cette ressource est ouverte de ${ressource.heure_ouverture} à ${ressource.heure_fermeture}.`);
  }
}

// Propose des créneaux libres proches de celui demandé (même durée, mêmes jours ou jours suivants).
export function proposerAlternatives({ occupes, debutSouhaite, dureeMinutes, ressource, maintenant, fuseau, pas, max = 3, joursMax = 7 }) {
  const ouverture = heureEnMinutes(ressource.heure_ouverture);
  const fermeture = heureEnMinutes(ressource.heure_fermeture);
  const base = composantesLocales(debutSouhaite, fuseau);
  const candidats = [];

  for (let decalage = 0; decalage <= joursMax; decalage++) {
    const jour = new Date(Date.UTC(base.a, base.m - 1, base.j + decalage));
    const [a, m, j] = [jour.getUTCFullYear(), jour.getUTCMonth() + 1, jour.getUTCDate()];
    for (let minute = ouverture; minute + dureeMinutes <= fermeture; minute += pas) {
      const debut = localVersUtc(a, m, j, Math.floor(minute / 60), minute % 60, fuseau);
      const fin = new Date(debut.getTime() + dureeMinutes * 60000);
      if (debut < maintenant) continue;
      const pris = occupes.some((o) => new Date(o.debut) < fin && new Date(o.fin) > debut);
      if (!pris) candidats.push({ debut, fin });
    }
  }
  candidats.sort((x, y) => Math.abs(x.debut - debutSouhaite) - Math.abs(y.debut - debutSouhaite));
  return candidats.slice(0, max).map((c) => ({ debut: c.debut.toISOString(), fin: c.fin.toISOString() }));
}
