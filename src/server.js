// Point d'entrée : démarre le serveur HTTP et les tâches planifiées.
import config from './config.js';
import { creerApp } from './app.js';
import { fermerMongo } from './db/mongo.js';
import { fermerPostgres } from './db/postgres.js';
import { executerTachesPlanifiees } from './services/reservationService.js';

const app = creerApp();
const serveur = app.listen(config.port, () => {
  console.log(`Serveur démarré sur ${config.appUrl} (${config.enProduction ? 'production' : 'développement'})`);
});

// Clôture des réservations passées et rappels : toutes les 5 minutes
const minuteur = setInterval(() => {
  executerTachesPlanifiees().catch((err) => console.error('Tâches planifiées en échec :', err.message));
}, 5 * 60 * 1000);

// Arrêt propre (Docker envoie SIGTERM)
async function arreter() {
  clearInterval(minuteur);
  serveur.close(async () => {
    await Promise.allSettled([fermerPostgres(), fermerMongo()]);
    process.exit(0);
  });
}
process.on('SIGTERM', arreter);
process.on('SIGINT', arreter);
