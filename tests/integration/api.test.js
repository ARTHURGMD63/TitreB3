// Tests d'intégration : API complète avec PostgreSQL et MongoDB réels.
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { client, creerRessource, creerUtilisateur, creneau, MDP, nettoyer, preparer, sql, terminer } from '../helpers.js';

let eleve, prof, resp, admin;

before(async () => { await preparer(); });
after(async () => { await terminer(); });
beforeEach(async () => {
  await nettoyer();
  eleve = await creerUtilisateur({ email: 'eleve@test.fr', profil: 'eleve' });
  prof = await creerUtilisateur({ email: 'prof@test.fr', profil: 'enseignant' });
  resp = await creerUtilisateur({ email: 'resp@test.fr', role: 'responsable', profil: 'personnel' });
  admin = await creerUtilisateur({ email: 'admin@test.fr', role: 'admin', profil: 'personnel' });
});

describe('Authentification', () => {
  it("inscrit un utilisateur avec le profil par défaut et stocke un mot de passe haché", async () => {
    const c = await client();
    const r = await c.post('/api/auth/register', { email: 'Nouveau@Test.fr', mot_de_passe: 'Abcdefghi1', prenom: 'Nina', nom: 'Neuf' });
    assert.equal(r.status, 201);
    const { rows } = await sql("SELECT u.*, p.code FROM utilisateurs u JOIN profils_quota p ON p.id = u.profil_quota_id WHERE email = 'nouveau@test.fr'");
    assert.equal(rows[0].code, 'eleve');
    assert.equal(rows[0].role, 'utilisateur');
    assert.match(rows[0].mot_de_passe_hash, /^\$2[aby]\$/);
    assert.notEqual(rows[0].mot_de_passe_hash, 'Abcdefghi1');
  });

  it('refuse un email déjà utilisé et un mot de passe faible', async () => {
    const c = await client();
    assert.equal((await c.post('/api/auth/register', { email: 'eleve@test.fr', mot_de_passe: 'Abcdefghi1', prenom: 'a', nom: 'b' })).status, 409);
    assert.equal((await c.post('/api/auth/register', { email: 'x@test.fr', mot_de_passe: 'faible', prenom: 'a', nom: 'b' })).status, 400);
  });

  it('connecte, donne le profil puis déconnecte', async () => {
    const c = await client('prof@test.fr');
    const me = await c.get('/api/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.utilisateur.email, 'prof@test.fr');
    assert.equal((await c.post('/api/auth/logout')).status, 204);
    assert.equal((await c.get('/api/me')).status, 401);
  });

  it('refuse un mauvais mot de passe avec un message neutre', async () => {
    const c = await client();
    const mauvais = await c.post('/api/auth/login', { email: 'prof@test.fr', mot_de_passe: 'Mauvais-mdp1' });
    const inconnu = await c.post('/api/auth/login', { email: 'inconnu@test.fr', mot_de_passe: 'Mauvais-mdp1' });
    assert.equal(mauvais.status, 401);
    assert.equal(inconnu.status, 401);
    assert.equal(mauvais.body.erreur, inconnu.body.erreur);
  });

  it('verrouille le compte après 5 échecs, même avec le bon mot de passe', async () => {
    const c = await client();
    for (let i = 0; i < 5; i++) await c.post('/api/auth/login', { email: 'eleve@test.fr', mot_de_passe: 'Mauvais-mdp1' });
    const r = await c.post('/api/auth/login', { email: 'eleve@test.fr', mot_de_passe: MDP });
    assert.equal(r.status, 423);
    await sql("UPDATE utilisateurs SET verrouille_jusqua = now() - interval '1 minute' WHERE email = 'eleve@test.fr'");
    assert.equal((await c.post('/api/auth/login', { email: 'eleve@test.fr', mot_de_passe: MDP })).status, 200);
  });

  it('réinitialise le mot de passe avec un jeton valide, à usage unique', async () => {
    const crypto = await import('node:crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await sql("UPDATE utilisateurs SET reset_token_hash = $1, reset_expire_le = now() + interval '1 hour' WHERE email = 'eleve@test.fr'", [hash]);
    const c = await client();
    assert.equal((await c.post('/api/auth/reset-password', { token, mot_de_passe: 'Nouveau-Mdp123' })).status, 200);
    assert.equal((await c.post('/api/auth/reset-password', { token, mot_de_passe: 'Autre-Mdp12345' })).status, 400);
    assert.equal((await c.post('/api/auth/login', { email: 'eleve@test.fr', mot_de_passe: 'Nouveau-Mdp123' })).status, 200);
  });

  it("répond de la même façon à une demande de réinitialisation, que le compte existe ou non", async () => {
    const c = await client();
    const a = await c.post('/api/auth/forgot-password', { email: 'eleve@test.fr' });
    const b = await c.post('/api/auth/forgot-password', { email: 'inconnu@test.fr' });
    assert.equal(a.status, 200);
    assert.deepEqual(a.body, b.body);
  });
});

describe('Catalogue des ressources', () => {
  it('filtre par type, capacité et recherche', async () => {
    await creerRessource({ nom: 'Grande salle', type: 'salle', capacite: 50 });
    await creerRessource({ nom: 'Petite salle', type: 'salle', capacite: 4 });
    await creerRessource({ nom: 'Projecteur', type: 'materiel', capacite: 1 });
    const c = await client('eleve@test.fr');
    assert.equal((await c.get('/api/ressources')).body.length, 3);
    assert.deepEqual((await c.get('/api/ressources?type=materiel')).body.map((r) => r.nom), ['Projecteur']);
    assert.deepEqual((await c.get('/api/ressources?capacite_min=20')).body.map((r) => r.nom), ['Grande salle']);
    assert.deepEqual((await c.get('/api/ressources?q=petite')).body.map((r) => r.nom), ['Petite salle']);
  });

  it('indique si une ressource est complète à une date donnée', async () => {
    const r = await creerRessource({ ouverture: '08:00', fermeture: '10:00' });
    const jour = creneau(3, 8, 120);
    const c = await client('prof@test.fr');
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...jour })).status, 201);
    const date = new Date(jour.debut).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
    const liste = await c.get(`/api/ressources?date=${date}`);
    assert.equal(liste.body[0].disponible_ce_jour, false);
    const autre = await c.get(`/api/ressources?date=${new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)}`);
    assert.equal(autre.body[0].disponible_ce_jour, true);
  });

  it("permet à l'administrateur de créer, modifier et désactiver une ressource", async () => {
    const a = await client('admin@test.fr');
    const donnees = { nom: 'Labo', type: 'salle', capacite: 20, localisation: 'B2', equipements: ['Hotte'], heure_ouverture: '08:00', heure_fermeture: '17:00', validation_requise: true, responsable_id: resp.id };
    const cree = await a.post('/api/ressources', donnees);
    assert.equal(cree.status, 201);
    assert.equal(cree.body.responsable_nom, 'Test Utilisateur');
    assert.equal((await a.put(`/api/ressources/${cree.body.id}`, { ...donnees, capacite: 30 })).body.capacite, 30);
    const off = await a.patch(`/api/ressources/${cree.body.id}/activation`, { active: false, motif: 'Maintenance' });
    assert.equal(off.body.active, false);
    const e = await client('eleve@test.fr');
    assert.equal((await e.get('/api/ressources')).body.length, 0); // masquée pour les non-admins
    const r = await e.post('/api/reservations', { ressource_id: cree.body.id, ...creneau(3, 9) });
    assert.equal(r.status, 409);
    assert.match(r.body.erreur, /Maintenance/);
  });

  it("interdit la gestion des ressources aux non-administrateurs", async () => {
    const e = await client('eleve@test.fr');
    assert.equal((await e.post('/api/ressources', { nom: 'X' })).status, 403);
    const r = await client('resp@test.fr');
    assert.equal((await r.post('/api/ressources', { nom: 'X' })).status, 403);
  });
});

