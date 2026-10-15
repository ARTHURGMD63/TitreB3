// Gestion centralisée des erreurs : aucun détail technique n'est renvoyé au client.
import { ZodError } from 'zod';
import { ErreurApp } from '../../utils/erreurs.js';

export function routeInconnue(_req, res) {
  res.status(404).json({ erreur: 'Route introuvable.' });
}

export function gestionnaireErreurs(err, req, res, _next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ champ: i.path.join('.'), message: i.message }));
    return res.status(400).json({ erreur: 'Données invalides.', details });
  }
  if (err instanceof ErreurApp) {
    return res.status(err.statut).json({ erreur: err.message, ...(err.details ? err.details : {}) });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erreur: 'JSON invalide.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ erreur: 'Requête trop volumineuse.' });
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ erreur: 'Erreur interne du serveur.' });
}
