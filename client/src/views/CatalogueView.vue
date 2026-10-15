<script setup>
// Catalogue : filtres appliqués en direct (recherche, type, capacité, disponibilité à une date).
import { onMounted, reactive, ref, watch } from 'vue';
import { api } from '../api.js';
import CarteRessource from '../components/CarteRessource.vue';
import ChampSelect from '../components/ChampSelect.vue';
import ChampTexte from '../components/ChampTexte.vue';
import Icone from '../components/Icone.vue';
import { signalerErreur } from '../store.js';
import { aujourdhui, cle } from '../temps.js';

const filtres = reactive({ q: '', type: '', capacite_min: '', date: cle(aujourdhui()) });
const ressources = ref([]);
const charge = ref(false);
const types = [{ valeur: '', libelle: 'Tout' }, { valeur: 'salle', libelle: 'Salles' }, { valeur: 'materiel', libelle: 'Matériel' }];
const capacites = [{ valeur: '', libelle: 'Indifférente' }, { valeur: 10, libelle: '10 et plus' }, { valeur: 20, libelle: '20 et plus' }, { valeur: 50, libelle: '50 et plus' }];

async function charger() {
  try {
    ressources.value = await api.get('/api/ressources', filtres);
  } catch (err) {
    signalerErreur(err);
  } finally {
    charge.value = true;
  }
}
onMounted(charger);

// Application en direct ; la recherche texte est temporisée pour limiter les requêtes
let minuteur;
watch(() => [filtres.type, filtres.capacite_min, filtres.date], charger);
watch(() => filtres.q, () => { clearTimeout(minuteur); minuteur = setTimeout(charger, 250); });

function reinitialiser() {
  Object.assign(filtres, { q: '', type: '', capacite_min: '', date: cle(aujourdhui()) });
}
</script>

<template>
  <div class="ligne entre">
    <div><p class="surtitre">Réserver une ressource</p><h1>Catalogue</h1></div>
    <p class="doux" role="status">{{ charge ? `${ressources.length} ressource${ressources.length > 1 ? 's' : ''}` : '' }}</p>
  </div>

  <form class="ligne" role="search" aria-label="Filtrer le catalogue" @submit.prevent="charger">
    <ChampTexte v-model="filtres.q" label="Recherche" type="search" placeholder="Salle, lieu…" maxlength="80" />
    <div class="champ">
      <span id="f-type" class="libelle">Type</span>
      <div class="onglets" role="group" aria-labelledby="f-type">
        <button v-for="t in types" :key="t.valeur" type="button" :aria-pressed="String(filtres.type === t.valeur)" @click="filtres.type = t.valeur">{{ t.libelle }}</button>
      </div>
    </div>
    <ChampSelect v-model="filtres.capacite_min" label="Capacité minimale" :options="capacites" />
    <ChampTexte v-model="filtres.date" label="Date" type="date" />
  </form>

  <h2 v-if="ressources.length" class="sr-only">Ressources</h2>
  <div v-if="ressources.length" class="grille">
    <CarteRessource v-for="r in ressources" :key="r.id" :ressource="r" />
  </div>
  <p v-else-if="!charge" class="chargement" role="status">Chargement du catalogue…</p>
  <div v-else class="vide">
    <Icone nom="recherche" /><strong>Aucune ressource ne correspond</strong>
    <p>Essayez une capacité plus faible ou un autre mot-clé.</p>
    <button type="button" class="secondaire" @click="reinitialiser">Réinitialiser les filtres</button>
  </div>
</template>
