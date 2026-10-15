// Espace personnel : quota, réservations à venir et passées, modification / annulation, notifications, droits RGPD.
import { api } from '../api.js';
import { annoncer, champ, h, messageErreur, remplacer, selectChamp } from '../dom.js';
import { confirmer, dialogue } from '../dialogue.js';
import { session } from '../etat.js';
import { cle, enMinutes, formaterDateHeure, hhmm, local, STATUTS, versUtc } from '../temps.js';

const badge = (statut) => h('span', { class: `badge badge-${statut}` }, STATUTS[statut]);
const DELAI_MODIF_MS = 24 * 3600 * 1000;

function carteQuota(q) {
  return h('section', { class: 'carte', 'aria-labelledby': 'titre-quota' },
    h('h2', { id: 'titre-quota' }, 'Mon quota'),
    h('p', {}, `Profil : ${q.profil}. Réservations actives : ${q.reservations_actives} sur ${q.reservations_max} (${q.reservations_restantes} restante(s)).`),
    h('label', { for: 'jauge-quota', class: 'sr-only' }, 'Quota utilisé'),
    h('progress', { id: 'jauge-quota', class: 'jauge', value: q.reservations_actives, max: q.reservations_max }),
    h('p', { class: 'doux' }, `Durée maximale : ${q.duree_max_minutes} minutes par réservation · réservation possible jusqu'à ${q.delai_max_jours} jours à l'avance.`));
}

async function modifier(r, recharger) {
  const dLoc = local(new Date(r.debut));
  const fLoc = local(new Date(new Date(r.fin).getTime() - 1));
  const options = (a, b) => { const o = []; for (let m = a; m <= b; m += 30) o.push({ valeur: hhmm(m), libelle: hhmm(m) }); return o; };
  const ress = await api.get(`/api/ressources/${r.ressource_id}`);
  const date = champ({ label: 'Date', nom: 'date', type: 'date', valeur: cle(dLoc), requis: true });
  const debut = selectChamp({ label: 'Début', nom: 'debut', options: options(enMinutes(ress.heure_ouverture), enMinutes(ress.heure_fermeture) - 30), valeur: hhmm(dLoc.h * 60 + dLoc.min) });
  const fin = selectChamp({ label: 'Fin', nom: 'fin', options: options(enMinutes(ress.heure_ouverture) + 30, enMinutes(ress.heure_fermeture)), valeur: hhmm(fLoc.h * 60 + fLoc.min + 1) });
  const motif = champ({ label: 'Motif', nom: 'motif', valeur: r.motif, maxlength: 300 });
  dialogue({
    titre: `Modifier la réservation de ${r.ressource_nom}`,
    corps: [h('div', { class: 'ligne' }, date.el, debut.el, fin.el), motif.el,
      ress.validation_requise ? h('p', { class: 'doux' }, 'Après modification, la demande repasse en attente de validation.') : null],
    libelleValider: 'Enregistrer',
    onValider: async () => {
      const [a, m, j] = date.input.value.split('-').map(Number);
      const d = enMinutes(debut.select.value);
      const f = enMinutes(fin.select.value);
      await api.put(`/api/reservations/${r.id}`, {
        debut: versUtc(a, m, j, Math.floor(d / 60), d % 60).toISOString(),
        fin: versUtc(a, m, j, Math.floor(f / 60), f % 60).toISOString(), motif: motif.input.value
      });
      annoncer('Réservation modifiée.', 'ok');
      await recharger();
    }
  });
}

function ligneReservation(r, recharger) {
  const active = ['en_attente', 'validee'].includes(r.statut) && new Date(r.fin) > new Date();
  const modifiable = active && new Date(r.debut) - new Date() >= DELAI_MODIF_MS;
  const annulable = active && new Date(r.debut) > new Date();
  return h('tr', {},
    h('td', {}, r.ressource_nom), h('td', {}, formaterDateHeure(r.debut), ' → ', formaterDateHeure(r.fin)),
    h('td', {}, r.motif || '—'),
    h('td', {}, badge(r.statut), r.motif_decision ? h('div', { class: 'doux' }, `Motif : ${r.motif_decision}`) : null),
    h('td', {},
      modifiable ? h('button', { type: 'button', class: 'secondaire petit', onclick: () => modifier(r, recharger).catch((e) => annoncer(messageErreur(e), 'erreur')) },
        'Modifier', h('span', { class: 'sr-only' }, ` ${r.ressource_nom}`)) : null, ' ',
      annulable ? h('button', { type: 'button', class: 'danger petit', onclick: () => confirmer('Annuler la réservation', `Annuler « ${r.ressource_nom} » le ${formaterDateHeure(r.debut)} ?`, async () => {
        await api.post(`/api/reservations/${r.id}/annuler`);
        annoncer('Réservation annulée.', 'ok');
        await recharger();
      }, "Oui, annuler") }, 'Annuler', h('span', { class: 'sr-only' }, ` ${r.ressource_nom}`)) : null));
}

