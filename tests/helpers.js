// Aide pour les tests d'intégration et de sécurité : base dédiée aux tests, jeu de données et client HTTP.
import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import { initialiserBase } from '../scripts/init-db.js';
import { localVersUtc } from '../src/utils/temps.js';

export const MDP = 'Test-Passw0rd1';
const NOM_BASE = 'reservation_test';

// Les tests tournent sur leur propre base PostgreSQL et leur propre base MongoDB : jamais sur les données de développement.
const urlAdminDefaut = process.env.DATABASE_ADMIN_URL || 'postgres://postgres:postgres_dev@localhost:5432/reservation';
const urlApp = new URL(process.env.DATABASE_URL || 'postgres://resa_app:resa_app_dev@localhost:5432/reservation');
const urlAdminTest = new URL(urlAdminDefaut);
urlAdminTest.pathname = `/${NOM_BASE}`;
urlApp.pathname = `/${NOM_BASE}`;

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = urlApp.toString();
process.env.MONGO_DB = 'reservation_audit_test';
process.env.JWT_SECRET ||= 'secret-de-test-uniquement';
process.env.LOGIN_MAX_ATTEMPTS = '5';

let admin;
let app;

export async function preparer() {
  const defaut = new pg.Client({ connectionString: urlAdminDefaut });
  await defaut.connect();
  const { rowCount } = await defaut.query('SELECT 1 FROM pg_database WHERE datname = $1', [NOM_BASE]);
  if (!rowCount) await defaut.query(`CREATE DATABASE ${NOM_BASE}`);
  await defaut.end();

  await initialiserBase({ adminUrl: urlAdminTest.toString(), appUrl: urlApp.toString(), appPassword: decodeURIComponent(urlApp.password) });
  admin = new pg.Client({ connectionString: urlAdminTest.toString() });
  await admin.connect();
  await nettoyer();
  const { creerApp } = await import('../src/app.js');
  app = creerApp();
  return app;
}

export async function nettoyer() {
  await admin.query('TRUNCATE reservations, notifications, ressources, utilisateurs RESTART IDENTITY CASCADE');
  // Les profils de quota sont des données de référence : on les remet à leurs valeurs initiales
  await admin.query(`UPDATE profils_quota SET max_reservations_actives = v.m, duree_max_minutes = v.d, delai_max_jours = v.j
    FROM (VALUES ('eleve', 3, 120, 14), ('personnel', 5, 240, 30), ('enseignant', 10, 480, 60)) AS v(code, m, d, j)
    WHERE profils_quota.code = v.code`);
  const { getAuditCollection } = await import('../src/db/mongo.js');
  await (await getAuditCollection()).deleteMany({});
}

export async function terminer() {
  await admin?.end();
  const { fermerPostgres } = await import('../src/db/postgres.js');
  const { fermerMongo } = await import('../src/db/mongo.js');
  await fermerPostgres();
  await fermerMongo();
}

export const sql = (texte, params) => admin.query(texte, params);

export async function creerUtilisateur({ email, role = 'utilisateur', profil = 'enseignant', prenom = 'Test', nom = 'Utilisateur' }) {
  const hash = await bcrypt.hash(MDP, 4);
  const { rows } = await admin.query(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, prenom, nom, role, profil_quota_id)
     VALUES ($1, $2, $3, $4, $5, (SELECT id FROM profils_quota WHERE code = $6)) RETURNING id, email, role`,
    [email, hash, prenom, nom, role, profil]
  );
  return rows[0];
}

export async function creerRessource(surcharge = {}) {
  const r = { nom: `Ressource ${Math.random().toString(36).slice(2, 8)}`, type: 'salle', capacite: 10, ouverture: '08:00', fermeture: '19:00',
    validation: false, responsable: null, ...surcharge };
  const { rows } = await admin.query(
    `INSERT INTO ressources (nom, type, capacite, heure_ouverture, heure_fermeture, validation_requise, responsable_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nom`,
    [r.nom, r.type, r.capacite, r.ouverture, r.fermeture, r.validation, r.responsable]
  );
  return rows[0];
}

// Client HTTP connecté : conserve les cookies et ajoute automatiquement le jeton CSRF.
export async function client(email = null) {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/csrf')).body.csrf;
  const c = {
    agent, csrf,
    get: (url) => agent.get(url),
    post: (url, corps = {}) => agent.post(url).set('X-CSRF-Token', csrf).send(corps),
    put: (url, corps = {}) => agent.put(url).set('X-CSRF-Token', csrf).send(corps),
    patch: (url, corps = {}) => agent.patch(url).set('X-CSRF-Token', csrf).send(corps),
    delete: (url) => agent.delete(url).set('X-CSRF-Token', csrf)
  };
  if (email) {
    const r = await c.post('/api/auth/login', { email, mot_de_passe: MDP });
    if (r.status !== 200) throw new Error(`Connexion de test impossible pour ${email} : ${r.status}`);
  }
  return c;
}

// Créneau dans N jours à une heure locale de Paris : { debut, fin } en ISO
export function creneau(joursPlusTard, heure, dureeMinutes = 60, minute = 0) {
  const base = new Date(Date.now() + joursPlusTard * 86400000);
  const debut = localVersUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), heure, minute, 'Europe/Paris');
  return { debut: debut.toISOString(), fin: new Date(debut.getTime() + dureeMinutes * 60000).toISOString() };
}
