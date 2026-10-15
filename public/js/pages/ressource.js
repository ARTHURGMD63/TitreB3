// Fiche d'une ressource : calendrier + formulaire de réservation (avec alternatives en cas de conflit).
import { api } from '../api.js';
import { annoncer, champ, h, messageErreur, remplacer, selectChamp } from '../dom.js';
import { creerCalendrier } from '../calendrier.js';
import { aujourdhui, cle, enMinutes, formaterDate, formaterHeure, hhmm, local, versUtc } from '../temps.js';

const PAS = 30;

function optionsHeures(debutMin, finMin) {
  const options = [];
  for (let m = debutMin; m <= finMin; m += PAS) options.push({ valeur: hhmm(m), libelle: hhmm(m) });
  return options;
}

export async function pageRessource(conteneur, { args }) {
  const ressource = await api.get(`/api/ressources/${args[0]}`);
  const quota = await api.get('/api/me/quota').catch(() => null);
  const ouv = enMinutes(ressource.heure_ouverture);
  const fer = enMinutes(ressource.heure_fermeture);

  const date = champ({ label: 'Date', nom: 'date', type: 'date', valeur: cle(aujourdhui()), requis: true, min: cle(aujourdhui()) });
  const debut = selectChamp({ label: 'Début', nom: 'debut', options: optionsHeures(ouv, fer - PAS), valeur: hhmm(ouv) });
  const fin = selectChamp({ label: 'Fin', nom: 'fin', options: optionsHeures(ouv + PAS, fer), valeur: hhmm(ouv + 60) });
  const motif = champ({ label: 'Motif (facultatif)', nom: 'motif', maxlength: 300 });
  const alternatives = h('div', { 'aria-live': 'polite' });
  const bouton = h('button', { type: 'submit' }, 'Réserver');

  const calendrier = creerCalendrier({
    ressource,
    onChoix: (sel) => {
      const d = local(sel.debut);
      const f = local(new Date(sel.fin.getTime() - 1));
      date.input.value = cle(d);
      debut.select.value = hhmm(d.h * 60 + d.min);
      fin.select.value = hhmm(f.h * 60 + f.min + 1);
    }
  });

  // Quand le formulaire change, la sélection du calendrier suit
  function synchroniser() {
    const [a, m, j] = date.input.value.split('-').map(Number);
    if (!a) return;
    const d = enMinutes(debut.select.value);
    const f = enMinutes(fin.select.value);
    if (f > d) calendrier.definirSelection(versUtc(a, m, j, Math.floor(d / 60), d % 60), versUtc(a, m, j, Math.floor(f / 60), f % 60));
  }
  for (const el of [date.input, debut.select, fin.select]) el.addEventListener('change', synchroniser);

  function creneau() {
    const [a, m, j] = date.input.value.split('-').map(Number);
    const d = enMinutes(debut.select.value);
    const f = enMinutes(fin.select.value);
    return { debut: versUtc(a, m, j, Math.floor(d / 60), d % 60), fin: versUtc(a, m, j, Math.floor(f / 60), f % 60) };
  }

  const form = h('form', { class: 'carte', 'aria-labelledby': 'titre-resa' },
    h('h2', { id: 'titre-resa' }, 'Réserver un créneau'),
    quota ? h('p', { class: 'doux' }, `Quota : ${quota.reservations_restantes} réservation(s) restante(s) sur ${quota.reservations_max}, ${quota.duree_max_minutes} min maximum chacune, ${quota.delai_max_jours} jours à l'avance.`) : null,
    h('div', { class: 'ligne' }, date.el, debut.el, fin.el, motif.el),
    ressource.validation_requise ? h('p', { class: 'doux' }, `Cette ressource nécessite la validation de ${ressource.responsable_nom || 'son responsable'}.`) : null,
    bouton, alternatives);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    remplacer(alternatives);
    const c = creneau();
    bouton.disabled = true;
    try {
      const r = await api.post('/api/reservations', { ressource_id: ressource.id, debut: c.debut.toISOString(), fin: c.fin.toISOString(), motif: motif.input.value });
      annoncer(r.statut === 'en_attente' ? 'Demande envoyée : elle est en attente de validation.' : 'Réservation confirmée.', 'ok');
      calendrier.definirSelection(null);
      await calendrier.recharger();
    } catch (err) {
      annoncer(messageErreur(err), 'erreur');
      const propositions = err.corps?.alternatives;
      if (propositions?.length) {
        remplacer(alternatives, h('h3', {}, 'Créneaux proches disponibles'),
          h('ul', {}, propositions.map((p) => h('li', {}, h('button', { type: 'button', class: 'secondaire petit', onclick: () => {
            const d = local(new Date(p.debut));
            const f = local(new Date(new Date(p.fin).getTime() - 1));
            date.input.value = cle(d);
            debut.select.value = hhmm(d.h * 60 + d.min);
            fin.select.value = hhmm(f.h * 60 + f.min + 1);
            synchroniser();
            remplacer(alternatives);
          } }, `${formaterDate(p.debut)}, de ${formaterHeure(p.debut)} à ${formaterHeure(p.fin)}`)))));
      }
    } finally {
      bouton.disabled = false;
    }
  });

  remplacer(conteneur,
    h('p', {}, h('a', { href: '#/' }, '← Retour au catalogue')),
    h('h1', {}, ressource.nom),
    h('div', { class: 'carte' },
      h('p', {}, `${ressource.type === 'salle' ? 'Salle' : 'Matériel'} · capacité ${ressource.capacite} · ${ressource.localisation || 'lieu non précisé'}`),
      h('p', {}, `Ouvert de ${ressource.heure_ouverture} à ${ressource.heure_fermeture}.`),
      ressource.equipements.length ? h('p', {}, `Équipements : ${ressource.equipements.join(', ')}`) : null,
      !ressource.active ? h('p', { class: 'message message-erreur', role: 'alert' }, `Ressource indisponible${ressource.motif_indisponibilite ? ` : ${ressource.motif_indisponibilite}` : ''}.`) : null),
    ressource.active ? form : null,
    calendrier.el);
}