export async function pageMonEspace(conteneur) {
  const zoneQuota = h('div');
  const zoneListe = h('div');
  const zoneNotifs = h('div');
  let periode = 'avenir';

  async function recharger() {
    const [q, liste, notifs] = await Promise.all([api.get('/api/me/quota'), api.get('/api/reservations/mes', { periode }), api.get('/api/me/notifications')]);
    remplacer(zoneQuota, carteQuota(q));
    remplacer(zoneListe, liste.length
      ? h('div', { class: 'defilement' }, h('table', {}, h('caption', {}, periode === 'avenir' ? 'Réservations à venir' : 'Réservations passées'),
        h('thead', {}, h('tr', {}, ['Ressource', 'Créneau', 'Motif', 'Statut', 'Actions'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, liste.map((r) => ligneReservation(r, recharger)))))
      : h('p', {}, 'Aucune réservation.'));
    remplacer(zoneNotifs, notifs.length
      ? h('ul', {}, notifs.slice(0, 10).map((n) => h('li', {}, h('time', { datetime: n.cree_le }, formaterDateHeure(n.cree_le)), ' — ', n.message, n.lue ? null : h('strong', {}, ' (nouveau)'))))
      : h('p', {}, 'Aucune notification.'));
    if (notifs.some((n) => !n.lue)) api.post('/api/me/notifications/lues').catch(() => {});
  }

  const onglet = (id, libelle) => h('button', { type: 'button', class: 'secondaire', 'aria-pressed': String(periode === id), onclick: async () => { periode = id; await recharger(); majOnglets(); } }, libelle);
  const onglets = h('div', { class: 'onglets', role: 'group', 'aria-label': 'Période' });
  const majOnglets = () => remplacer(onglets, onglet('avenir', 'À venir'), onglet('passe', 'Passées'));
  majOnglets();

  const exporter = h('button', { type: 'button', class: 'secondaire', onclick: async () => {
    try {
      const donnees = await api.get('/api/me/export');
      const lien = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' })), download: 'mes-donnees.json' });
      document.body.append(lien); lien.click(); lien.remove();
    } catch (e) { annoncer(messageErreur(e), 'erreur'); }
  } }, 'Télécharger mes données (JSON)');
  const supprimer = h('button', { type: 'button', class: 'danger', onclick: () => confirmer('Supprimer mon compte',
    'Votre compte sera anonymisé de façon définitive : vous ne pourrez plus vous connecter. Vos réservations passées sont conservées sans lien avec votre identité.', async () => {
      await api.delete('/api/me');
      session.utilisateur = null;
      annoncer('Votre compte a été supprimé.', 'ok');
      location.hash = '#/connexion';
    }, 'Supprimer définitivement') }, 'Supprimer mon compte');

  remplacer(conteneur,
    h('h1', {}, 'Mon espace'), zoneQuota,
    h('section', { 'aria-labelledby': 'titre-res' }, h('h2', { id: 'titre-res' }, 'Mes réservations'), onglets, zoneListe),
    h('section', { 'aria-labelledby': 'titre-notif', class: 'carte' }, h('h2', { id: 'titre-notif' }, 'Notifications'), zoneNotifs),
    h('section', { 'aria-labelledby': 'titre-rgpd', class: 'carte' }, h('h2', { id: 'titre-rgpd' }, 'Mes données personnelles (RGPD)'),
      h('p', {}, 'Vous pouvez obtenir une copie de vos données ou demander leur suppression.'), h('div', { class: 'ligne' }, exporter, supprimer)));
  await recharger();
}
