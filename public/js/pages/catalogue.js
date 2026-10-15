// Catalogue : liste filtrable des ressources (type, capacité, disponibilité à une date).
import { api } from '../api.js';
import { champ, h, messageErreur, remplacer, selectChamp } from '../dom.js';
import { cle, aujourdhui } from '../temps.js';

export function carteRessource(r) {
  return h('article', { class: 'carte', 'aria-labelledby': `res-${r.id}` },
    r.photo_url ? h('img', { src: r.photo_url, alt: `Photo : ${r.nom}`, loading: 'lazy', width: 240, height: 140 }) : null,
    h('h2', { id: `res-${r.id}` }, r.nom),
    h('p', { class: 'doux' }, `${r.type === 'salle' ? 'Salle' : 'Matériel'} · capacité ${r.capacite} · ${r.localisation || 'lieu non précisé'}`),
    h('p', {}, `Ouvert de ${r.heure_ouverture} à ${r.heure_fermeture}`),
    r.equipements.length ? h('p', {}, `Équipements : ${r.equipements.join(', ')}`) : null,
    h('p', {},
      !r.active ? h('span', { class: 'badge badge-annulee' }, `Indisponible${r.motif_indisponibilite ? ` : ${r.motif_indisponibilite}` : ''}`)
        : r.disponible_ce_jour ? h('span', { class: 'badge badge-validee' }, 'Créneaux disponibles')
          : h('span', { class: 'badge badge-annulee' }, 'Complet ce jour'),
      ' ', r.validation_requise ? h('span', { class: 'badge badge-en_attente' }, 'Validation requise') : null),
    h('a', { class: 'bouton', href: `#/ressource/${r.id}` }, h('span', {}, 'Voir les créneaux'), h('span', { class: 'sr-only' }, ` de ${r.nom}`)));
}

export async function pageCatalogue(conteneur) {
  const type = selectChamp({ label: 'Type', nom: 'type', options: [{ valeur: '', libelle: 'Tous' }, { valeur: 'salle', libelle: 'Salles' }, { valeur: 'materiel', libelle: 'Matériel' }] });
  const capacite = champ({ label: 'Capacité minimale', nom: 'capacite_min', type: 'number', min: 1, max: 1000 });
  const date = champ({ label: 'Disponible le', nom: 'date', type: 'date', valeur: cle(aujourdhui()) });
  const recherche = champ({ label: 'Recherche', nom: 'q', type: 'search', maxlength: 80 });
  const resultats = h('div', { class: 'grille', 'aria-live': 'polite' });
  const compteur = h('p', { role: 'status' });

  async function charger() {
    try {
      const liste = await api.get('/api/ressources', {
        type: type.select.value, capacite_min: capacite.input.value, date: date.input.value, q: recherche.input.value
      });
      compteur.textContent = `${liste.length} ressource(s) trouvée(s).`;
      remplacer(resultats, liste.map(carteRessource));
    } catch (err) {
      compteur.textContent = messageErreur(err);
    }
  }
  const form = h('form', { class: 'carte ligne', role: 'search', 'aria-label': 'Filtrer les ressources' },
    type.el, capacite.el, date.el, recherche.el, h('div', { class: 'champ' }, h('button', { type: 'submit' }, 'Filtrer')));
  form.addEventListener('submit', (e) => { e.preventDefault(); charger(); });

  remplacer(conteneur, h('h1', {}, 'Catalogue des ressources'), form, compteur, resultats);
  await charger();
}
