// Tests de sécurité : injections, XSS, CSRF, authentification, contrôle d'accès et en-têtes HTTP.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { client, creerRessource, creerUtilisateur, creneau, MDP, nettoyer, preparer, sql, terminer } from '../helpers.js';

let eleve, prof, admin;

before(async () => { await preparer(); });
after(async () => { await terminer(); });
beforeEach(async () => {
  await nettoyer();
  eleve = await creerUtilisateur({ email: 'eleve@test.fr', profil: 'eleve' });
  prof = await creerUtilisateur({ email: 'prof@test.fr' });
  admin = await creerUtilisateur({ email: 'admin@test.fr', role: 'admin' });
});

describe('Injection SQL', () => {
  const charges = ["' OR '1'='1", "'; DROP TABLE utilisateurs; --", "' UNION SELECT mot_de_passe_hash FROM utilisateurs --", '1; SELECT pg_sleep(5)'];

  it('ne permet pas de contourner la connexion', async () => {
    const c = await client();
    for (const p of charges) {
      const r = await c.post('/api/auth/login', { email: `${p}@x.fr`, mot_de_passe: p });
      assert.ok([400, 401].includes(r.status), `${p} -> ${r.status}`);
    }
    assert.equal((await c.post('/api/auth/login', { email: "admin@test.fr' --", mot_de_passe: 'x' })).status, 400);
  });

  it('traite les filtres de recherche comme des données, jamais comme du SQL', async () => {
    await creerRessource({ nom: 'Salle A' });
    const c = await client('eleve@test.fr');
    for (const p of charges) {
      const r = await c.get(`/api/ressources?q=${encodeURIComponent(p)}`);
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, []);
    }
    assert.equal((await sql('SELECT count(*)::int AS n FROM utilisateurs')).rows[0].n, 3); // la table existe toujours
    // Les jokers LIKE sont échappés : "%" ne renvoie pas tout
    assert.deepEqual((await c.get('/api/ressources?q=%25')).body, []);
  });

  it('rejette les identifiants et paramètres numériques non conformes', async () => {
    const c = await client('admin@test.fr');
    assert.equal((await c.get('/api/ressources/1;DROP TABLE x')).status, 400);
    assert.equal((await c.get('/api/ressources?capacite_min=1 OR 1=1')).status, 400);
    assert.equal((await c.get("/api/admin/stats?du=2026-01-01'--&au=2026-02-01")).status, 400);
    assert.equal((await c.post('/api/reservations', { ressource_id: '1 OR 1=1', debut: 'x', fin: 'y' })).status, 400);
  });
});

describe('Injection NoSQL (MongoDB)', () => {
  it("refuse les opérateurs injectés dans les filtres d'audit", async () => {
    const c = await client('admin@test.fr');
    assert.equal((await c.get('/api/admin/audit?acteur_id[$ne]=1')).status, 400);
    assert.equal((await c.get('/api/admin/audit?action[$regex]=.*')).status, 400);
    assert.equal((await c.get('/api/admin/audit?entite[$gt]=')).status, 400);
  });

  it("refuse un objet à la place de l'email lors de la connexion", async () => {
    const c = await client();
    assert.equal((await c.post('/api/auth/login', { email: { $ne: null }, mot_de_passe: { $ne: null } })).status, 400);
  });
});

describe('XSS', () => {
  it('stocke les saisies telles quelles et les renvoie en JSON (jamais interprétées comme du HTML)', async () => {
    const c = await client();
    const charge = '<img src=x onerror=alert(1)>';
    await c.post('/api/auth/register', { email: 'xss@test.fr', mot_de_passe: 'Abcdefghi1', prenom: charge, nom: 'Test' });
    const l = await c.post('/api/auth/login', { email: 'xss@test.fr', mot_de_passe: 'Abcdefghi1' });
    assert.equal(l.status, 200);
    assert.match(l.headers['content-type'], /application\/json/);
    assert.equal(l.body.utilisateur.prenom, charge);
    assert.equal(l.headers['x-content-type-options'], 'nosniff');
  });

  it('applique une Content-Security-Policy stricte (pas de script ni de style inline)', async () => {
    const c = await client();
    const csp = (await c.get('/')).headers['content-security-policy'];
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /style-src 'self'(;|$)/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  });

  it("n'utilise aucune API dangereuse (v-html, innerHTML, eval, styles ou scripts inline) dans l'interface Vue", async () => {
    const racine = path.join(import.meta.dirname, '..', '..', 'client');
    const fichiers = [];
    async function parcourir(dossier) {
      for (const e of await readdir(dossier, { withFileTypes: true })) {
        const chemin = path.join(dossier, e.name);
        if (e.isDirectory()) { if (e.name !== 'dist' && e.name !== 'node_modules') await parcourir(chemin); }
        else if (/\.(js|vue|html)$/.test(e.name)) fichiers.push(chemin);
      }
    }
    await parcourir(racine);
    assert.ok(fichiers.length > 20);
    for (const f of fichiers) {
      const contenu = await readFile(f, 'utf8');
      assert.doesNotMatch(contenu, /v-html|innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/, f);
      // La CSP interdit les attributs style et les gestionnaires inline
      if (/\.(vue|html)$/.test(f)) assert.doesNotMatch(contenu, /\son(click|load|error|mouseover)="|\sstyle="/i, `${f} contient un gestionnaire ou un style inline`);
    }
    const index = await readFile(path.join(racine, 'index.html'), 'utf8');
    assert.doesNotMatch(index, /<script(?![^>]*\bsrc=)/i, 'index.html contient un script inline');
  });
});