describe('Réservations et conflits', () => {
  it('confirme directement une ressource en réservation libre', async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    const rep = await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 9), motif: 'Cours' });
    assert.equal(rep.status, 201);
    assert.equal(rep.body.statut, 'validee');
  });

  it('refuse un créneau qui chevauche et propose des alternatives libres', async () => {
    const r = await creerRessource();
    const c1 = await client('prof@test.fr');
    const c2 = await client('eleve@test.fr');
    await c1.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 9, 60) });
    const rep = await c2.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 9, 60, 30) });
    assert.equal(rep.status, 409);
    assert.equal(rep.body.alternatives.length, 3);
    // Chaque alternative proposée doit être réservable
    const alt = rep.body.alternatives[0];
    assert.equal((await c2.post('/api/reservations', { ressource_id: r.id, debut: alt.debut, fin: alt.fin })).status, 201);
  });

  it('accepte des créneaux contigus (fin = début suivant)', async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 9) })).status, 201);
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 10) })).status, 201);
  });

  it('libère le créneau après annulation', async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    const cree = await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 9) });
    assert.equal((await c.post(`/api/reservations/${cree.body.id}/annuler`)).body.statut, 'annulee');
    assert.equal((await (await client('eleve@test.fr')).post('/api/reservations', { ressource_id: r.id, ...creneau(2, 9) })).status, 201);
  });

  it('garantit un seul gagnant en cas de réservations simultanées (contrainte PostgreSQL)', async () => {
    const r = await creerRessource();
    const clients = await Promise.all([client('prof@test.fr'), client('eleve@test.fr'), client('resp@test.fr'), client('admin@test.fr')]);
    const slot = creneau(2, 14);
    const reponses = await Promise.all(clients.map((c) => c.post('/api/reservations', { ressource_id: r.id, ...slot })));
    const statuts = reponses.map((x) => x.status).sort();
    assert.deepEqual(statuts, [201, 409, 409, 409]);
    const { rows } = await sql("SELECT count(*)::int AS n FROM reservations WHERE statut IN ('validee','en_attente')");
    assert.equal(rows[0].n, 1);
  });

  it("la base refuse elle-même un chevauchement, même en contournant l'application", async () => {
    const r = await creerRessource();
    const s = creneau(2, 9);
    await sql("INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, statut) VALUES ($1, $2, $3, $4, 'validee')", [r.id, prof.id, s.debut, s.fin]);
    await assert.rejects(
      sql("INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, statut) VALUES ($1, $2, $3, $4, 'en_attente')", [r.id, eleve.id, s.debut, s.fin]),
      (err) => err.code === '23P01'
    );
  });

  it('refuse les créneaux invalides (passé, hors horaires, durée négative)', async () => {
    const r = await creerRessource({ ouverture: '09:00', fermeture: '17:00' });
    const c = await client('prof@test.fr');
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(-1, 10) })).status, 400);
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 7) })).status, 400);
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 16, 120) })).status, 400);
    const { debut } = creneau(2, 10);
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, debut, fin: debut })).status, 400);
    assert.equal((await c.post('/api/reservations', { ressource_id: 99999, ...creneau(2, 10) })).status, 404);
  });
});

