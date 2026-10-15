// Point d'entrée de l'interface : session, navigation et routage par hash.
import { api } from './api.js';
import { annoncer, h, remplacer } from './dom.js';
import { session } from './etat.js';
import { pageConnexion, pageInscription, pageMotDePasseOublie, pageReinitialisation } from './pages/auth.js';
import { pageCatalogue } from './pages/catalogue.js';
import { pageRessource } from './pages/ressource.js';
import { pageMonEspace } from './pages/monEspace.js';
import { pageResponsable } from './pages/responsable.js';
import { pageAdmin } from './pages/admin.js';

const contenu = document.getElementById('contenu');
const navigation = document.getElementById('navigation');

// Table de routage : chemin -> { page, titre, roles (optionnel) }
const ROUTES = [
  { motif: /^\/$/, page: pageCatalogue, titre: 'Catalogue des ressources', connecte: true },
  { motif: /^\/ressource\/(\d+)$/, page: pageRessource, titre: 'Réserver une ressource', connecte: true },
  { motif: /^\/mon-espace$/, page: pageMonEspace, titre: 'Mon espace', connecte: true },
  { motif: /^\/responsable$/, page: pageResponsable, titre: 'Espace responsable', roles: ['responsable', 'admin'] },
  { motif: /^\/admin$/, page: pageAdmin, titre: 'Administration', roles: ['admin'] },
  { motif: /^\/connexion$/, page: pageConnexion, titre: 'Connexion' },
  { motif: /^\/inscription$/, page: pageInscription, titre: 'Créer un compte' },
  { motif: /^\/mot-de-passe-oublie$/, page: pageMotDePasseOublie, titre: 'Mot de passe oublié' },
  { motif: /^\/reinitialiser$/, page: pageReinitialisation, titre: 'Nouveau mot de passe' }
];

function dessinerNavigation(chemin) {
  const u = session.utilisateur;
  const lien = (href, texte) => h('li', {}, h('a', { href: `#${href}`, 'aria-current': chemin === href ? 'page' : null }, texte));
  const items = [];
  if (u) {
    items.push(lien('/', 'Catalogue'), lien('/mon-espace', 'Mon espace'));
    if (['responsable', 'admin'].includes(u.role)) items.push(lien('/responsable', 'Responsable'));
    if (u.role === 'admin') items.push(lien('/admin', 'Administration'));
    items.push(h('li', {}, h('button', { type: 'button', onclick: deconnecter }, `Déconnexion (${u.prenom})`)));
  } else {
    items.push(lien('/connexion', 'Connexion'), lien('/inscription', 'Inscription'));
  }
  remplacer(navigation, h('ul', {}, items));
}

async function deconnecter() {
  try { await api.post('/api/auth/logout'); } catch { /* session déjà expirée */ }
  session.utilisateur = null;
  location.hash = '#/connexion';
  annoncer('Vous êtes déconnecté.', 'ok');
}

async function router() {
  const [chemin, requete = ''] = (location.hash.slice(1) || '/').split('?');
  const route = ROUTES.find((r) => r.motif.test(chemin));
  const parametres = new URLSearchParams(requete);

  if (!route) {
    remplacer(contenu, h('h1', {}, 'Page introuvable'), h('p', {}, h('a', { href: '#/' }, "Retour à l'accueil")));
    return;
  }
  // Déjà connecté : inutile d'afficher connexion / inscription
  if (session.utilisateur && /^\/(connexion|inscription|mot-de-passe-oublie)$/.test(chemin)) {
    location.hash = '#/';
    return;
  }
  if ((route.connecte || route.roles) && !session.utilisateur) {
    location.hash = '#/connexion';
    return;
  }
  if (route.roles && !route.roles.includes(session.utilisateur.role)) {
    remplacer(contenu, h('h1', {}, 'Accès interdit'), h('p', {}, "Vous n'avez pas les droits pour cette page."));
    return;
  }
  dessinerNavigation(chemin);
  document.title = `${route.titre} — Réservations`;
  const args = chemin.match(route.motif).slice(1);
  remplacer(contenu, h('p', {}, 'Chargement…'));
  try {
    await route.page(contenu, { args, parametres, session });
  } catch (err) {
    remplacer(contenu, h('h1', {}, 'Erreur'), h('p', { role: 'alert' }, err.message || 'Erreur inattendue.'));
  }
  // Après chaque changement de page, le focus va au titre : repère pour le clavier et les lecteurs d'écran
  const titre = contenu.querySelector('h1');
  if (titre) { titre.setAttribute('tabindex', '-1'); titre.focus({ preventScroll: true }); }
}

window.addEventListener('hashchange', router);
window.addEventListener('session-expiree', () => {
  session.utilisateur = null;
  annoncer('Votre session a expiré, merci de vous reconnecter.', 'erreur');
  location.hash = '#/connexion';
});

(async function demarrer() {
  try {
    session.utilisateur = (await api.get('/api/me')).utilisateur;
  } catch { session.utilisateur = null; }
  if (!location.hash) location.hash = session.utilisateur ? '#/' : '#/connexion';
  router();
})();
