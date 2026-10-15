// Assemblage de l'application Express : sécurité HTTP, routes API et fichiers statiques.
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import { gestionnaireErreurs, routeInconnue } from './presentation/middlewares/erreurs.js';
import { protegerCsrf } from './presentation/middlewares/securite.js';
import adminRoutes from './presentation/routes/admin.js';
import authRoutes from './presentation/routes/auth.js';
import reservationRoutes from './presentation/routes/reservations.js';
import ressourceRoutes from './presentation/routes/ressources.js';

const dossierPublic = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function creerApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

  // En-têtes de sécurité : CSP stricte (aucun script ni style inline), pas d'iframe, HSTS en production.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: config.enProduction ? [] : null
        }
      },
      strictTransportSecurity: config.enProduction
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ statut: 'ok' }));

  if (!config.enTest) {
    // Limitation de débit : freine le brute-force et le scraping
    app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
    app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
      message: { erreur: 'Trop de tentatives, réessayez plus tard.' } }));
  }

  app.use('/api', protegerCsrf);
  app.use('/api', authRoutes);
  app.use('/api/ressources', ressourceRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', routeInconnue);

  app.use(express.static(dossierPublic, { maxAge: config.enProduction ? '1d' : 0, etag: true }));
  app.use(gestionnaireErreurs);
  return app;
}
