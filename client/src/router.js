// Routeur Vue : routes, protection par connexion et par rôle (en plus du contrôle fait côté serveur).
import { createRouter, createWebHashHistory } from 'vue-router';
import { session } from './store.js';

const routes = [
  { path: '/', name: 'catalogue', component: () => import('./views/CatalogueView.vue'), meta: { titre: 'Catalogue des ressources', connecte: true } },
  { path: '/ressource/:id(\\d+)', name: 'ressource', component: () => import('./views/RessourceView.vue'), meta: { titre: 'Réserver une ressource', connecte: true } },
  { path: '/mon-espace', name: 'mon-espace', component: () => import('./views/MonEspaceView.vue'), meta: { titre: 'Mon espace', connecte: true } },
  { path: '/responsable', name: 'responsable', component: () => import('./views/ResponsableView.vue'), meta: { titre: 'Espace responsable', roles: ['responsable', 'admin'] } },
  { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue'), meta: { titre: 'Administration', roles: ['admin'] } },
  { path: '/connexion', name: 'connexion', component: () => import('./views/ConnexionView.vue'), meta: { titre: 'Connexion', invite: true } },
  { path: '/inscription', name: 'inscription', component: () => import('./views/InscriptionView.vue'), meta: { titre: 'Créer un compte', invite: true } },
  { path: '/mot-de-passe-oublie', name: 'oubli', component: () => import('./views/OubliView.vue'), meta: { titre: 'Mot de passe oublié', invite: true } },
  { path: '/reinitialiser', name: 'reinitialiser', component: () => import('./views/ReinitialisationView.vue'), meta: { titre: 'Nouveau mot de passe', invite: true } },
  { path: '/:reste(.*)*', name: 'introuvable', component: () => import('./views/IntrouvableView.vue'), meta: { titre: 'Page introuvable' } }
];

export const router = createRouter({ history: createWebHashHistory(), routes });

router.beforeEach((to) => {
  const u = session.utilisateur;
  if ((to.meta.connecte || to.meta.roles) && !u) return { name: 'connexion' };
  if (to.meta.roles && !to.meta.roles.includes(u.role)) return { name: 'catalogue' };
  // Déjà connecté : inutile d'afficher connexion / inscription
  if (to.meta.invite && u && to.name !== 'reinitialiser') return { name: 'catalogue' };
});

// Titre de page dynamique (RGAA 8.5)
router.afterEach((to) => {
  document.title = `${to.meta.titre} — créneau`;
});