describe('Quotas', () => {
  it('limite le nombre de réservations actives du profil élève (3)', async () => {
    const r = await creerRessource();
    const c = await client('eleve@test.fr');
    for (const h of [9, 10, 11]) assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, h) })).status, 201);
    const refus = await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 12) });
    assert.equal(refus.status, 403);
    assert.match(refus.body.erreur, /Quota atteint/);
    const quota = (await c.get('/api/me/quota')).body;
    assert.equal(quota.reservations_restantes, 0);
    assert.equal(quota.reservations_actives, 3);
  });

  it("applique des limites plus élevées à l'enseignant", async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    for (const h of [8, 9, 10, 11, 12]) assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, h) })).status, 201);
  });

  it('refuse une durée supérieure au maximum du profil et un délai trop lointain', async () => {
    const r = await creerRessource();
    const c = await client('eleve@test.fr');
    const long = await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 9, 150) });
    assert.equal(long.status, 403);
    assert.match(long.body.erreur, /Durée trop longue/);
    const loin = await c.post('/api/reservations', { ressource_id: r.id, ...creneau(20, 9) });
    assert.equal(loin.status, 403);
    assert.match(loin.body.erreur, /Trop tôt/);
  });

  it("respecte les quotas modifiés par l'administrateur", async () => {
    const r = await creerRessource();
    const a = await client('admin@test.fr');
    const { rows } = await sql("SELECT id FROM profils_quota WHERE code = 'eleve'");
    assert.equal((await a.patch(`/api/admin/profils-quota/${rows[0].id}`, { max_reservations_actives: 1 })).status, 200);
    const c = await client('eleve@test.fr');
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 9) })).status, 201);
    assert.equal((await c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, 10) })).status, 403);
  });

  it('ne dépasse pas le quota avec des demandes simultanées', async () => {
    const r = await creerRessource();
    const c = await client('eleve@test.fr');
    const reps = await Promise.all([8, 9, 10, 11, 12, 13].map((h) => c.post('/api/reservations', { ressource_id: r.id, ...creneau(2, h) })));
    assert.equal(reps.filter((x) => x.status === 201).length, 3);
  });
});

