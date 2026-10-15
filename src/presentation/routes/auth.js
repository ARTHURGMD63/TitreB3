// Routes d'authentification et de profil.
import { Router } from 'express';
import * as authService from '../../services/authService.js';
import * as adminService from '../../services/adminService.js';
import * as reservationService from '../../services/reservationService.js';
import * as notificationService from '../../services/notificationService.js';
import { ACTIONS, journaliser } from '../../services/auditService.js';
import * as s from '../schemas.js';
import { asyncHandler, authentifier, contexte, emettreJetonCsrf, NOM_COOKIE_JETON, optionsCookieJeton } from '../middlewares/securite.js';

const routeur = Router();
const publique = (u) => ({ id: u.id, email: u.email, prenom: u.prenom, nom: u.nom, role: u.role, profil: u.profil_libelle });

routeur.get('/csrf', (req, res) => res.json({ csrf: emettreJetonCsrf(req, res) }));

routeur.post('/auth/register', asyncHandler(async (req, res) => {
  const utilisateur = await authService.inscrire(s.inscription.parse(req.body), { ip: req.ip });
  res.status(201).json({ id: utilisateur.id, message: 'Compte créé. Vous pouvez vous connecter.' });
}));

routeur.post('/auth/login', asyncHandler(async (req, res) => {
  const { utilisateur, jeton } = await authService.connecter(s.connexion.parse(req.body), { ip: req.ip });
  res.cookie(NOM_COOKIE_JETON, jeton, optionsCookieJeton());
  res.json({ utilisateur: publique(utilisateur) });
}));

routeur.post('/auth/logout', authentifier, asyncHandler(async (req, res) => {
  await journaliser(ACTIONS.DECONNEXION, contexte(req), { type: 'utilisateur', id: req.utilisateur.id });
  res.clearCookie(NOM_COOKIE_JETON, { ...optionsCookieJeton(), maxAge: undefined });
  res.status(204).end();
}));

routeur.post('/auth/forgot-password', asyncHandler(async (req, res) => {
  await authService.demanderReinitialisation(s.demandeReset.parse(req.body).email, { ip: req.ip });
  res.json({ message: 'Si un compte correspond, un email de réinitialisation vient d\'être envoyé.' });
}));

routeur.post('/auth/reset-password', asyncHandler(async (req, res) => {
  await authService.reinitialiserMotDePasse(s.reset.parse(req.body), { ip: req.ip });
  res.json({ message: 'Mot de passe modifié. Vous pouvez vous connecter.' });
}));

// --- Espace de l'utilisateur connecté ---
routeur.get('/me', authentifier, (req, res) => res.json({ utilisateur: publique(req.utilisateur) }));

routeur.get('/me/quota', authentifier, asyncHandler(async (req, res) => {
  res.json(await reservationService.quotaDe(req.utilisateur));
}));

routeur.get('/me/notifications', authentifier, asyncHandler(async (req, res) => {
  res.json(await notificationService.lister(req.utilisateur.id));
}));

routeur.post('/me/notifications/lues', authentifier, asyncHandler(async (req, res) => {
  await notificationService.toutMarquerLu(req.utilisateur.id);
  res.status(204).end();
}));

// RGPD : droit d'accès et droit à l'effacement
routeur.get('/me/export', authentifier, asyncHandler(async (req, res) => {
  const donnees = await adminService.exporterDonnees(req.utilisateur, contexte(req));
  res.setHeader('Content-Disposition', 'attachment; filename="mes-donnees.json"');
  res.json(donnees);
}));

routeur.delete('/me', authentifier, asyncHandler(async (req, res) => {
  await adminService.supprimerCompte(req.utilisateur);
  res.clearCookie(NOM_COOKIE_JETON, { ...optionsCookieJeton(), maxAge: undefined });
  res.status(204).end();
}));

export default routeur;
