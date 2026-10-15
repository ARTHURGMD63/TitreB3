// Tests unitaires des règles métier pures (sans base de données).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { proposerAlternatives, validerCreneau } from '../../src/services/regles/creneaux.js';
import { quotaRestant, verifierQuota } from '../../src/services/regles/quotas.js';
import { exigerTransition, peutGerer, peutTransiter, statutInitial } from '../../src/services/regles/workflow.js';
import { composantesLocales, localVersUtc } from '../../src/utils/temps.js';

const FUSEAU = 'Europe/Paris';
const ressource = { heure_ouverture: '08:00', heure_fermeture: '19:00' };
const maintenant = new Date('2026-06-01T06:00:00Z');
const utc = (iso) => new Date(iso);
// 2026-06-02 : heure d'été (UTC+2). 09:00 locale = 07:00 UTC.
const creneau = (hDebut, hFin) => ({ debut: utc(`2026-06-02T${hDebut}:00Z`), fin: utc(`2026-06-02T${hFin}:00Z`) });
const valider = (c) => validerCreneau({ ...c, ressource, maintenant, fuseau: FUSEAU, pas: 30 });

describe('Fuseau horaire', () => {
  it('convertit une heure locale d\'été et d\'hiver en UTC', () => {
    assert.equal(localVersUtc(2026, 6, 2, 9, 0, FUSEAU).toISOString(), '2026-06-02T07:00:00.000Z');
    assert.equal(localVersUtc(2026, 1, 15, 9, 0, FUSEAU).toISOString(), '2026-01-15T08:00:00.000Z');
  });
  it('décompose un instant en composantes locales', () => {
    assert.deepEqual(composantesLocales(utc('2026-06-02T07:30:00Z'), FUSEAU), { a: 2026, m: 6, j: 2, h: 9, min: 30 });
  });
});

describe('validerCreneau', () => {
  it('accepte un créneau valide dans les horaires', () => {
    assert.doesNotThrow(() => valider(creneau('07:00', '09:00')));
  });
  it('refuse une fin avant le début', () => {
    assert.throws(() => valider(creneau('09:00', '08:00')), /postérieure/);
  });
  it('refuse un créneau dans le passé', () => {
    const passe = { debut: utc('2026-05-31T07:00:00Z'), fin: utc('2026-05-31T08:00:00Z') };
    assert.throws(() => valider(passe), /passé/);
  });
  it('refuse un créneau hors des horaires d\'ouverture', () => {
    assert.throws(() => valider(creneau('05:00', '06:00')), /ouverte de 08:00 à 19:00/); // 07h-08h locale
    assert.throws(() => valider(creneau('16:30', '17:30')), /ouverte/); // 18h30-19h30 locale
  });
  it('refuse un créneau qui chevauche deux jours', () => {
    const c = { debut: utc('2026-06-02T20:00:00Z'), fin: utc('2026-06-03T05:00:00Z') };
    assert.throws(() => valider(c), /même jour/);
  });
  it('refuse des horaires non alignés sur 30 minutes', () => {
    assert.throws(() => valider({ debut: utc('2026-06-02T07:10:00Z'), fin: utc('2026-06-02T08:00:00Z') }), /alignés/);
  });
  it('refuse des dates invalides', () => {
    assert.throws(() => valider({ debut: new Date('x'), fin: new Date('y') }), /invalides/);
  });
});

describe('proposerAlternatives', () => {
  const debutSouhaite = utc('2026-06-02T07:00:00Z'); // 09h00 locale
  const base = { debutSouhaite, dureeMinutes: 60, ressource, maintenant, fuseau: FUSEAU, pas: 30 };

  it('propose des créneaux libres proches, triés par proximité', () => {
    const occupes = [{ debut: '2026-06-02T07:00:00Z', fin: '2026-06-02T08:00:00Z' }];
    const alt = proposerAlternatives({ ...base, occupes });
    assert.equal(alt.length, 3);
    assert.equal(alt[0].debut, '2026-06-02T06:00:00.000Z'); // 08h00-09h00, juste avant
    for (const a of alt) assert.ok(!(new Date(a.debut) < utc('2026-06-02T08:00:00Z') && new Date(a.fin) > utc('2026-06-02T07:00:00Z')));
  });
  it('passe aux jours suivants si la journée est complète', () => {
    const occupes = [{ debut: '2026-06-02T06:00:00Z', fin: '2026-06-02T17:00:00Z' }]; // 08h-19h locale
    const alt = proposerAlternatives({ ...base, occupes });
    assert.equal(alt.length, 3);
    for (const a of alt) assert.ok(a.debut >= '2026-06-03T06:00:00.000Z', a.debut);
  });
  it('ne propose jamais de créneau dans le passé et respecte le maximum demandé', () => {
    const tard = new Date('2026-06-02T12:00:00Z'); // 14h locale : le matin est passé
    const alt = proposerAlternatives({ ...base, occupes: [], maintenant: tard, max: 2 });
    assert.equal(alt.length, 2);
    for (const a of alt) assert.ok(new Date(a.debut) >= tard);
  });
});

