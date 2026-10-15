<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';
import ChampTexte from '../components/ChampTexte.vue';
import FormulaireAuth from '../components/FormulaireAuth.vue';
import { annoncer } from '../store.js';

const route = useRoute();
const router = useRouter();
const motDePasse = ref('');

async function enregistrer() {
  await api.post('/api/auth/reset-password', { token: String(route.query.token || ''), mot_de_passe: motDePasse.value });
  annoncer('Mot de passe modifié. Vous pouvez vous connecter.', 'ok');
  await router.push({ name: 'connexion' });
}
</script>

<template>
  <FormulaireAuth titre="Nouveau mot de passe" libelle-bouton="Enregistrer" :soumettre="enregistrer">
    <ChampTexte v-model="motDePasse" label="Nouveau mot de passe" type="password" requis autocomplete="new-password" minlength="10"
      aide="10 caractères minimum, avec une majuscule, une minuscule et un chiffre." />
  </FormulaireAuth>
</template>
