// Accès PostgreSQL : pool de connexions, requêtes préparées (paramètres $1, $2...) et transactions.
import pg from 'pg';
import config from '../config.js';

let pool;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10, idleTimeoutMillis: 30000 });
    pool.on('error', (err) => console.error('Erreur inattendue du pool PostgreSQL :', err.message));
  }
  return pool;
}

// Toutes les requêtes passent par ici avec des paramètres : jamais de concaténation de saisies.
export function requete(texte, params = [], client = getPool()) {
  return client.query(texte, params);
}

export async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const resultat = await fn(client);
    await client.query('COMMIT');
    return resultat;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function fermerPostgres() {
  if (pool) await pool.end();
  pool = undefined;
}