describe('verifierQuota', () => {
  const profil = { max_reservations_actives: 3, duree_max_minutes: 120, delai_max_jours: 14, libelle: 'Élève' };
  const debut = utc('2026-06-02T07:00:00Z');
  const fin = utc('2026-06-02T08:00:00Z');

  it('accepte une réservation dans les limites', () => {
    assert.doesNotThrow(() => verifierQuota({ profil, nbActives: 2, debut, fin, maintenant }));
  });
  it('refuse quand le nombre de réservations actives est atteint', () => {
    assert.throws(() => verifierQuota({ profil, nbActives: 3, debut, fin, maintenant }), /Quota atteint/);
  });
  it('refuse une durée trop longue', () => {
    assert.throws(() => verifierQuota({ profil, nbActives: 0, debut, fin: utc('2026-06-02T10:00:01Z'), maintenant }), /Durée trop longue/);
  });
  it('accepte exactement la durée maximale', () => {
    assert.doesNotThrow(() => verifierQuota({ profil, nbActives: 0, debut, fin: utc('2026-06-02T09:00:00Z'), maintenant }));
  });
  it('refuse une réservation trop à l\'avance', () => {
    const loin = utc('2026-07-15T07:00:00Z');
    assert.throws(() => verifierQuota({ profil, nbActives: 0, debut: loin, fin: utc('2026-07-15T08:00:00Z'), maintenant }), /Trop tôt/);
  });
  it('calcule le quota restant', () => {
    const q = quotaRestant({ ...profil, profil_libelle: 'Élève' }, 2);
    assert.equal(q.reservations_restantes, 1);
    assert.equal(quotaRestant(profil, 5).reservations_restantes, 0);
  });
});

describe('Workflow des réservations', () => {
  it('autorise les transitions prévues', () => {
    assert.ok(peutTransiter('en_attente', 'validee'));
    assert.ok(peutTransiter('en_attente', 'refusee'));
    assert.ok(peutTransiter('validee', 'terminee'));
    assert.ok(peutTransiter('validee', 'annulee'));
  });
  it('interdit les transitions depuis un état final', () => {
    for (const final of ['refusee', 'terminee', 'annulee']) {
      assert.equal(peutTransiter(final, 'validee'), false);
      assert.throws(() => exigerTransition(final, 'validee'), /Transition impossible/);
    }
  });
  it('interdit de valider une réservation déjà validée', () => {
    assert.equal(peutTransiter('validee', 'validee'), false);
  });
  it('détermine le statut initial selon la ressource et le demandeur', () => {
    const libre = { validation_requise: false, responsable_id: 9 };
    const controlee = { validation_requise: true, responsable_id: 9 };
    assert.equal(statutInitial(libre, { id: 1, role: 'utilisateur' }), 'validee');
    assert.equal(statutInitial(controlee, { id: 1, role: 'utilisateur' }), 'en_attente');
    assert.equal(statutInitial(controlee, { id: 9, role: 'responsable' }), 'validee');
    assert.equal(statutInitial(controlee, { id: 2, role: 'responsable' }), 'en_attente');
    assert.equal(statutInitial(controlee, { id: 3, role: 'admin' }), 'validee');
  });
  it('limite la gestion au responsable de la ressource ou à l\'admin', () => {
    const r = { responsable_id: 9 };
    assert.ok(peutGerer({ id: 9, role: 'responsable' }, r));
    assert.ok(peutGerer({ id: 1, role: 'admin' }, r));
    assert.equal(peutGerer({ id: 2, role: 'responsable' }, r), false);
    assert.equal(peutGerer({ id: 9, role: 'utilisateur' }, r), false);
  });
});
