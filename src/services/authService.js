// Authentification : inscription, connexion (verrouillage après échecs), jetons JWT, réinitialisation du mot de passe.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import * as utilisateurRepo from '../repositories/utilisateurRepo.js';
import { ACTIONS, journaliser } from './auditService.js';
import { envoyerEmail } from './notificationService.js';
import { conflit, ErreurApp, invalide, nonAutorise } from '../utils/erreurs.js';

const COUT_BCRYPT = config.enTest ? 4 : 12;
// Hash factice comparé quand l'email est inconnu, pour que le temps de réponse ne révèle pas l'existence du compte.
const HASH_FACTICE = bcrypt.hashSync('mot-de-passe-factice', COUT_BCRYPT);
const sha256 = (texte) => crypto.createHash('sha256').update(texte).digest('hex');

export const hacherMotDePasse = (mdp) => bcrypt.hash(mdp, COUT_BCRYPT);

export function creerJeton(utilisateur) {
  return jwt.sign({ sub: utilisateur.id, role: utilisateur.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: 'HS256'
  });
}

export function verifierJeton(jeton) {
  try {
    return jwt.verify(jeton, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw nonAutorise('Session expirée ou invalide.');
  }
}

export async function inscrire({ email, mot_de_passe, prenom, nom }, ctx) {
  const emailNormalise = email.trim().toLowerCase();
  if (await utilisateurRepo.parEmail(emailNormalise)) throw conflit('Un compte existe déjà avec cet email.');
  const hash = await hacherMotDePasse(mot_de_passe);
  const utilisateur = await utilisateurRepo.creer({ email: emailNormalise, hash, prenom: prenom.trim(), nom: nom.trim() });
  await journaliser(ACTIONS.INSCRIPTION, { acteurId: utilisateur.id, ip: ctx.ip }, { type: 'utilisateur', id: utilisateur.id });
  return utilisateur;
}

export async function connecter({ email, mot_de_passe }, ctx) {
  const utilisateur = await utilisateurRepo.parEmail(email.trim().toLowerCase());
  if (!utilisateur) {
    await bcrypt.compare(mot_de_passe, HASH_FACTICE);
    await journaliser(ACTIONS.CONNEXION_ECHEC, { acteurId: null, ip: ctx.ip }, { type: 'email', id: 'inconnu' });
    throw nonAutorise('Identifiants invalides.');
  }
  if (utilisateur.verrouille_jusqua && utilisateur.verrouille_jusqua > new Date()) {
    throw new ErreurApp(423, 'Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard.');
  }
  const correct = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe_hash);
  if (!correct || !utilisateur.actif) {
    const etat = await utilisateurRepo.enregistrerEchec(utilisateur.id, config.loginMaxEchecs, config.loginVerrouMinutes);
    const verrouille = etat.verrouille_jusqua && etat.verrouille_jusqua > new Date();
    await journaliser(verrouille ? ACTIONS.COMPTE_VERROUILLE : ACTIONS.CONNEXION_ECHEC, { acteurId: utilisateur.id, ip: ctx.ip }, { type: 'utilisateur', id: utilisateur.id });
    throw nonAutorise('Identifiants invalides.');
  }
  await utilisateurRepo.reinitialiserEchecs(utilisateur.id);
  await journaliser(ACTIONS.CONNEXION, { acteurId: utilisateur.id, ip: ctx.ip }, { type: 'utilisateur', id: utilisateur.id });
  return { utilisateur: await utilisateurRepo.parId(utilisateur.id), jeton: creerJeton(utilisateur) };
}

// Réponse identique que le compte existe ou non (pas d'énumération d'emails).
export async function demanderReinitialisation(email, ctx) {
  const utilisateur = await utilisateurRepo.parEmail(email.trim().toLowerCase());
  if (!utilisateur || !utilisateur.actif) return;
  const token = crypto.randomBytes(32).toString('hex');
  await utilisateurRepo.enregistrerResetToken(utilisateur.id, sha256(token), new Date(Date.now() + 3600 * 1000));
  const lien = `${config.appUrl}/#/reinitialiser?token=${token}`;
  await envoyerEmail(utilisateur.email, 'Réinitialisation de votre mot de passe',
    `Bonjour ${utilisateur.prenom},\n\nPour choisir un nouveau mot de passe (lien valable 1 heure) :\n${lien}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`);
  await journaliser(ACTIONS.MDP_RESET_DEMANDE, { acteurId: utilisateur.id, ip: ctx.ip }, { type: 'utilisateur', id: utilisateur.id });
}

export async function reinitialiserMotDePasse({ token, mot_de_passe }, ctx) {
  const utilisateur = await utilisateurRepo.parResetToken(sha256(token));
  if (!utilisateur) throw invalide('Lien de réinitialisation invalide ou expiré.');
  await utilisateurRepo.changerMotDePasse(utilisateur.id, await hacherMotDePasse(mot_de_passe));
  await journaliser(ACTIONS.MDP_RESET, { acteurId: utilisateur.id, ip: ctx.ip }, { type: 'utilisateur', id: utilisateur.id });
}
