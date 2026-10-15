// Cœur métier : création, modification, annulation et validation des réservations.
import config from '../config.js';
import { transaction } from '../db/postgres.js';
import * as reservationRepo from '../repositories/reservationRepo.js';
import * as ressourceRepo from '../repositories/ressourceRepo.js';
import * as utilisateurRepo from '../repositories/utilisateurRepo.js';
import { ACTIONS, journaliser } from './auditService.js';
import { notifier } from './notificationService.js';
import { proposerAlternatives, validerCreneau } from './regles/creneaux.js';
import { quotaRestant, verifierQuota } from './regles/quotas.js';
import { exigerGestionnaire, exigerTransition, peutGerer, statutInitial } from './regles/workflow.js';
import { conflit, interdit, introuvable, invalide } from '../utils/erreurs.js';
import { ajouterJours } from '../utils/temps.js';

const CODE_EXCLUSION_PG = '23P01'; // violation de la contrainte d'exclusion (chevauchement)
const fmt = (d) => new Date(d).toLocaleString('fr-FR', { timeZone: config.fuseau, dateStyle: 'short', timeStyle: 'short' });

async function alternativesPour(ressource, debut, fin, exclureId) {
  const maintenant = new Date();
  const du = debut;
  const au = ajouterJours(debut, 8);
  const occupes = await reservationRepo.occupation(ressource.id, du, au, 0);
  return proposerAlternatives({
    occupes: occupes.filter((o) => o.id !== exclureId),
    debutSouhaite: debut,
    dureeMinutes: (fin - debut) / 60000,
    ressource,
    maintenant,
    fuseau: config.fuseau,
    pas: config.pasCreneauMinutes
  });
}

async function leverConflit(ressource, debut, fin, exclureId) {
  const alternatives = await alternativesPour(ressource, debut, fin, exclureId);
  throw conflit('Ce créneau est déjà réservé.', { alternatives });
}

async function notifierResponsable(ressource, type, sujet, message) {
  if (!ressource.responsable_id) return;
  const responsable = await utilisateurRepo.parId(ressource.responsable_id);
  if (responsable) await notifier(responsable, type, sujet, message);
}

export async function creer(utilisateur, { ressource_id, debut, fin, motif }, ctx) {
  const ressource = await ressourceRepo.parId(ressource_id);
  if (!ressource) throw introuvable('Ressource introuvable.');
  if (!ressource.active) throw conflit(`Ressource indisponible${ressource.motif_indisponibilite ? ` : ${ressource.motif_indisponibilite}` : '.'}`);

  const maintenant = new Date();
  validerCreneau({ debut, fin, ressource, maintenant, fuseau: config.fuseau, pas: config.pasCreneauMinutes });
  const statut = statutInitial(ressource, utilisateur);

  let id;
  try {
    id = await transaction(async (client) => {
      // Le verrou sur l'utilisateur sérialise ses réservations simultanées : le quota ne peut pas être dépassé.
      await client.query('SELECT id FROM utilisateurs WHERE id = $1 FOR UPDATE', [utilisateur.id]);
      const profil = await utilisateurRepo.parId(utilisateur.id, client);
      const nbActives = await reservationRepo.compterActives(utilisateur.id, client);
      verifierQuota({ profil, nbActives, debut, fin, maintenant });
      // Niveau 1 : contrôle applicatif du chevauchement.
      if ((await reservationRepo.chevauchements(ressource.id, debut, fin, null, client)).length) return null;
      // Niveau 2 : la contrainte d'exclusion PostgreSQL protège contre les accès concurrents.
      return reservationRepo.creer({ ressourceId: ressource.id, utilisateurId: utilisateur.id, debut, fin, motif, statut }, client);
    });
  } catch (err) {
    if (err.code === CODE_EXCLUSION_PG) await leverConflit(ressource, debut, fin);
    throw err;
  }
  if (id === null) await leverConflit(ressource, debut, fin);

  const reservation = await reservationRepo.parId(id);
  await journaliser(ACTIONS.RESERVATION_CREEE, { acteurId: utilisateur.id, ip: ctx.ip }, { type: 'reservation', id }, null, instantane(reservation));
  if (statut === 'en_attente') {
    await notifierResponsable(ressource, 'demande_recue', 'Nouvelle demande de réservation',
      `${reservation.demandeur_nom} demande "${ressource.nom}" le ${fmt(debut)}. Merci de la traiter.`);
  } else {
    await notifier(utilisateur, 'reservation_validee', 'Réservation confirmée', `Votre réservation de "${ressource.nom}" le ${fmt(debut)} est confirmée.`);
  }
  return reservation;
}