describe('Workflow de validation', () => {
  let labo;
  beforeEach(async () => { labo = await creerRessource({ nom: 'Labo', validation: true, responsable: resp.id }); });

  it('met la demande en attente, notifie le responsable, puis valide', async () => {
    const e = await client('eleve@test.fr');
    const cree = await e.post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 9) });
    assert.equal(cree.body.statut, 'en_attente');

    const r = await client('resp@test.fr');
    const aTraiter = await r.get('/api/reservations/a-traiter');
    assert.equal(aTraiter.body.length, 1);
    const { rows } = await sql('SELECT type FROM notifications WHERE utilisateur_id = $1', [resp.id]);
    assert.deepEqual(rows.map((x) => x.type), ['demande_recue']);

    const decision = await r.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'validee' });
    assert.equal(decision.body.statut, 'validee');
    const notifs = (await e.get('/api/me/notifications')).body;
    assert.equal(notifs[0].type, 'reservation_validee');
  });

  it('exige un motif pour refuser et prévient le demandeur', async () => {
    const e = await client('eleve@test.fr');
    const cree = await e.post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 9) });
    const r = await client('resp@test.fr');
    assert.equal((await r.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'refusee' })).status, 400);
    const refus = await r.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'refusee', motif: 'Matériel en panne' });
    assert.equal(refus.body.statut, 'refusee');
    assert.equal(refus.body.motif_decision, 'Matériel en panne');
    assert.match((await e.get('/api/me/notifications')).body[0].message, /Matériel en panne/);
    // Le créneau refusé est de nouveau libre
    assert.equal((await (await client('prof@test.fr')).post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 9) })).status, 201);
  });

  it('interdit de décider deux fois et réserve la décision au bon responsable', async () => {
    const e = await client('eleve@test.fr');
    const cree = await e.post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 9) });
    const autre = await creerUtilisateur({ email: 'autre.resp@test.fr', role: 'responsable' });
    const ra = await client(autre.email);
    assert.equal((await ra.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'validee' })).status, 403);
    assert.equal((await e.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'validee' })).status, 403);
    const r = await client('resp@test.fr');
    assert.equal((await r.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'validee' })).status, 200);
    assert.equal((await r.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'refusee', motif: 'x' })).status, 409);
  });

  it("confirme directement la réservation du responsable de la ressource et celle de l'admin", async () => {
    const r = await client('resp@test.fr');
    assert.equal((await r.post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 9) })).body.statut, 'validee');
    const a = await client('admin@test.fr');
    assert.equal((await a.post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 11) })).body.statut, 'validee');
  });

  it('permet au responsable d\'annuler une réservation et notifie le demandeur', async () => {
    const e = await client('prof@test.fr');
    const cree = await e.post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 9) });
    const r = await client('resp@test.fr');
    await r.post(`/api/reservations/${cree.body.id}/decision`, { decision: 'validee' });
    assert.equal((await r.post(`/api/reservations/${cree.body.id}/annuler`)).body.statut, 'annulee');
    assert.equal((await e.get('/api/me/notifications')).body[0].type, 'annulation_responsable');
  });
});

