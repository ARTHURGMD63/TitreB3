// Administration : comptes, ressources, quotas, statistiques et journal d'audit.
import { api } from '../api.js';
import { annoncer, champ, h, messageErreur, remplacer, selectChamp } from '../dom.js';
import { dialogue } from '../dialogue.js';
import { cle, aujourdhui, formaterDateHeure, jourPlus } from '../temps.js';

const JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const erreur = (e) => annoncer(messageErreur(e), 'erreur');
const entetes = (cols) => h('thead', {}, h('tr', {}, cols.map((c) => h('th', { scope: 'col' }, c))));

// ---------- Utilisateurs ----------
async function ongletUtilisateurs(zone) {
  const [utilisateurs, profils] = await Promise.all([api.get('/api/admin/utilisateurs'), api.get('/api/admin/profils-quota')]);
  const lignes = utilisateurs.map((u) => {
    const role = selectChamp({ label: 'Rôle', nom: 'role', valeur: u.role, options: ['utilisateur', 'responsable', 'admin'].map((r) => ({ valeur: r, libelle: r })) });
    const profil = selectChamp({ label: 'Profil de quota', nom: 'profil', valeur: u.profil_quota_id, options: profils.map((p) => ({ valeur: p.id, libelle: p.libelle })) });
    const actif = h('input', { type: 'checkbox', checked: u.actif, id: `actif-${u.id}` });
    return h('tr', {}, h('td', {}, `${u.prenom} ${u.nom}`, h('div', { class: 'doux' }, u.email)),
      h('td', {}, role.select, h('label', { for: role.select.id, class: 'sr-only' }, `Rôle de ${u.email}`)),
      h('td', {}, profil.select, h('label', { for: profil.select.id, class: 'sr-only' }, `Profil de ${u.email}`)),
      h('td', {}, actif, h('label', { for: actif.id }, ' Actif')),
      h('td', {}, h('button', { type: 'button', class: 'petit', onclick: async () => {
        try {
          await api.patch(`/api/admin/utilisateurs/${u.id}`, { role: role.select.value, profil_quota_id: Number(profil.select.value), actif: actif.checked });
          annoncer(`Compte de ${u.email} mis à jour.`, 'ok');
        } catch (e) { erreur(e); }
      } }, 'Enregistrer', h('span', { class: 'sr-only' }, ` ${u.email}`))));
  });
  remplacer(zone, h('div', { class: 'defilement' }, h('table', {}, h('caption', {}, 'Comptes utilisateurs'),
    entetes(['Utilisateur', 'Rôle', 'Profil de quota', 'Statut', 'Action']), h('tbody', {}, lignes))));
}

// ---------- Ressources ----------
async function formulaireRessource(r, recharger) {
  const responsables = await api.get('/api/admin/responsables');
  const nom = champ({ label: 'Nom', nom: 'nom', valeur: r?.nom ?? '', requis: true, maxlength: 120 });
  const type = selectChamp({ label: 'Type', nom: 'type', valeur: r?.type ?? 'salle', options: [{ valeur: 'salle', libelle: 'Salle' }, { valeur: 'materiel', libelle: 'Matériel' }] });
  const capacite = champ({ label: 'Capacité', nom: 'capacite', type: 'number', valeur: r?.capacite ?? 1, min: 1, requis: true });
  const lieu = champ({ label: 'Localisation', nom: 'localisation', valeur: r?.localisation ?? '', maxlength: 160 });
  const equip = champ({ label: 'Équipements', nom: 'equipements', valeur: (r?.equipements ?? []).join(', '), aide: 'Séparés par des virgules.' });
  const photo = champ({ label: 'Photo (URL https)', nom: 'photo', type: 'url', valeur: r?.photo_url ?? '' });
  const ouv = champ({ label: 'Ouverture', nom: 'ouv', type: 'time', valeur: r?.heure_ouverture ?? '08:00', requis: true });
  const fer = champ({ label: 'Fermeture', nom: 'fer', type: 'time', valeur: r?.heure_fermeture ?? '19:00', requis: true });
  const validation = h('input', { type: 'checkbox', id: 'val-requise', checked: r?.validation_requise });
  const resp = selectChamp({ label: 'Responsable', nom: 'resp', valeur: r?.responsable_id ?? '',
    options: [{ valeur: '', libelle: '— aucun —' }, ...responsables.map((x) => ({ valeur: x.id, libelle: `${x.prenom} ${x.nom}` }))] });
  dialogue({
    titre: r ? `Modifier ${r.nom}` : 'Nouvelle ressource',
    corps: [nom.el, h('div', { class: 'ligne' }, type.el, capacite.el), lieu.el, equip.el, photo.el, h('div', { class: 'ligne' }, ouv.el, fer.el),
      h('div', { class: 'champ champ-case' }, validation, h('label', { for: 'val-requise' }, 'Validation du responsable requise')), resp.el],
    libelleValider: 'Enregistrer',
    onValider: async () => {
      const donnees = {
        nom: nom.input.value, type: type.select.value, capacite: Number(capacite.input.value), localisation: lieu.input.value,
        equipements: equip.input.value.split(',').map((x) => x.trim()).filter(Boolean), photo_url: photo.input.value || null,
        heure_ouverture: ouv.input.value, heure_fermeture: fer.input.value, validation_requise: validation.checked,
        responsable_id: resp.select.value ? Number(resp.select.value) : null
      };
      if (r) await api.put(`/api/ressources/${r.id}`, donnees); else await api.post('/api/ressources', donnees);
      annoncer('Ressource enregistrée.', 'ok');
      await recharger();
    }
  });
}

