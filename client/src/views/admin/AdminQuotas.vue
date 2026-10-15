<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../../api.js';
import { annoncer, signalerErreur } from '../../store.js';

const profils = ref([]);
onMounted(async () => { profils.value = await api.get('/api/admin/profils-quota'); });

async function enregistrer() {
  try {
    await Promise.all(profils.value.map((p) => api.patch(`/api/admin/profils-quota/${p.id}`, {
      max_reservations_actives: Number(p.max_reservations_actives), duree_max_minutes: Number(p.duree_max_minutes), delai_max_jours: Number(p.delai_max_jours)
    })));
    annoncer('Quotas enregistrés. Ils s\'appliquent aux prochaines réservations.', 'ok');
  } catch (err) { signalerErreur(err); }
}
</script>

<template>
  <section class="carte" aria-labelledby="t-quotas">
    <div class="pile serree"><h2 id="t-quotas">Quotas par profil</h2><p class="doux">Les réservations en attente et validées à venir comptent dans le nombre de réservations actives.</p></div>
    <form class="pile" @submit.prevent="enregistrer">
      <div class="defilement">
        <table class="empile">
          <thead><tr><th scope="col">Profil</th><th scope="col">Réservations actives</th><th scope="col">Durée max. (min)</th><th scope="col">Anticipation max. (jours)</th></tr></thead>
          <tbody>
            <tr v-for="p in profils" :key="p.id">
              <td data-label="Profil"><b>{{ p.libelle }}</b></td>
              <td data-label="Actives"><input v-model="p.max_reservations_actives" type="number" min="1" max="100" :aria-label="`Réservations actives maximum, profil ${p.libelle}`"></td>
              <td data-label="Durée"><input v-model="p.duree_max_minutes" type="number" min="30" max="1440" step="30" :aria-label="`Durée maximale en minutes, profil ${p.libelle}`"></td>
              <td data-label="Anticipation"><input v-model="p.delai_max_jours" type="number" min="1" max="365" :aria-label="`Anticipation maximale en jours, profil ${p.libelle}`"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="actions"><button type="submit">Enregistrer les quotas</button></div>
    </form>
  </section>
</template>
