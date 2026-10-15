// Espace du responsable : demandes à traiter (valider / refuser avec motif) et planning de ses ressources.
import { api } from '../api.js';
import { annoncer, champ, h, remplacer } from '../dom.js';
import { dialogue } from '../dialogue.js';
import { formaterDateHeure, STATUTS } from '../temps.js';

export async function pageResponsable(conteneur) {
  const zoneDemandes = h('div');
  const zonePlanning = h('div');

  async function recharger() {
    const maintenant = new Date();
    const [demandes, planning] = await Promise.all([
      api.get('/api/reservations/a-traiter'),
      api.get('/api/reservations/planning', { du: maintenant.toISOString(), au: new Date(maintenant.getTime() + 14 * 86400000).toISOString() })
    ]);
    remplacer(zoneDemandes, demandes.length ? demandes.map((r) => h('article', { class: 'carte', 'aria-label': `Demande de ${r.demandeur_nom}` },
      h('h3', {}, r.ressource_nom),
      h('p', {}, `${r.demandeur_nom} (${r.demandeur_email})`),
      h('p', {}, `${formaterDateHeure(r.debut)} → ${formaterDateHeure(r.fin)}`),
      h('p', {}, `Motif : ${r.motif || '—'}`),
      h('div', { class: 'ligne' },
        h('button', { type: 'button', onclick: async () => {
          try { await api.post(`/api/reservations/${r.id}/decision`, { decision: 'validee' }); annoncer('Demande validée.', 'ok'); await recharger(); }
          catch (e) { annoncer(e.message, 'erreur'); }
        } }, 'Valider', h('span', { class: 'sr-only' }, ` la demande de ${r.demandeur_nom}`)),
        h('button', { type: 'button', class: 'danger', onclick: () => refuser(r, recharger) }, 'Refuser', h('span', { class: 'sr-only' }, ` la demande de ${r.demandeur_nom}`)))))
      : h('p', {}, 'Aucune demande en attente.'));
    remplacer(zonePlanning, planning.length
      ? h('div', { class: 'defilement' }, h('table', {}, h('caption', {}, 'Planning des 14 prochains jours'),
        h('thead', {}, h('tr', {}, ['Ressource', 'Créneau', 'Demandeur', 'Statut', 'Action'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, planning.map((r) => h('tr', {}, h('td', {}, r.ressource_nom), h('td', {}, formaterDateHeure(r.debut), ' → ', formaterDateHeure(r.fin)),
          h('td', {}, r.demandeur_nom), h('td', {}, h('span', { class: `badge badge-${r.statut}` }, STATUTS[r.statut])),
          h('td', {}, h('button', { type: 'button', class: 'danger petit', onclick: async () => {
            try { await api.post(`/api/reservations/${r.id}/annuler`); annoncer('Réservation annulée, le demandeur est prévenu.', 'ok'); await recharger(); }
            catch (e) { annoncer(e.message, 'erreur'); }
          } }, 'Annuler', h('span', { class: 'sr-only' }, ` la réservation de ${r.demandeur_nom}`))))))))
      : h('p', {}, 'Aucune réservation prévue.'));
  }

  remplacer(conteneur, h('h1', {}, 'Espace responsable'),
    h('section', { 'aria-labelledby': 'titre-dem' }, h('h2', { id: 'titre-dem' }, 'Demandes à traiter'), zoneDemandes),
    h('section', { 'aria-labelledby': 'titre-plan' }, h('h2', { id: 'titre-plan' }, 'Planning de mes ressources'), zonePlanning));
  await recharger();
}

function refuser(r, recharger) {
  const motif = champ({ label: 'Motif du refus', nom: 'motif', requis: true, maxlength: 300 });
  dialogue({
    titre: `Refuser la demande de ${r.demandeur_nom}`, corps: [motif.el], libelleValider: 'Refuser', danger: true,
    onValider: async () => {
      await api.post(`/api/reservations/${r.id}/decision`, { decision: 'refusee', motif: motif.input.value });
      annoncer('Demande refusée, le demandeur est prévenu.', 'ok');
      await recharger();
    }
  });
}