describe('Espace personnel', () => {
  it("modifie une réservation à plus de 24 h, et la remet en attente si la ressource est contrôlée", async () => {
    const libre = await creerRessource();
    const labo = await creerRessource({ validation: true, responsable: resp.id });
    const c = await client('prof@test.fr');
    const a = await c.post('/api/reservations', { ressource_id: libre.id, ...creneau(3, 9) });
    const maj = await c.put(`/api/reservations/${a.body.id}`, { ...creneau(3, 14), motif: 'Décalé' });
    assert.equal(maj.status, 200);
    assert.equal(maj.body.statut, 'validee');
    const b = await client('eleve@test.fr');
    const demande = await b.post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 9) });
    await (await client('resp@test.fr')).post(`/api/reservations/${demande.body.id}/decision`, { decision: 'validee' });
    const apres = await b.put(`/api/reservations/${demande.body.id}`, { ...creneau(3, 15) });
    assert.equal(apres.body.statut, 'en_attente');
  });

  it('refuse la modification à moins de 24 h du début', async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    const proche = new Date(Date.now() + 3 * 3600 * 1000);
    await sql("INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, statut) VALUES ($1, $2, $3, $4, 'validee')",
      [r.id, prof.id, proche, new Date(proche.getTime() + 3600000)]);
    const { rows } = await sql('SELECT id FROM reservations');
    const rep = await c.put(`/api/reservations/${rows[0].id}`, { ...creneau(3, 9) });
    assert.equal(rep.status, 403);
    assert.match(rep.body.erreur, /24 h/);
  });

  it("empêche de modifier à l'intérieur d'un créneau déjà pris", async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    await c.post('/api/reservations', { ressource_id: r.id, ...creneau(3, 9) });
    const b = await c.post('/api/reservations', { ressource_id: r.id, ...creneau(3, 12) });
    assert.equal((await c.put(`/api/reservations/${b.body.id}`, { ...creneau(3, 9, 60, 30) })).status, 409);
  });

  it('liste les réservations à venir et passées séparément', async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    await c.post('/api/reservations', { ressource_id: r.id, ...creneau(3, 9) });
    await sql("INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, statut) VALUES ($1, $2, now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'terminee')", [r.id, prof.id]);
    assert.equal((await c.get('/api/reservations/mes?periode=avenir')).body.length, 1);
    assert.equal((await c.get('/api/reservations/mes?periode=passe')).body.length, 1);
    assert.equal((await c.get('/api/reservations/mes?periode=tous')).body.length, 2);
  });

  it("masque l'identité des autres utilisateurs dans l'occupation d'une ressource", async () => {
    const r = await creerRessource();
    await (await client('prof@test.fr')).post('/api/reservations', { ressource_id: r.id, ...creneau(3, 9) });
    const e = await client('eleve@test.fr');
    const j = new Date(Date.now() + 3 * 86400000);
    const occ = await e.get(`/api/ressources/${r.id}/occupation?du=${new Date(j.getTime() - 86400000).toISOString()}&au=${new Date(j.getTime() + 86400000).toISOString()}`);
    assert.equal(occ.body.length, 1);
    assert.deepEqual(Object.keys(occ.body[0]).sort(), ['a_moi', 'debut', 'fin', 'id', 'statut']);
    assert.equal(occ.body[0].a_moi, false);
  });
});

