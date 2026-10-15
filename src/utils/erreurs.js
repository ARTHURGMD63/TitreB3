// Erreurs métier : portent un code HTTP et un message affichable à l'utilisateur.
export class ErreurApp extends Error {
  constructor(statut, message, details) {
    super(message);
    this.statut = statut;
    this.details = details;
  }
}

export const nonAutorise = (msg = 'Authentification requise.') => new ErreurApp(401, msg);
export const interdit = (msg = 'Accès interdit.') => new ErreurApp(403, msg);
export const introuvable = (msg = 'Ressource introuvable.') => new ErreurApp(404, msg);
export const conflit = (msg, details) => new ErreurApp(409, msg, details);
export const invalide = (msg, details) => new ErreurApp(400, msg, details);
