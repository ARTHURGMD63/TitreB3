<script setup>
// Formulaire commun aux pages d'authentification (titre, sous-titre, erreur, bouton, liens).
import { ref } from 'vue';
import { messageErreur } from '../store.js';

const props = defineProps({
  titre: { type: String, required: true },
  sousTitre: String,
  libelleBouton: { type: String, required: true },
  soumettre: { type: Function, required: true }
});
const erreur = ref('');
const enCours = ref(false);

async function valider() {
  erreur.value = '';
  enCours.value = true;
  try {
    await props.soumettre();
  } catch (err) {
    erreur.value = messageErreur(err);
  } finally {
    enCours.value = false;
  }
}
</script>

<template>
  <form class="pile" @submit.prevent="valider">
    <div class="pile serree"><h1>{{ titre }}</h1><p v-if="sousTitre" class="doux">{{ sousTitre }}</p></div>
    <slot />
    <p v-if="erreur" role="alert" class="message message-erreur"><span>{{ erreur }}</span></p>
    <button type="submit" :disabled="enCours">{{ libelleBouton }}</button>
    <slot name="liens" />
  </form>
</template>
