<script setup>
import { reactive, useId } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api.js';
import ChampTexte from '../components/ChampTexte.vue';
import FormulaireAuth from '../components/FormulaireAuth.vue';
import { session } from '../store.js';

const router = useRouter();
const form = reactive({ email: '', mot_de_passe: '' });
const idMdp = useId();

async function connecter() {
  const { utilisateur } = await api.post('/api/auth/login', form);
  session.utilisateur = utilisateur;
  await router.push({ name: 'catalogue' });
}
</script>

<template>
  <FormulaireAuth titre="Connexion" sous-titre="Réservez les salles et le matériel de votre établissement." libelle-bouton="Se connecter" :soumettre="connecter">
    <ChampTexte v-model="form.email" label="Adresse e-mail" type="email" requis autocomplete="username" />
    <div class="champ">
      <div class="ligne entre"><label :for="idMdp">Mot de passe</label><RouterLink to="/mot-de-passe-oublie">Mot de passe oublié ?</RouterLink></div>
      <input :id="idMdp" v-model="form.mot_de_passe" type="password" required autocomplete="current-password">
    </div>
  </FormulaireAuth>
</template>