describe('Tâches planifiées', () => {
  it('termine les réservations passées et envoie un rappel la veille', async () => {
    const r = await creerRessource();
    await sql("INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, statut) VALUES ($1, $2, now() - interval '2 hours', now() - interval '1 hour', 'validee')", [r.id, prof.id]);
    await sql("INSERT INTO reservations (ressource_id, utilisateur_id, debut, fin, statut) VALUES ($1, $2, now() + interval '5 hours', now() + interval '6 hours', 'validee')", [r.id, prof.id]);
    const { executerTachesPlanifiees } = await import('../../src/services/reservationService.js');
    assert.deepEqual(await executerTachesPlanifiees(), { terminees: 1, rappels: 1 });
    assert.deepEqual(await executerTachesPlanifiees(), { terminees: 0, rappels: 0 }); // idempotent
    const { rows } = await sql('SELECT type FROM notifications WHERE utilisateur_id = $1', [prof.id]);
    assert.deepEqual(rows.map((x) => x.type), ['rappel']);
  });
});

describe('Administration et statistiques', () => {
  it("gère les comptes : rôle, profil, désactivation, et empêche l'auto-rétrogradation", async () => {
    const a = await client('admin@test.fr');
    assert.equal((await a.patch(`/api/admin/utilisateurs/${eleve.id}`, { role: 'responsable' })).body.role, 'responsable');
    assert.equal((await a.patch(`/api/admin/utilisateurs/${eleve.id}`, { actif: false })).body.actif, false);
    assert.equal((await (await client()).post('/api/auth/login', { email: 'eleve@test.fr', mot_de_passe: MDP })).status, 401);
    assert.equal((await a.patch(`/api/admin/utilisateurs/${admin.id}`, { role: 'utilisateur' })).status, 409);
    assert.equal((await a.patch(`/api/admin/utilisateurs/${eleve.id}`, { role: 'superadmin' })).status, 400);
    assert.equal((await a.get('/api/admin/utilisateurs')).body.length, 4);
  });

  it("calcule les statistiques d'occupation, de demandes, de saturation et d'annulation", async () => {
    const r1 = await creerRessource({ nom: 'Populaire' });
    const r2 = await creerRessource({ nom: 'Calme' });
    const c = await client('prof@test.fr');
    for (const h of [9, 10, 11]) await c.post('/api/reservations', { ressource_id: r1.id, ...creneau(1, h) });
    const annulee = await c.post('/api/reservations', { ressource_id: r2.id, ...creneau(1, 9) });
    await c.post(`/api/reservations/${annulee.body.id}/annuler`);
    await sql("UPDATE reservations SET statut = 'terminee' WHERE ressource_id = $1 AND statut = 'validee'", [r1.id]);

    const a = await client('admin@test.fr');
    const du = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const au = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const s = (await a.get(`/api/admin/stats?du=${du}&au=${au}`)).body;
    assert.equal(s.plus_demandees[0].nom, 'Populaire');
    assert.equal(s.plus_demandees[0].nb_demandes, 3);
    assert.equal(s.occupation.find((o) => o.nom === 'Populaire').minutes_reservees, 180);
    assert.equal(s.annulations.nb_annulations, 1);
    assert.equal(s.annulations.nb_total, 4);
    assert.ok(s.creneaux_satures.length > 0);
    assert.ok(s.statuts.some((x) => x.statut === 'terminee' && x.nb === 3));
  });
});