export async function modifier(utilisateur, id, { debut, fin, motif }, ctx) {
  const avant = await reservationRepo.parId(id);
  if (!avant || avant.utilisateur_id !== utilisateur.id) throw introuvable('Réservation introuvable.');
  if (!['en_attente', 'validee'].includes(avant.statut)) throw conflit('Cette réservation ne peut plus être modifiée.');
  const maintenant = new Date();
  if (new Date(avant.debut) - maintenant < config.delaiModificationHeures * 3600 * 1000) {
    throw interdit(`Modification impossible moins de ${config.delaiModificationHeures} h avant le début.`);
  }
  const ressource = await ressourceRepo.parId(avant.ressource_id);
  if (!ressource.active) throw conflit('Ressource indisponible.');
  validerCreneau({ debut, fin, ressource, maintenant, fuseau: config.fuseau, pas: config.pasCreneauMinutes });
  // Une réservation validée sur une ressource sous contrôle repasse en attente après modification.
  const statut = statutInitial(ressource, utilisateur);
  if (statut !== avant.statut) exigerTransition(avant.statut, statut);

  try {
    await transaction(async (client) => {
      await client.query('SELECT id FROM utilisateurs WHERE id = $1 FOR UPDATE', [utilisateur.id]);
      const profil = await utilisateurRepo.parId(utilisateur.id, client);
      // La réservation modifiée ne compte pas deux fois dans le quota.
      verifierQuota({ profil, nbActives: (await reservationRepo.compterActives(utilisateur.id, client)) - 1, debut, fin, maintenant });
      if ((await reservationRepo.chevauchements(ressource.id, debut, fin, id, client)).length) throw conflit('__conflit__');
      await reservationRepo.modifierCreneau(id, { debut, fin, motif, statut }, client);
    });
  } catch (err) {
    if (err.code === CODE_EXCLUSION_PG || err.message === '__conflit__') await leverConflit(ressource, debut, fin, id);
    throw err;
  }
  const apres = await reservationRepo.parId(id);
  await journaliser(ACTIONS.RESERVATION_MODIFIEE, { acteurId: utilisateur.id, ip: ctx.ip }, { type: 'reservation', id }, instantane(avant), instantane(apres));
  if (statut === 'en_attente') {
    await notifierResponsable(ressource, 'demande_recue', 'Demande de réservation modifiée',
      `${apres.demandeur_nom} a modifié sa demande pour "${ressource.nom}" (${fmt(debut)}). Elle est à nouveau en attente.`);
  }
  return apres;
}

