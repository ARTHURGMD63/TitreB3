// Boîtes de dialogue modales natives (<dialog>) : focus piégé et fermeture par Échap gérés par le navigateur.
import { h, messageErreur } from './dom.js';

// corps : éléments du formulaire ; onValider : fonction async, une erreur est affichée dans la boîte
export function dialogue({ titre, corps = [], libelleValider = 'Valider', danger = false, onValider }) {
  const erreur = h('p', { role: 'alert', class: 'message-erreur', hidden: true });
  const valider = h('button', { type: 'submit', class: danger ? 'danger' : '' }, libelleValider);
  const annuler = h('button', { type: 'button', class: 'secondaire', onclick: () => d.close() }, 'Annuler');
  const form = h('form', { method: 'dialog' }, h('h2', { id: 'titre-dialogue' }, titre), corps, erreur, h('div', { class: 'actions' }, annuler, valider));
  const d = h('dialog', { 'aria-labelledby': 'titre-dialogue' }, form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    valider.disabled = true;
    try {
      await onValider();
      d.close();
    } catch (err) {
      erreur.textContent = messageErreur(err);
      erreur.hidden = false;
    } finally {
      valider.disabled = false;
    }
  });
  d.addEventListener('close', () => d.remove());
  document.body.append(d);
  d.showModal();
  return d;
}

export const confirmer = (titre, message, onValider, libelleValider = 'Confirmer') =>
  dialogue({ titre, corps: [h('p', {}, message)], libelleValider, danger: true, onValider });
