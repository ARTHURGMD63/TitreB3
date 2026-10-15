<script setup>
// Administration : comptes, ressources, quotas, statistiques et journal d'audit (un composant par onglet).
import { ref } from 'vue';
import AdminAudit from './admin/AdminAudit.vue';
import AdminQuotas from './admin/AdminQuotas.vue';
import AdminRessources from './admin/AdminRessources.vue';
import AdminStats from './admin/AdminStats.vue';
import AdminUtilisateurs from './admin/AdminUtilisateurs.vue';

const onglets = [
  { id: 'utilisateurs', libelle: 'Utilisateurs', composant: AdminUtilisateurs },
  { id: 'ressources', libelle: 'Ressources', composant: AdminRessources },
  { id: 'quotas', libelle: 'Quotas', composant: AdminQuotas },
  { id: 'stats', libelle: 'Statistiques', composant: AdminStats },
  { id: 'audit', libelle: "Journal d'audit", composant: AdminAudit }
];
const actif = ref(onglets[0]);
</script>

<template>
  <div><p class="surtitre">Administration</p><h1>{{ actif.libelle }}</h1></div>
  <div class="onglets" role="group" aria-label="Sections de l'administration">
    <button v-for="o in onglets" :key="o.id" type="button" :aria-pressed="String(actif.id === o.id)" @click="actif = o">{{ o.libelle }}</button>
  </div>
  <component :is="actif.composant" :key="actif.id" />
</template>
