// Initialisation de la base : applique les migrations puis configure les droits du compte applicatif.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dossier = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

export async function initialiserBase({ adminUrl, appUrl, appPassword }) {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (nom TEXT PRIMARY KEY, applique_le TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort();
    for (const fichier of fichiers) {
      const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE nom = $1', [fichier]);
      if (rowCount) continue;
      const sql = await readFile(path.join(dossier, fichier), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [fichier]);
        await client.query('COMMIT');
        console.log(`Migration appliquée : ${fichier}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    await configurerDroits(client, appUrl, appPassword);
  } finally {
    await client.end();
  }
}

// Principe du moindre privilège : le compte de l'application ne peut ni modifier le schéma ni tout supprimer.
async function configurerDroits(client, appUrl, appPassword) {
  const role = new URL(appUrl).username;
  const base = (await client.query('SELECT current_database() AS nom')).rows[0].nom;
  const roleId = client.escapeIdentifier(role);
  const existe = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  const motDePasse = client.escapeLiteral(appPassword);
  if (existe.rowCount) {
    await client.query(`ALTER ROLE ${roleId} LOGIN PASSWORD ${motDePasse}`);
  } else {
    await client.query(`CREATE ROLE ${roleId} LOGIN PASSWORD ${motDePasse} NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  }
  await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${roleId}`);
  await client.query(`GRANT CONNECT ON DATABASE ${client.escapeIdentifier(base)} TO ${roleId}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${roleId}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE ON utilisateurs, ressources, reservations TO ${roleId}`);
  await client.query(`GRANT SELECT, UPDATE ON profils_quota TO ${roleId}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO ${roleId}`);
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${roleId}`);
}

// Exécution directe : node scripts/init-db.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { DATABASE_URL, DATABASE_ADMIN_URL, APP_DB_PASSWORD } = process.env;
  if (!DATABASE_URL || !DATABASE_ADMIN_URL || !APP_DB_PASSWORD) {
    console.error('Variables DATABASE_URL, DATABASE_ADMIN_URL et APP_DB_PASSWORD requises.');
    process.exit(1);
  }
  initialiserBase({ adminUrl: DATABASE_ADMIN_URL, appUrl: DATABASE_URL, appPassword: APP_DB_PASSWORD })
    .then(async () => {
      console.log('Base de données prête.');
      // Données de démonstration uniquement si demandé (jamais en production)
      if (process.env.RUN_SEED === 'true') await (await import('./seed.js')).peupler(DATABASE_ADMIN_URL);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