async function ongletRessources(zone) {
  const recharger = () => ongletRessources(zone);
  const liste = await api.get('/api/ressources');
  const basculer = (r) => {
    if (r.active) {
      const motif = champ({ label: 'Motif de la maintenance', nom: 'motif', maxlength: 200 });
      dialogue({ titre: `Désactiver ${r.nom}`, corps: [motif.el], libelleValider: 'Désactiver', danger: true, onValider: async () => {
        await api.patch(`/api/ressources/${r.id}/activation`, { active: false, motif: motif.input.value }); await recharger();
      } });
    } else {
      api.patch(`/api/ressources/${r.id}/activation`, { active: true }).then(recharger).catch(erreur);
    }
  };
  remplacer(zone,
    h('button', { type: 'button', onclick: () => formulaireRessource(null, recharger).catch(erreur) }, 'Ajouter une ressource'),
    h('div', { class: 'defilement' }, h('table', {}, h('caption', {}, 'Ressources'), entetes(['Nom', 'Type', 'Capacité', 'Responsable', 'État', 'Actions']),
      h('tbody', {}, liste.map((r) => h('tr', {}, h('td', {}, r.nom), h('td', {}, r.type), h('td', {}, r.capacite), h('td', {}, r.responsable_nom || '—'),
        h('td', {}, r.active ? 'Active' : `Désactivée${r.motif_indisponibilite ? ` (${r.motif_indisponibilite})` : ''}`),
        h('td', {}, h('button', { type: 'button', class: 'secondaire petit', onclick: () => formulaireRessource(r, recharger).catch(erreur) }, 'Modifier', h('span', { class: 'sr-only' }, ` ${r.nom}`)), ' ',
          h('button', { type: 'button', class: 'secondaire petit', onclick: () => basculer(r) }, r.active ? 'Désactiver' : 'Réactiver', h('span', { class: 'sr-only' }, ` ${r.nom}`)))))))));
}

// ---------- Quotas ----------
async function ongletQuotas(zone) {
  const profils = await api.get('/api/admin/profils-quota');
  remplacer(zone, profils.map((p) => {
    const max = champ({ label: 'Réservations actives max', nom: 'max', type: 'number', valeur: p.max_reservations_actives, min: 1 });
    const duree = champ({ label: 'Durée max (minutes)', nom: 'duree', type: 'number', valeur: p.duree_max_minutes, min: 30, step: 30 });
    const delai = champ({ label: "Délai max à l'avance (jours)", nom: 'delai', type: 'number', valeur: p.delai_max_jours, min: 1 });
    const form = h('form', { class: 'carte', 'aria-label': `Quota ${p.libelle}` }, h('h3', {}, p.libelle), h('div', { class: 'ligne' }, max.el, duree.el, delai.el),
      h('button', { type: 'submit' }, 'Enregistrer', h('span', { class: 'sr-only' }, ` le profil ${p.libelle}`)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.patch(`/api/admin/profils-quota/${p.id}`, { max_reservations_actives: Number(max.input.value), duree_max_minutes: Number(duree.input.value), delai_max_jours: Number(delai.input.value) });
        annoncer(`Quota « ${p.libelle} » mis à jour.`, 'ok');
      } catch (err) { erreur(err); }
    });
    return form;
  }));
}

