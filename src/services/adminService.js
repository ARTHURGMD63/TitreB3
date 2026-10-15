// Administration : comptes, quotas, statistiques, et droits RGPD (accès / effacement).
import crypto from 'node:crypto';
import config from '../config.js';
import * as auditRepo from '../repositories/auditRepo.js';
import * as notificationRepo from '../repositories/notificationRepo.js';
import * as reservationRepo from '../repositories/reservationRepo.js';
import * as statsRepo from '../repositories/statsRepo.js';
import * as utilisateurRepo from '../repositories/utilisateurRepo.js';
import { ACTIONS, journaliser } from './auditService.js';
import { hacherMotDePasse } from './authService.js';
import { conflit, introuvable } from '../utils/erreurs.js';

export const listerUtilisateurs = () => utilisateurRepo.lister();
export const listerResponsables = () => utilisateurRepo.listerResponsables();
export const listerProfils = () => utilisateurRepo.listerProfils();

export async function modifierUtilisateur(admin, id, donnees, ctx) {
  const avant = await utilisateurRepo.parId(id);
  if (!avant) throw introuvable('Utilisateur introuvable.');
  // Évite qu'un administrateur se retire lui-même ses droits et verrouille la plateforme.
  if (id === admin.id && (donnees.role && donnees.role !== 'admin' || donnees.actif === false)) {
    throw conflit('Vous ne pouvez pas retirer vos propres droits ni désactiver votre compte.');
  }
  const apres = await utilisateurRepo.majAdmin(id, donnees);
  await journaliser(ACTIONS.UTILISATEUR_MODIFIE, ctx, { type: 'utilisateur', id },
    { role: avant.role, profil_quota_id: avant.profil_quota_id, actif: avant.actif }, donnees);
  return apres;
}

export async function modifierProfil(id, donnees, ctx) {
  const profil = await utilisateurRepo.majProfil(id, donnees);
  if (!profil) throw introuvable('Profil de quota introuvable.');
  await journaliser(ACTIONS.QUOTA_MODIFIE, ctx, { type: 'profil_quota', id }, null, donnees);
  return profil;
}

export async function statistiques(du, au) {
  const [occupation, demandees, saturés, statuts, annulations] = await Promise.all([
    statsRepo.tauxOccupation(du, au),
    statsRepo.ressourcesLesPlusDemandees(du, au),
    statsRepo.creneauxSatures(du, au, config.fuseau),
    statsRepo.repartitionStatuts(du, au),
    statsRepo.annulations(du, au)
  ]);
  return { du, au, occupation, plus_demandees: demandees, creneaux_satures: saturés, statuts, annulations };
}

// Droit d'accès (art. 15 RGPD) : export de toutes les données de la personne.
export async function exporterDonnees(utilisateur, ctx) {
  const [profil, reservations, notifications, audit] = await Promise.all([
    utilisateurRepo.parId(utilisateur.id),
    reservationRepo.exporterPourUtilisateur(utilisateur.id),
    notificationRepo.lister(utilisateur.id),
    auditRepo.exporterPourActeur(utilisateur.id)
  ]);
  await journaliser(ACTIONS.DONNEES_EXPORTEES, ctx, { type: 'utilisateur', id: utilisateur.id });
  return { exporte_le: new Date().toISOString(), profil, reservations, notifications, journal: audit };
}

// Droit à l'effacement (art. 17) : anonymisation du compte, suppression des notifications, pseudonymisation du journal.
export async function supprimerCompte(utilisateur) {
  await utilisateurRepo.anonymiser(utilisateur.id, await hacherMotDePasse(crypto.randomBytes(32).toString('hex')));
  await notificationRepo.supprimerDeUtilisateur(utilisateur.id);
  await auditRepo.pseudonymiserActeur(utilisateur.id);
  await journaliser(ACTIONS.COMPTE_SUPPRIME, { acteurId: utilisateur.id, ip: null }, { type: 'utilisateur', id: utilisateur.id });
}
