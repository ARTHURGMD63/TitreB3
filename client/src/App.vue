<script setup>
// Gabarit général : mise en page « connexion » (sans en-tête) ou mise en page applicative (en-tête + contenu).
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { api } from './api.js';
import Icone from './components/Icone.vue';
import IconesSprite from './components/IconesSprite.vue';
import LogoCreneau from './components/LogoCreneau.vue';
import MessageGlobal from './components/MessageGlobal.vue';
import { annoncer, demandes, rafraichirDemandes, session } from './store.js';
import { ROLES } from './temps.js';

const route = useRoute();
const router = useRouter();
const contenu = ref(null);
const estInvite = computed(() => !!route.meta.invite);
const initiales = computed(() => `${session.utilisateur?.prenom?.[0] ?? ''}${session.utilisateur?.nom?.[0] ?? ''}`.toUpperCase());
const gereDesRessources = computed(() => ['responsable', 'admin'].includes(session.utilisateur?.role));

async function deconnecter() {
  try { await api.post('/api/auth/logout'); } catch { /* session déjà expirée */ }
  session.utilisateur = null;
  await router.push({ name: 'connexion' });
  annoncer('Vous êtes déconnecté.', 'ok');
}

function sessionExpiree() {
  session.utilisateur = null;
  annoncer('Votre session a expiré. Merci de vous reconnecter.', 'erreur');
  router.push({ name: 'connexion' });
}
onMounted(() => { window.addEventListener('session-expiree', sessionExpiree); rafraichirDemandes(); });
onBeforeUnmount(() => window.removeEventListener('session-expiree', sessionExpiree));

// À chaque changement de page, le focus va au titre : repère pour le clavier et les lecteurs d'écran
watch(() => route.fullPath, async () => {
  rafraichirDemandes();
  await nextTick();
  setTimeout(() => {
    const titre = contenu.value?.querySelector('h1');
    if (titre) { titre.setAttribute('tabindex', '-1'); titre.focus({ preventScroll: true }); }
  }, 60);
});
watch(() => session.utilisateur, rafraichirDemandes);
</script>

<template>
  <IconesSprite />
  <a class="evitement" href="#contenu" @click.prevent="contenu?.focus()">Aller au contenu</a>

  <!-- Connexion, inscription, mot de passe : carte centrée, sans en-tête -->
  <main v-if="estInvite" id="contenu" ref="contenu" class="conteneur auth" tabindex="-1">
    <RouterLink class="logo" to="/connexion"><LogoCreneau /><span>créneau</span></RouterLink>
    <div class="carte">
      <div class="onglets" role="group" aria-label="Accès au compte">
        <button type="button" :aria-pressed="String(route.name !== 'inscription')" @click="router.push({ name: 'connexion' })">Connexion</button>
        <button type="button" :aria-pressed="String(route.name === 'inscription')" @click="router.push({ name: 'inscription' })">Inscription</button>
      </div>
      <MessageGlobal />
      <RouterView />
    </div>
  </main>

  <template v-else>
    <header class="entete" role="banner">
      <div class="conteneur">
        <RouterLink class="logo" to="/"><LogoCreneau /><span>créneau</span></RouterLink>
        <nav v-if="session.utilisateur" aria-label="Navigation principale">
          <RouterLink to="/">Catalogue</RouterLink>
          <RouterLink to="/mon-espace">Mon espace</RouterLink>
          <RouterLink v-if="gereDesRessources" to="/responsable">
            Demandes<span v-if="demandes.nombre" class="compteur"><span class="sr-only">(</span>{{ demandes.nombre }}<span class="sr-only"> en attente)</span></span>
          </RouterLink>
          <RouterLink v-if="session.utilisateur.role === 'admin'" to="/admin">Administration</RouterLink>
        </nav>
        <div v-if="session.utilisateur" class="compte">
          <span><b>{{ session.utilisateur.prenom }} {{ session.utilisateur.nom }}</b><small>{{ ROLES[session.utilisateur.role] }}</small></span>
          <span class="avatar" aria-hidden="true">{{ initiales }}</span>
          <button type="button" class="discret petit icone-seule" aria-label="Se déconnecter" title="Se déconnecter" @click="deconnecter"><Icone nom="sortie" /></button>
        </div>
      </div>
    </header>
    <main id="contenu" ref="contenu" class="conteneur" tabindex="-1">
      <MessageGlobal />
      <RouterView />
    </main>
  </template>
</template>
