<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';
import ChampTexte from '../components/ChampTexte.vue';
import FormulaireAuth from '../components/FormulaireAuth.vue';
import { annoncer } from '../store.js';

const router = useRouter();
const form = reactive({ prenom: '', nom: '', email: '', mot_de_passe: '' });
const consentement = ref(false);

async function inscrire() {
  await api.post('/api/auth/register', form);
  annoncer('Compte créé. Vous pouvez vous connecter.', 'ok');
  await router.push({ name: 'connexion' });
}
</script>

<template>
  <FormulaireAuth titre="Créer un compte" sous-titre="Votre profil de quota (élève par défaut) est ajusté ensuite par un administrateur." libelle-bouton="Créer mon compte" :soumettre="inscrire">
    <div class="ligne">
      <ChampTexte v-model="form.prenom" label="Prénom" requis autocomplete="given-name" maxlength="80" />
      <ChampTexte v-model="form.nom" label="Nom" requis autocomplete="family-name" maxlength="80" />
    </div>
    <ChampTexte v-model="form.email" label="Adresse e-mail" type="email" requis autocomplete="email" />
    <ChampTexte v-model="form.mot_de_passe" label="Mot de passe" type="password" requis autocomplete="new-password" minlength="10"
      aide="10 caractères minimum, avec une majuscule, une minuscule et un chiffre." />
    <label class="case">
      <input v-model="consentement" type="checkbox" required>
      <span>J'accepte que mes données soient utilisées pour la gestion des réservations. Je peux les exporter ou les supprimer à tout moment depuis « Mon espace ».</span>
    </label>
  </FormulaireAuth>
</template>
