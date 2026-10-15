// Tests unitaires de la validation des saisies (schémas zod).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as s from '../../src/presentation/schemas.js';

describe('Mot de passe', () => {
  it('accepte un mot de passe conforme', () => assert.ok(s.motDePasse.safeParse('Abcdefghi1').success));
  it('refuse trop court, sans majuscule, sans chiffre ou trop long', () => {
    for (const mdp of ['Abc1', 'abcdefghij1', 'ABCDEFGHIJ1', 'Abcdefghijk', `Aa1${'x'.repeat(80)}`]) {
      assert.equal(s.motDePasse.safeParse(mdp).success, false, mdp);
    }
  });
});

describe('Inscription', () => {
  it('normalise l\'email et ignore les champs inconnus (pas de mass assignment)', () => {
    const r = s.inscription.parse({ email: '  Jean@Exemple.FR ', mot_de_passe: 'Abcdefghi1', prenom: 'Jean', nom: 'Dupont', role: 'admin' });
    assert.equal(r.email, 'jean@exemple.fr');
    assert.equal('role' in r, false);
  });
  it('refuse un email invalide', () => {
    assert.equal(s.inscription.safeParse({ email: 'pas-un-email', mot_de_passe: 'Abcdefghi1', prenom: 'a', nom: 'b' }).success, false);
  });
});

describe('Réservation', () => {
  it('convertit les dates ISO et refuse le reste', () => {
    const ok = s.reservation.parse({ ressource_id: 1, debut: '2026-06-02T09:00:00+02:00', fin: '2026-06-02T10:00:00+02:00' });
    assert.ok(ok.debut instanceof Date);
    assert.equal(s.reservation.safeParse({ ressource_id: 1, debut: 'demain', fin: 'après' }).success, false);
    assert.equal(s.reservation.safeParse({ ressource_id: '1; DROP TABLE x', debut: '2026-06-02T09:00:00Z', fin: '2026-06-02T10:00:00Z' }).success, false);
  });
});

describe('Ressource', () => {
  const base = { nom: 'Salle', type: 'salle', capacite: 5, heure_ouverture: '08:00', heure_fermeture: '18:00' };
  it('accepte une ressource valide', () => assert.ok(s.ressource.safeParse(base).success));
  it('refuse une fermeture avant l\'ouverture', () => {
    assert.equal(s.ressource.safeParse({ ...base, heure_fermeture: '07:00' }).success, false);
  });
  it('refuse une URL de photo dangereuse', () => {
    for (const photo_url of ['javascript:alert(1)', 'http://exemple.fr/a.png', 'data:text/html,<script>']) {
      assert.equal(s.ressource.safeParse({ ...base, photo_url }).success, false, photo_url);
    }
    assert.ok(s.ressource.safeParse({ ...base, photo_url: 'https://exemple.fr/a.png' }).success);
  });
});

describe('Filtres', () => {
  it('refuse les objets injectés dans les paramètres de requête (injection NoSQL)', () => {
    assert.equal(s.filtresAudit.safeParse({ acteur_id: { $ne: 1 } }).success, false);
    assert.equal(s.filtresAudit.safeParse({ action: { $regex: '.*' } }).success, false);
  });
  it('refuse une action d\'audit mal formée', () => {
    assert.equal(s.filtresAudit.safeParse({ action: 'drop table;' }).success, false);
  });
});
