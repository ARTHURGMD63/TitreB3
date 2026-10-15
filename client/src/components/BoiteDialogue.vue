<script setup>
// Boîte de dialogue modale native (<dialog>) : focus piégé et fermeture par Échap gérés par le navigateur.
// Utilisation : <BoiteDialogue v-if="ouverte" titre="…" :valider="fn" @fermer="ouverte = false">…</BoiteDialogue>
import { onMounted, ref, useId } from 'vue';
import { messageErreur } from '../store.js';

const props = defineProps({
  titre: { type: String, required: true },
  libelleValider: { type: String, default: 'Valider' },
  danger: Boolean,
  valider: { type: Function, required: true }
});
const emit = defineEmits(['fermer']);
const dialogue = ref(null);
const erreur = ref('');
const enCours = ref(false);
const idTitre = useId();

onMounted(() => dialogue.value.showModal());

async function soumettre() {
  erreur.value = '';
  enCours.value = true;
  try {
    await props.valider();
    dialogue.value.close();
  } catch (err) {
    erreur.value = messageErreur(err);
  } finally {
    enCours.value = false;
  }
}
</script>

<template>
  <dialog ref="dialogue" :aria-labelledby="idTitre" @close="emit('fermer')">
    <form method="dialog" @submit.prevent="soumettre">
      <h2 :id="idTitre">{{ titre }}</h2>
      <slot />
      <p v-if="erreur" role="alert" class="message message-erreur"><span>{{ erreur }}</span></p>
      <div class="actions">
        <button type="button" class="secondaire" @click="dialogue.close()">Annuler</button>
        <button type="submit" :class="{ danger }" :disabled="enCours">{{ libelleValider }}</button>
      </div>
    </form>
  </dialog>
</template>