describe('CSRF', () => {
  it('refuse une requête modifiante sans jeton, avec un mauvais jeton ou depuis une autre origine', async () => {
    const c = await client('prof@test.fr');
    const r = await creerRessource();
    const corps = { ressource_id: r.id, ...creneau(2, 9) };
    assert.equal((await c.agent.post('/api/reservations').send(corps)).status, 403);
    assert.equal((await c.agent.post('/api/reservations').set('X-CSRF-Token', 'faux').send(corps)).status, 403);
    assert.equal((await c.agent.post('/api/reservations').set('X-CSRF-Token', c.csrf).set('Origin', 'https://site-malveillant.example').send(corps)).status, 403);
    assert.equal((await c.post('/api/reservations', corps)).status, 201); // avec le bon jeton, tout fonctionne
  });

  it('protège aussi la connexion et la suppression de compte', async () => {
    const c = await client('prof@test.fr');
    assert.equal((await c.agent.delete('/api/me')).status, 403);
    assert.equal((await c.agent.post('/api/auth/logout')).status, 403);
  });

  it('pose des cookies HttpOnly et SameSite=Strict pour la session', async () => {
    const c = await client();
    const r = await c.post('/api/auth/login', { email: 'prof@test.fr', mot_de_passe: MDP });
    const cookie = r.headers['set-cookie'].find((x) => x.startsWith('token='));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
  });
});