// ---------- Statistiques ----------
async function ongletStats(zone) {
  const auj = aujourdhui();
  const du = champ({ label: 'Du', nom: 'du', type: 'date', valeur: cle(jourPlus(auj, -30)) });
  const au = champ({ label: 'Au (exclu)', nom: 'au', type: 'date', valeur: cle(jourPlus(auj, 1)) });
  const resultat = h('div', { 'aria-live': 'polite' });
  async function charger() {
    try {
      const s = await api.get('/api/admin/stats', { du: du.input.value, au: au.input.value });
      remplacer(resultat,
        h('p', {}, `Annulations : ${s.annulations.nb_annulations} sur ${s.annulations.nb_total} réservation(s) (${s.annulations.taux_annulation ?? 0} %).`),
        h('h3', {}, 'Taux d\'occupation par ressource'),
        h('table', {}, entetes(['Ressource', 'Minutes réservées', 'Taux']), h('tbody', {}, s.occupation.map((o) =>
          h('tr', {}, h('td', {}, o.nom), h('td', {}, o.minutes_reservees),
            h('td', {}, h('progress', { class: 'jauge', value: Number(o.taux_occupation ?? 0), max: 100, 'aria-label': `Occupation de ${o.nom}` }), ` ${o.taux_occupation ?? 0} %`))))),
        h('h3', {}, 'Ressources les plus demandées'),
        h('ol', {}, s.plus_demandees.map((r) => h('li', {}, `${r.nom} : ${r.nb_demandes} demande(s)`))),
        h('h3', {}, 'Créneaux les plus saturés'),
        s.creneaux_satures.length ? h('ul', {}, s.creneaux_satures.map((c) => h('li', {}, `${JOURS[c.jour_semaine]} à ${c.heure} h : ${c.nb_reservations} réservation(s)`))) : h('p', {}, 'Pas de données.'),
        h('h3', {}, 'Répartition par statut'),
        h('ul', {}, s.statuts.map((x) => h('li', {}, `${x.statut} : ${x.nb}`))));
    } catch (e) { erreur(e); }
  }
  const form = h('form', { class: 'ligne' }, du.el, au.el, h('div', { class: 'champ' }, h('button', { type: 'submit' }, 'Calculer')));
  form.addEventListener('submit', (e) => { e.preventDefault(); charger(); });
  remplacer(zone, form, resultat);
  await charger();
}

// ---------- Journal d'audit (MongoDB) ----------
async function ongletAudit(zone) {
  const action = champ({ label: 'Action', nom: 'action', aide: 'Ex. CONNEXION_ECHEC, RESERVATION_CREEE', pattern: '[A-Z_]{3,40}' });
  const acteur = champ({ label: "ID de l'acteur", nom: 'acteur_id', type: 'number', min: 1 });
  let page = 1;
  const resultat = h('div', { 'aria-live': 'polite' });
  async function charger() {
    try {
      const { elements, total } = await api.get('/api/admin/audit', { action: action.input.value, acteur_id: acteur.input.value, page });
      remplacer(resultat, h('p', {}, `${total} événement(s).`), h('div', { class: 'defilement' }, h('table', {}, entetes(['Date', 'Action', 'Acteur', 'Cible', 'IP', 'Détail']),
        h('tbody', {}, elements.map((e) => h('tr', {}, h('td', {}, formaterDateHeure(e.date)), h('td', {}, e.action), h('td', {}, e.acteur_id ?? '—'),
          h('td', {}, e.cible ? `${e.cible.type} #${e.cible.id}` : '—'), h('td', {}, e.ip ?? '—'),
          h('td', {}, e.avant || e.apres ? h('code', {}, JSON.stringify({ avant: e.avant, apres: e.apres })) : '—')))))),
      h('div', { class: 'ligne' },
        h('button', { type: 'button', class: 'secondaire petit', disabled: page <= 1, onclick: () => { page--; charger(); } }, 'Page précédente'),
        h('button', { type: 'button', class: 'secondaire petit', disabled: page * 50 >= total, onclick: () => { page++; charger(); } }, 'Page suivante')));
    } catch (e) { erreur(e); }
  }
  const form = h('form', { class: 'ligne' }, action.el, acteur.el, h('div', { class: 'champ' }, h('button', { type: 'submit' }, 'Rechercher')));
  form.addEventListener('submit', (e) => { e.preventDefault(); page = 1; charger(); });
  remplacer(zone, form, resultat);
  await charger();
}

const ONGLETS = [
  ['utilisateurs', 'Utilisateurs', ongletUtilisateurs], ['ressources', 'Ressources', ongletRessources], ['quotas', 'Quotas', ongletQuotas],
  ['stats', 'Statistiques', ongletStats], ['audit', "Journal d'audit", ongletAudit]
];

export async function pageAdmin(conteneur) {
  const zone = h('div');
  const barre = h('div', { class: 'onglets', role: 'group', 'aria-label': "Sections d'administration" });
  async function afficher(id) {
    remplacer(barre, ONGLETS.map(([cleOnglet, libelle]) => h('button', { type: 'button', class: 'secondaire', 'aria-pressed': String(cleOnglet === id), onclick: () => afficher(cleOnglet) }, libelle)));
    remplacer(zone, h('p', {}, 'Chargement…'));
    try { await ONGLETS.find((o) => o[0] === id)[2](zone); } catch (e) { erreur(e); }
  }
  remplacer(conteneur, h('h1', {}, 'Administration'), barre, zone);
  await afficher('utilisateurs');
}
