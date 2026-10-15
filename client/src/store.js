// État partagé minimal (réactif) : utilisateur connecté et messages d'annonce.
import { reactive } from 'vue';
import { api } from './api.js';

export const session = reactive({ utilisateur: null });
export const message = reactive({ texte: '', type: 'info', visible: false });

let minuteur;
// Annonce visuelle + vocale (la zone est une région aria-live dans App.vue)
export function annoncer(texte, type = 'info') {
  message.texte = texte;
  message.type = type;
  message.visible = true;
  clearTimeout(minuteur);
  minuteur = setTimeout(() => (message.visible = false), 8000);
}

export async function chargerSession() {
  try {
    session.utilisateur = (await api.get('/api/me')).utilisateur;
  } catch {
    session.utilisateur = null;
  }
}

// Texte lisible pour les erreurs de l'API (avec le détail des champs invalides)
export function messageErreur(err) {
  if (err?.corps?.details?.length) return `${err.message} ${err.corps.details.map((d) => `${d.champ} : ${d.message}`).join(' ; ')}`;
  return err?.message || 'Une erreur est survenue.';
}

export const signalerErreur = (err) => annoncer(messageErreur(err), 'erreur');

// Nombre de demandes en attente (pastille de l'en-tête pour les responsables et administrateurs)
export const demandes = reactive({ nombre: 0 });
export async function rafraichirDemandes() {
  const role = session.utilisateur?.role;
  if (role !== 'responsable' && role !== 'admin') { demandes.nombre = 0; return; }
  try { demandes.nombre = (await api.get('/api/reservations/a-traiter')).length; } catch { demandes.nombre = 0; }
}
