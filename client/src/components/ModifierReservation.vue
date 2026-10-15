<script setup>
// Boîte de dialogue de modification d'une réservation (date, début, fin, motif).
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api.js';
import BoiteDialogue from './BoiteDialogue.vue';
import ChampSelect from './ChampSelect.vue';
import ChampTexte from './ChampTexte.vue';
import { annoncer, signalerErreur } from '../store.js';
import { cle, enMinutes, hhmm, local, versUtc } from '../temps.js';

const props = defineProps({ reservation: { type: Object, required: true } });
const emit = defineEmits(['fermer', 'modifiee']);

const ressource = ref(null);
const d = local(new Date(props.reservation.debut));
const f = local(new Date(new Date(props.reservation.fin).getTime() - 1));
const form = reactive({ date: cle(d), debut: hhmm(d.h * 60 + d.min), fin: hhmm(f.h * 60 + f.min + 1), motif: props.reservation.motif });

onMounted(async () => {
  try { ressource.value = await api.get(`/api/ressources/${props.reservation.ressource_id}`); }
  catch (err) { signalerErreur(err); emit('fermer'); }
});

const options = (a, b) => {
  const liste = [];
  for (let m = a; m <= b; m += 30) liste.push({ valeur: hhmm(m), libelle: hhmm(m) });
  return liste;
};

async function enregistrer() {
  const [a, m, j] = form.date.split('-').map(Number);
  const deb = enMinutes(form.debut);
  const fin = enMinutes(form.fin);
  await api.put(`/api/reservations/${props.reservation.id}`, {
    debut: versUtc(a, m, j, Math.floor(deb / 60), deb % 60).toISOString(),
    fin: versUtc(a, m, j, Math.floor(fin / 60), fin % 60).toISOString(),
    motif: form.motif
  });
  annoncer('Réservation modifiée.', 'ok');
  emit('modifiee');
}
</script>

<template>
  <BoiteDialogue v-if="ressource" :titre="`Modifier la réservation de ${reservation.ressource_nom}`" libelle-valider="Enregistrer" :valider="enregistrer" @fermer="emit('fermer')">
    <div class="ligne">
      <ChampTexte v-model="form.date" label="Date" type="date" requis />
      <ChampSelect v-model="form.debut" label="Début" :options="options(enMinutes(ressource.heure_ouverture), enMinutes(ressource.heure_fermeture) - 30)" />
      <ChampSelect v-model="form.fin" label="Fin" :options="options(enMinutes(ressource.heure_ouverture) + 30, enMinutes(ressource.heure_fermeture))" />
    </div>
    <ChampTexte v-model="form.motif" label="Motif" maxlength="300" />
    <p v-if="ressource.validation_requise" class="doux">Après modification, la demande repasse en attente de validation.</p>
  </BoiteDialogue>
</template>
