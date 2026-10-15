// Catalogue des ressources : consultation pour tous, gestion réservée à l'administrateur.
import config from '../config.js';
import * as ressourceRepo from '../repositories/ressourceRepo.js';
import { ACTIONS, journaliser } from './auditService.js';
import { introuvable } from '../utils/erreurs.js';

export const lister = (filtres, utilisateur) =>
  ressourceRepo.lister({ ...filtres, fuseau: config.fuseau, inclureInactives: utilisateur?.role === 'admin' });

export async function obtenir(id) {
  const ressource = await ressourceRepo.parId(id);
  if (!ressource) throw introuvable('Ressource introuvable.');
  return ressource;
}

export async function creer(donnees, ctx) {
  const id = await ressourceRepo.creer(donnees);
  await journaliser(ACTIONS.RESSOURCE_CREEE, ctx, { type: 'ressource', id }, null, donnees);
  return obtenir(id);
}

export async function modifier(id, donnees, ctx) {
  const avant = await obtenir(id);
  await ressourceRepo.modifier(id, donnees);
  await journaliser(ACTIONS.RESSOURCE_MODIFIEE, ctx, { type: 'ressource', id }, avant, donnees);
  return obtenir(id);
}

export async function changerActivation(id, active, motif, ctx) {
  const avant = await obtenir(id);
  await ressourceRepo.changerActivation(id, active, motif);
  await journaliser(ACTIONS.RESSOURCE_ACTIVATION, ctx, { type: 'ressource', id }, { active: avant.active }, { active, motif });
  return obtenir(id);
}
