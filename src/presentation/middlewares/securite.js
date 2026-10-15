// Middlewares de sécurité : authentification par cookie JWT, contrôle des rôles, protection CSRF.
import crypto from 'node:crypto';
import config from '../../config.js';
import * as utilisateurRepo from '../../repositories/utilisateurRepo.js';
import { verifierJeton } from '../../services/authService.js';
import { interdit, nonAutorise } from '../../utils/erreurs.js';

export const NOM_COOKIE_JETON = 'token';
export const NOM_COOKIE_CSRF = 'csrf_token';

export const optionsCookieJeton = () => ({
  httpOnly: true, // inaccessible au JavaScript : limite l'impact d'une faille XSS
  sameSite: 'strict',
  secure: config.enProduction,
  maxAge: 2 * 3600 * 1000,
  path: '/'
});

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Charge l'utilisateur depuis la base à chaque requête : un compte désactivé ou un changement de rôle est effectif immédiatement.
export const authentifier = asyncHandler(async (req, _res, next) => {
  const jeton = req.cookies?.[NOM_COOKIE_JETON];
  if (!jeton) throw nonAutorise();
  const payload = verifierJeton(jeton);
  const utilisateur = await utilisateurRepo.parId(payload.sub);
  if (!utilisateur || !utilisateur.actif) throw nonAutorise('Compte inactif ou inexistant.');
  req.utilisateur = utilisateur;
  next();
});

// Le contrôle des rôles est toujours fait côté serveur, jamais seulement dans l'interface.
export const exigerRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.utilisateur.role)) return next(interdit('Droits insuffisants pour cette action.'));
  next();
};

export const contexte = (req) => ({ acteurId: req.utilisateur?.id ?? null, ip: req.ip });

// CSRF : double soumission de cookie (le jeton du cookie doit être renvoyé dans l'en-tête X-CSRF-Token).
export function emettreJetonCsrf(req, res) {
  let jeton = req.cookies?.[NOM_COOKIE_CSRF];
  if (!jeton) {
    jeton = crypto.randomBytes(24).toString('hex');
    res.cookie(NOM_COOKIE_CSRF, jeton, { httpOnly: false, sameSite: 'strict', secure: config.enProduction, path: '/' });
  }
  return jeton;
}

const METHODES_SURES = new Set(['GET', 'HEAD', 'OPTIONS']);

export function protegerCsrf(req, _res, next) {
  if (METHODES_SURES.has(req.method)) return next();
  // Contrôle d'origine en défense en profondeur
  const origine = req.get('origin');
  if (origine && new URL(origine).host !== req.get('host')) return next(interdit('Origine non autorisée.'));
  const cookie = req.cookies?.[NOM_COOKIE_CSRF];
  const entete = req.get('x-csrf-token');
  if (!cookie || !entete || cookie.length !== entete.length || !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(entete))) {
    return next(interdit('Jeton CSRF invalide ou manquant.'));
  }
  next();
}
