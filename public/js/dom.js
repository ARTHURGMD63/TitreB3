// Aide à la construction du DOM. Aucun HTML n'est jamais injecté en texte : tout passe par des nœuds texte (protection XSS).
export function h(tag, attrs = {}, ...enfants) {
  const el = document.createElement(tag);
  for (const [cle, val] of Object.entries(attrs || {})) {
    if (val === null || val === undefined || val === false) continue;
    if (cle === 'class') el.className = val;
    else if (cle.startsWith('on') && typeof val === 'function') el.addEventListener(cle.slice(2).toLowerCase(), val);
    else if (val === true) el.setAttribute(cle, '');
    else el.setAttribute(cle, String(val));
  }
  ajouter(el, enfants);
  return el;
}

function ajouter(parent, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    parent.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
}

export function vider(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const remplacer = (el, ...enfants) => {
  vider(el);
  ajouter(el, enfants);
};

// Texte réservé aux lecteurs d'écran
export const masque = (texte) => h('span', { class: 'sr-only' }, texte);

// Annonce vocale (région aria-live) + bandeau visuel
export function annoncer(message, type = 'info') {
  const zone = document.getElementById('messages');
  if (!zone) return;
  zone.className = `message message-${type}`;
  zone.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
  zone.textContent = message;
  zone.hidden = false;
  clearTimeout(annoncer.minuteur);
  annoncer.minuteur = setTimeout(() => (zone.hidden = true), 8000);
}

// Champ de formulaire avec label lié (accessibilité RGAA)
let compteur = 0;
export function champ({ label, nom, type = 'text', valeur = '', requis = false, aide, ...extra }) {
  const id = `champ-${nom}-${++compteur}`;
  const idAide = aide ? `${id}-aide` : null;
  const input = h('input', { id, name: nom, type, value: valeur, required: requis, 'aria-describedby': idAide, ...extra });
  return {
    input,
    el: h('div', { class: 'champ' }, h('label', { for: id }, label, requis ? h('span', { 'aria-hidden': 'true' }, ' *') : null), input,
      aide ? h('small', { id: idAide }, aide) : null)
  };
}

export function selectChamp({ label, nom, options, valeur, ...extra }) {
  const id = `champ-${nom}-${++compteur}`;
  const select = h('select', { id, name: nom, ...extra },
    options.map((o) => h('option', { value: o.valeur, selected: String(o.valeur) === String(valeur) }, o.libelle)));
  return { select, el: h('div', { class: 'champ' }, h('label', { for: id }, label), select) };
}

// Affiche les erreurs de validation renvoyées par l'API
export function messageErreur(err) {
  if (err?.corps?.details?.length) return `${err.message} ${err.corps.details.map((d) => `${d.champ} : ${d.message}`).join(' ; ')}`;
  return err?.message || 'Une erreur est survenue.';
}