describe('Authentification et jetons', () => {
  it('refuse l\'accès aux routes protégées sans session', async () => {
    const c = await client();
    for (const url of ['/api/me', '/api/ressources', '/api/reservations/mes', '/api/admin/utilisateurs', '/api/admin/audit', '/api/me/export']) {
      assert.equal((await c.get(url)).status, 401, url);
    }
  });

  it('refuse un jeton falsifié, non signé (alg=none) ou expiré', async () => {
    const c = await client();
    const secret = process.env.JWT_SECRET;
    const faux = jwt.sign({ sub: admin.id, role: 'admin' }, 'mauvais-secret');
    const sansSignature = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: admin.id, role: 'admin' })).toString('base64url')}.`;
    const expire = jwt.sign({ sub: admin.id, role: 'admin' }, secret, { expiresIn: -10 });
    for (const jeton of [faux, sansSignature, expire, 'nimportequoi']) {
      assert.equal((await c.agent.get('/api/me').set('Cookie', `token=${jeton}`)).status, 401);
    }
    const valide = jwt.sign({ sub: admin.id, role: 'admin' }, secret);
    assert.equal((await c.agent.get('/api/me').set('Cookie', `token=${valide}`)).status, 200);
  });

  it('ne fait pas confiance au rôle contenu dans le jeton : il est relu en base', async () => {
    const c = await client();
    const jeton = jwt.sign({ sub: eleve.id, role: 'admin' }, process.env.JWT_SECRET);
    assert.equal((await c.agent.get('/api/admin/utilisateurs').set('Cookie', `token=${jeton}`)).status, 403);
  });

  it('invalide immédiatement la session d\'un compte désactivé', async () => {
    const c = await client('prof@test.fr');
    assert.equal((await c.get('/api/me')).status, 200);
    await sql('UPDATE utilisateurs SET actif = FALSE WHERE id = $1', [prof.id]);
    assert.equal((await c.get('/api/me')).status, 401);
  });

  it('ne divulgue jamais le hash du mot de passe', async () => {
    const c = await client('prof@test.fr');
    const corps = JSON.stringify([(await c.get('/api/me')).body, (await c.get('/api/me/export')).body]);
    assert.doesNotMatch(corps, /mot_de_passe|\$2[aby]\$|reset_token/);
    const a = await client('admin@test.fr');
    assert.doesNotMatch(JSON.stringify((await a.get('/api/admin/utilisateurs')).body), /mot_de_passe|\$2[aby]\$/);
  });
});

describe("Contrôle d'accès", () => {
  it("empêche l'escalade de privilèges à l'inscription (mass assignment)", async () => {
    const c = await client();
    await c.post('/api/auth/register', { email: 'pirate@test.fr', mot_de_passe: 'Abcdefghi1', prenom: 'P', nom: 'P', role: 'admin', profil_quota_id: 3, actif: true });
    const { rows } = await sql("SELECT role FROM utilisateurs WHERE email = 'pirate@test.fr'");
    assert.equal(rows[0].role, 'utilisateur');
  });

  it("réserve l'administration aux administrateurs", async () => {
    const e = await client('eleve@test.fr');
    assert.equal((await e.patch(`/api/admin/utilisateurs/${eleve.id}`, { role: 'admin' })).status, 403);
    assert.equal((await e.get('/api/admin/stats?du=2026-01-01&au=2026-02-01')).status, 403);
    assert.equal((await e.patch('/api/admin/profils-quota/1', { max_reservations_actives: 99 })).status, 403);
    assert.equal((await e.get('/api/reservations/a-traiter')).status, 403);
    const { rows } = await sql('SELECT role FROM utilisateurs WHERE id = $1', [eleve.id]);
    assert.equal(rows[0].role, 'utilisateur');
  });

  it("refuse les champs inconnus lors d'une modification de compte par l'administrateur", async () => {
    const a = await client('admin@test.fr');
    assert.equal((await a.patch(`/api/admin/utilisateurs/${eleve.id}`, { mot_de_passe_hash: 'x' })).status, 400);
  });

  it("empêche d'accéder, modifier ou annuler la réservation d'un autre utilisateur (IDOR)", async () => {
    const r = await creerRessource();
    const proprio = await client('prof@test.fr');
    const cree = await proprio.post('/api/reservations', { ressource_id: r.id, ...creneau(3, 9) });
    const intrus = await client('eleve@test.fr');
    assert.equal((await intrus.post(`/api/reservations/${cree.body.id}/annuler`)).status, 404);
    assert.equal((await intrus.put(`/api/reservations/${cree.body.id}`, creneau(3, 14))).status, 404);
    assert.equal((await intrus.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'validee' })).status, 403);
    assert.equal((await intrus.get('/api/reservations/mes?periode=tous')).body.length, 0);
    const { rows } = await sql('SELECT statut FROM reservations WHERE id = $1', [cree.body.id]);
    assert.equal(rows[0].statut, 'validee');
  });

  it("empêche un administrateur de se retirer ses propres droits", async () => {
    const a = await client('admin@test.fr');
    assert.equal((await a.patch(`/api/admin/utilisateurs/${admin.id}`, { actif: false })).status, 409);
  });
});

describe('En-têtes HTTP et robustesse', () => {
  it('envoie les en-têtes de sécurité et masque la technologie du serveur', async () => {
    const c = await client();
    const r = await c.get('/api/health');
    assert.equal(r.headers['x-powered-by'], undefined);
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(r.headers['referrer-policy']);
    assert.ok(r.headers['cross-origin-opener-policy']);
  });

  it("ne renvoie jamais de trace d'erreur au client", async () => {
    const c = await client('prof@test.fr');
    const r = await c.agent.post('/api/reservations').set('X-CSRF-Token', c.csrf).set('Content-Type', 'application/json').send('{"mauvais json');
    assert.equal(r.status, 400);
    assert.doesNotMatch(JSON.stringify(r.body), /at .*\.js|node_modules|Error:/);
  });

  it('refuse les corps de requête trop volumineux', async () => {
    const c = await client('prof@test.fr');
    const r = await c.post('/api/reservations', { motif: 'x'.repeat(100000) });
    assert.equal(r.status, 413);
  });
});

describe('Base de données : droits du compte applicatif', () => {
  it('interdit au compte applicatif de modifier le schéma ou de supprimer des utilisateurs', async () => {
    const pg = (await import('pg')).default;
    const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await app.connect();
    try {
      await assert.rejects(app.query('DROP TABLE utilisateurs'), (e) => e.code === '42501' || e.code === '42P01' || /propriétaire|owner|permission/i.test(e.message));
      await assert.rejects(app.query('DELETE FROM utilisateurs'), (e) => e.code === '42501');
      await assert.rejects(app.query('TRUNCATE reservations'), (e) => e.code === '42501');
      await assert.rejects(app.query('SELECT * FROM schema_migrations'), (e) => e.code === '42501');
      await app.query('SELECT id FROM utilisateurs LIMIT 1'); // lecture autorisée
    } finally {
      await app.end();
    }
  });
});