describe("Journal d'audit (MongoDB)", () => {
  it('enregistre connexion, réservation et décision avec avant/après', async () => {
    const labo = await creerRessource({ validation: true, responsable: resp.id });
    const e = await client('eleve@test.fr');
    const cree = await e.post('/api/reservations', { ressource_id: labo.id, ...creneau(3, 9) });
    await (await client('resp@test.fr')).post(`/api/reservations/${cree.body.id}/decision`, { decision: 'validee' });
    await e.post(`/api/reservations/${cree.body.id}/annuler`);

    const a = await client('admin@test.fr');
    const { elements, total } = (await a.get('/api/admin/audit')).body;
    const actions = elements.map((x) => x.action);
    for (const attendu of ['CONNEXION', 'RESERVATION_CREEE', 'RESERVATION_VALIDEE', 'RESERVATION_ANNULEE']) assert.ok(actions.includes(attendu), attendu);
    assert.ok(total >= 5);
    const validation = elements.find((x) => x.action === 'RESERVATION_VALIDEE');
    assert.equal(validation.avant.statut, 'en_attente');
    assert.equal(validation.apres.statut, 'validee');
    assert.equal(validation.acteur_id, resp.id);
    assert.ok(validation.ip);
    // Filtre par acteur
    const filtre = (await a.get(`/api/admin/audit?acteur_id=${resp.id}&action=RESERVATION_VALIDEE`)).body;
    assert.equal(filtre.total, 1);
  });

  it("trace les échecs de connexion et les changements de droits, et reste réservé à l'admin", async () => {
    const c = await client();
    await c.post('/api/auth/login', { email: 'eleve@test.fr', mot_de_passe: 'Mauvais-mdp1' });
    const a = await client('admin@test.fr');
    await a.patch(`/api/admin/utilisateurs/${eleve.id}`, { role: 'responsable' });
    const { elements } = (await a.get('/api/admin/audit')).body;
    assert.ok(elements.some((x) => x.action === 'CONNEXION_ECHEC' && x.acteur_id === eleve.id));
    const modif = elements.find((x) => x.action === 'UTILISATEUR_MODIFIE');
    assert.equal(modif.avant.role, 'utilisateur');
    assert.equal(modif.apres.role, 'responsable');
    assert.equal((await (await client('eleve@test.fr')).get('/api/admin/audit')).status, 403);
  });
});

describe('RGPD', () => {
  it('exporte les données personnelles (droit d\'accès)', async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    await c.post('/api/reservations', { ressource_id: r.id, ...creneau(3, 9), motif: 'Cours' });
    const exp = await c.get('/api/me/export');
    assert.equal(exp.status, 200);
    assert.equal(exp.body.profil.email, 'prof@test.fr');
    assert.equal(exp.body.reservations.length, 1);
    assert.ok(exp.body.journal.length >= 2);
    assert.equal('mot_de_passe_hash' in exp.body.profil, false);
  });

  it("anonymise le compte à la suppression (droit à l'effacement) mais conserve les réservations", async () => {
    const r = await creerRessource();
    const c = await client('prof@test.fr');
    await c.post('/api/reservations', { ressource_id: r.id, ...creneau(3, 9) });
    assert.equal((await c.delete('/api/me')).status, 204);
    const { rows } = await sql('SELECT * FROM utilisateurs WHERE id = $1', [prof.id]);
    assert.equal(rows[0].email, `supprime-${prof.id}@anonyme.invalid`);
    assert.equal(rows[0].actif, false);
    assert.ok(rows[0].anonymise_le);
    assert.equal((await sql('SELECT count(*)::int AS n FROM reservations WHERE utilisateur_id = $1', [prof.id])).rows[0].n, 1);
    assert.equal((await (await client()).post('/api/auth/login', { email: 'prof@test.fr', mot_de_passe: MDP })).status, 401);
    const { getAuditCollection } = await import('../../src/db/mongo.js');
    const col = await getAuditCollection();
    assert.equal(await col.countDocuments({ acteur_id: prof.id, ip: { $exists: true, $ne: null } }), 0);
  });
});

describe('Santé et routes inconnues', () => {
  it('répond sur /api/health et renvoie 404 JSON pour une route inconnue', async () => {
    const c = await client();
    assert.equal((await c.get('/api/health')).body.statut, 'ok');
    const r = await c.get('/api/inexistant');
    assert.equal(r.status, 404);
    assert.equal(r.body.erreur, 'Route introuvable.');
  });
});
