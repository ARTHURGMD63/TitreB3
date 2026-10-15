// Calendrier accessible (vues jour / semaine / mois) : tableau HTML natif, boutons au clavier,
// état indiqué par du texte en plus de la couleur et du motif.
import { api } from './api.js';
import { annoncer, h, masque, messageErreur, remplacer } from './dom.js';
import { aujourdhui, cle, enMinutes, hhmm, jourPlus, jourSemaine, libelleJour, libelleMois, local, versUtc } from './temps.js';

const PAS = 30;
const lundi = (j) => jourPlus(j, -jourSemaine(j));

export function creerCalendrier({ ressource, onChoix }) {
  let vue = 'semaine';
  let jourRef = aujourdhui();
  let occupations = [];
  let selection = null;
  const boutons = new Map(); // début (ms) -> bouton, pour mettre à jour la sélection sans recréer la table
  const titre = h('h2', { 'aria-live': 'polite' });
  const zone = h('div', { class: 'defilement' });
  const barre = h('div', { class: 'espace-entre', role: 'toolbar', 'aria-label': 'Navigation du calendrier' });
  const racine = h('section', { 'aria-labelledby': 'titre-cal' }, barre, titre, zone);
  titre.id = 'titre-cal';

  function plage() {
    if (vue === 'jour') return { debut: jourRef, nb: 1 };
    if (vue === 'semaine') return { debut: lundi(jourRef), nb: 7 };
    const premier = { a: jourRef.a, m: jourRef.m, j: 1 };
    const suivant = jourRef.m === 12 ? { a: jourRef.a + 1, m: 1, j: 1 } : { a: jourRef.a, m: jourRef.m + 1, j: 1 };
    const debut = lundi(premier);
    const fin = jourPlus(lundi(jourPlus(suivant, -1)), 7);
    return { debut, nb: Math.round((Date.UTC(fin.a, fin.m - 1, fin.j) - Date.UTC(debut.a, debut.m - 1, debut.j)) / 86400000) };
  }

  async function charger() {
    const { debut, nb } = plage();
    const du = versUtc(debut.a, debut.m, debut.j);
    const fin = jourPlus(debut, nb);
    try {
      occupations = await api.get(`/api/ressources/${ressource.id}/occupation`, { du: du.toISOString(), au: versUtc(fin.a, fin.m, fin.j).toISOString() });
    } catch (err) {
      annoncer(messageErreur(err), 'erreur');
      occupations = [];
    }
    dessiner();
  }

  function occupant(debut, fin) {
    return occupations.find((o) => new Date(o.debut) < fin && new Date(o.fin) > debut);
  }

  function dessiner() {
    boutons.clear();
    dessinerBarre();
    const { debut, nb } = plage();
    if (vue === 'mois') return dessinerMois(debut, nb);
    const jours = Array.from({ length: nb }, (_, i) => jourPlus(debut, i));
    titre.textContent = vue === 'jour' ? libelleJour(jours[0]) : `Semaine du ${libelleJour(jours[0])} au ${libelleJour(jours[6])}`;
    const ouv = enMinutes(ressource.heure_ouverture);
    const fer = enMinutes(ressource.heure_fermeture);
    const maintenant = new Date();
    const lignes = [];
    for (let min = ouv; min < fer; min += PAS) {
      lignes.push(h('tr', {}, h('th', { scope: 'row' }, hhmm(min)), jours.map((jour) => cellule(jour, min, maintenant))));
    }
    remplacer(zone, h('table', { class: 'calendrier' },
      h('caption', { class: 'sr-only' }, `Créneaux de ${ressource.nom}. Chaque case est un créneau de ${PAS} minutes.`),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Heure'), jours.map((j) => h('th', { scope: 'col' }, libelleJour(j))))),
      h('tbody', {}, lignes)));
    marquerSelection();
  }

  function cellule(jour, min, maintenant) {
    const debut = versUtc(jour.a, jour.m, jour.j, Math.floor(min / 60), min % 60);
    const fin = new Date(debut.getTime() + PAS * 60000);
    const lieu = `${libelleJour(jour)} à ${hhmm(min)}`;
    const o = occupant(debut, fin);
    if (o) {
      const attente = o.statut === 'en_attente';
      const texte = o.a_moi ? (attente ? 'Ma demande' : 'Ma réservation') : attente ? 'En attente' : 'Occupé';
      return h('td', {}, h('span', { class: `cellule ${o.a_moi ? 'moi' : attente ? 'attente' : 'occupe'}` }, texte, masque(`, ${lieu}`)));
    }
    if (debut < maintenant || !ressource.active) {
      return h('td', {}, h('span', { class: 'cellule ferme' }, debut < maintenant ? 'Passé' : 'Fermé', masque(`, ${lieu}`)));
    }
    const bouton = h('button', { type: 'button', class: 'cellule', 'aria-pressed': 'false', 'aria-label': `Libre, ${lieu}`,
      onclick: () => choisir(debut, fin) }, 'Libre');
    boutons.set(debut.getTime(), { bouton, debut, fin });
    return h('td', {}, bouton);
  }

  function dessinerMois(debut, nb) {
    titre.textContent = libelleMois(jourRef);
    const parJour = new Map();
    for (const o of occupations) {
      const k = cle(local(new Date(o.debut)));
      parJour.set(k, (parJour.get(k) || 0) + 1);
    }
    const semaines = [];
    for (let i = 0; i < nb; i += 7) {
      semaines.push(h('tr', {}, Array.from({ length: 7 }, (_, d) => {
        const jour = jourPlus(debut, i + d);
        const n = parJour.get(cle(jour)) || 0;
        const horsMois = jour.m !== jourRef.m;
        return h('td', {}, h('button', { type: 'button', class: `cellule ${n ? 'attente' : ''} ${horsMois ? 'ferme' : ''}`,
          onclick: () => { jourRef = jour; vue = 'jour'; charger(); } },
        h('strong', {}, jour.j), h('br'), n ? `${n} réservation(s)` : 'Libre', masque(` — ${libelleJour(jour)}, ouvrir la vue jour`)));
      })));
    }
    remplacer(zone, h('table', { class: 'calendrier calendrier-mois' },
      h('caption', { class: 'sr-only' }, `Occupation mensuelle de ${ressource.nom}`),
      h('thead', {}, h('tr', {}, ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((j) => h('th', { scope: 'col' }, j)))),
      h('tbody', {}, semaines)));
  }

  function dessinerBarre() {
    const deplacer = (sens) => {
      if (vue === 'jour') jourRef = jourPlus(jourRef, sens);
      else if (vue === 'semaine') jourRef = jourPlus(jourRef, 7 * sens);
      else jourRef = jourRef.m + sens < 1 ? { a: jourRef.a - 1, m: 12, j: 1 } : jourRef.m + sens > 12 ? { a: jourRef.a + 1, m: 1, j: 1 } : { a: jourRef.a, m: jourRef.m + sens, j: 1 };
      charger();
    };
    const vueBtn = (id, libelle) => h('button', { type: 'button', class: 'secondaire petit', 'aria-pressed': String(vue === id), onclick: () => { vue = id; charger(); } }, libelle);
    remplacer(barre,
      h('div', { class: 'onglets' },
        h('button', { type: 'button', class: 'secondaire petit', onclick: () => deplacer(-1) }, '← Précédent'),
        h('button', { type: 'button', class: 'secondaire petit', onclick: () => { jourRef = aujourdhui(); charger(); } }, "Aujourd'hui"),
        h('button', { type: 'button', class: 'secondaire petit', onclick: () => deplacer(1) }, 'Suivant →')),
      h('div', { class: 'onglets', role: 'group', 'aria-label': 'Type de vue' }, vueBtn('jour', 'Jour'), vueBtn('semaine', 'Semaine'), vueBtn('mois', 'Mois')));
  }

  // Un premier clic fixe le début, un second clic plus tard le même jour étend la fin.
  function choisir(debut, fin) {
    const simple = selection && selection.fin - selection.debut === PAS * 60000;
    const memeJour = selection && cle(local(selection.debut)) === cle(local(debut));
    if (simple && memeJour && debut > selection.debut && !occupant(selection.debut, fin)) selection = { debut: selection.debut, fin };
    else selection = { debut, fin };
    marquerSelection();
    onChoix?.(selection);
  }

  function marquerSelection() {
    for (const { bouton, debut, fin } of boutons.values()) {
      const choisi = !!selection && debut >= selection.debut && fin <= selection.fin;
      bouton.classList.toggle('choisi', choisi);
      bouton.setAttribute('aria-pressed', String(choisi));
    }
  }

  function definirSelection(debut, fin) {
    selection = debut && fin ? { debut, fin } : null;
    if (selection) {
      const { debut: d0, nb } = plage();
      const c = local(selection.debut);
      const dansPlage = vue === 'mois' || (Date.UTC(c.a, c.m - 1, c.j) >= Date.UTC(d0.a, d0.m - 1, d0.j) && Date.UTC(c.a, c.m - 1, c.j) < Date.UTC(d0.a, d0.m - 1, d0.j + nb));
      if (!dansPlage) { jourRef = { a: c.a, m: c.m, j: c.j }; return charger(); }
    }
    marquerSelection();
  }

  const legende = h('ul', { class: 'legende', 'aria-label': 'Légende' },
    h('li', {}, h('span', { class: 'pastille calendrier' }, ''), 'Libre (bouton)'),
    h('li', {}, 'Occupé (motif rayé rouge)'), h('li', {}, 'En attente de validation (rayé orange)'),
    h('li', {}, 'Ma réservation (bleu)'), h('li', {}, 'Passé ou fermé (gris)'));
  racine.append(legende);
  charger();
  return { el: racine, recharger: charger, definirSelection };
}
