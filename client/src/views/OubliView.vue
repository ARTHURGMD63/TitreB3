<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api.js';
import ChampTexte from '../components/ChampTexte.vue';
import FormulaireAuth from '../components/FormulaireAuth.vue';
import Icone from '../components/Icone.vue';
import { annoncer } from '../store.js';

const email = ref('');

async function envoyer() {
  const r = await api.post('/api/auth/forgot-password', { email: email.value });
  annoncer(r.message, 'ok');
}
</script>

<template>
  <FormulaireAuth titre="Mot de passe oublié" sous-titre="Indiquez votre adresse : nous vous enverrons un lien valable 1 heure." libelle-bouton="Envoyer le lien" :soumettre="envoyer">
    <ChampTexte v-model="email" label="Adresse e-mail" type="email" requis autocomplete="email" />
    <template #liens><RouterLink to="/connexion"><Icone nom="gauche" /> Retour à la connexion</RouterLink></template>
  </FormulaireAuth>
</template>