export async function annuler(utilisateur, id, ctx) {
  const avant = await reservationRepo.parId(id);
  if (!avant) throw introuvable('Réservation introuvable.');
  const ressource = await ressourceRepo.parId(avant.ressource_id);
  const estProprietaire = avant.utilisateur_id === utilisateur.id;
  const estGestionnaire = peutGerer(utilisateur, ressource);
  if (!estProprietaire && !estGestionnaire) throw introuvable('Réservation introuvable.');
  exigerTransition(avant.statut, 'annulee');
  if (estProprietaire && new Date(avant.debut) <= new Date()) throw conflit('Une réservation commencée ne peut plus être annulée.');

  await reservationRepo.changerStatut(id, 'annulee', { decidePar: estProprietaire ? null : utilisateur.id });
  const apres = await reservationRepo.parId(id);
  await journaliser(ACTIONS.RESERVATION_ANNULEE, { acteurId: utilisateur.id, ip: ctx.ip }, { type: 'reservation', id }, instantane(avant), instantane(apres));
  if (!estProprietaire) {
    const proprietaire = await utilisateurRepo.parId(avant.utilisateur_id);
    await notifier({ id: proprietaire.id, email: proprietaire.email }, 'annulation_responsable', 'Réservation annulée',
      `Votre réservation de "${ressource.nom}" le ${fmt(avant.debut)} a été annulée par le responsable.`);
  }
  return apres;
}

export async function decider(utilisateur, id, { decision, motif }, ctx) {
  const avant = await reservationRepo.parId(id);
  if (!avant) throw introuvable('Réservation introuvable.');
  const ressource = await ressourceRepo.parId(avant.ressource_id);
  exigerGestionnaire(utilisateur, ressource);
  exigerTransition(avant.statut, decision);
  if (decision === 'refusee' && !motif?.trim()) throw invalide('Un motif est obligatoire pour refuser une demande.');

  await reservationRepo.changerStatut(id, decision, { decidePar: utilisateur.id, motifDecision: motif?.trim() || null });
  const apres = await reservationRepo.parId(id);
  const validee = decision === 'validee';
  await journaliser(validee ? ACTIONS.RESERVATION_VALIDEE : ACTIONS.RESERVATION_REFUSEE, { acteurId: utilisateur.id, ip: ctx.ip },
    { type: 'reservation', id }, instantane(avant), instantane(apres));
  const demandeur = await utilisateurRepo.parId(avant.utilisateur_id);
  await notifier({ id: demandeur.id, email: demandeur.email }, validee ? 'reservation_validee' : 'reservation_refusee',
    validee ? 'Réservation validée' : 'Réservation refusée',
    validee
      ? `Votre demande pour "${ressource.nom}" le ${fmt(avant.debut)} est validée.`
      : `Votre demande pour "${ressource.nom}" le ${fmt(avant.debut)} est refusée. Motif : ${motif.trim()}`);
  return apres;
}

export const mesReservations = (utilisateur, periode) => reservationRepo.parUtilisateur(utilisateur.id, periode);
export const demandesATraiter = (utilisateur) => reservationRepo.enAttentePourResponsable(utilisateur.id, utilisateur.role === 'admin');
export const planning = (utilisateur, du, au) => reservationRepo.planningResponsable(utilisateur.id, utilisateur.role === 'admin', du, au);

export async function quotaDe(utilisateur) {
  const profil = await utilisateurRepo.parId(utilisateur.id);
  return quotaRestant(profil, await reservationRepo.compterActives(utilisateur.id));
}

export async function occupationRessource(ressourceId, du, au, utilisateurId) {
  const ressource = await ressourceRepo.parId(ressourceId);
  if (!ressource) throw introuvable('Ressource introuvable.');
  return reservationRepo.occupation(ressourceId, du, au, utilisateurId);
}

// Tâches planifiées : clôture des réservations passées et rappels la veille.
export async function executerTachesPlanifiees() {
  const terminees = await reservationRepo.terminerPassees();
  const rappels = await reservationRepo.aRappeler();
  for (const r of rappels) {
    const user = await utilisateurRepo.parId(r.utilisateur_id);
    const ressource = await ressourceRepo.parId(r.ressource_id);
    if (user) await notifier(user, 'rappel', 'Rappel de réservation', `Rappel : vous avez réservé "${ressource.nom}" le ${fmt(r.debut)}.`);
  }
  return { terminees, rappels: rappels.length };
}

const instantane = (r) => ({ ressource_id: r.ressource_id, debut: r.debut, fin: r.fin, motif: r.motif, statut: r.statut });
