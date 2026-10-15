<script setup>
// Statistiques : indicateurs clés, occupation par ressource, ressources les plus demandées et carte de chaleur.
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../../api.js';
import ChampTexte from '../../components/ChampTexte.vue';
import { signalerErreur } from '../../store.js';
import { aujourdhui, cle, jourPlus } from '../../temps.js';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const BANDES = [[8, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 20]];
const periode = reactive({ du: cle(jourPlus(aujourdhui(), -30)), au: cle(jourPlus(aujourdhui(), 1)) });
const stats = ref(null);

async function charger() {
  try { stats.value = await api.get('/api/admin/stats', periode); }
  catch (err) { signalerErreur(err); }
}
onMounted(charger);

const tauxMoyen = computed(() => {
  const liste = stats.value?.occupation ?? [];
  return liste.length ? Math.round(liste.reduce((s, o) => s + Number(o.taux_occupation ?? 0), 0) / liste.length) : 0;
});
const maxDemandes = computed(() => Math.max(1, ...(stats.value?.plus_demandees ?? []).map((r) => r.nb_demandes)));
const plusChargee = computed(() => stats.value?.creneaux_satures?.[0]);
const nbPrises = computed(() => stats.value?.occupation.filter((o) => o.minutes_reservees > 0).length ?? 0);

// Carte de chaleur : réservations par jour et par plage de 2 h, en pourcentage de la plage la plus chargée
const chaleur = computed(() => {
  const cases = stats.value?.creneaux_satures ?? [];
  const compte = (jour, [de, a]) => cases.filter((c) => c.jour_semaine === jour && c.heure >= de && c.heure < a).reduce((s, c) => s + c.nb_reservations, 0);
  const grille = [1, 2, 3, 4, 5, 6, 7].map((j) => BANDES.map((b) => compte(j, b)));
  const max = Math.max(1, ...grille.flat());
  return grille.map((ligne, i) => ({
    jour: JOURS[i + 1],
    valeurs: ligne.map((n) => { const pct = Math.round((100 * n) / max); return { pct, niveau: n === 0 ? undefined : pct > 75 ? 4 : pct > 50 ? 3 : pct > 25 ? 2 : 1 }; })
  }));
});
</script>

<template>
  <form class="ligne" @submit.prevent="charger">
    <ChampTexte v-model="periode.du" label="Du" type="date" />
    <ChampTexte v-model="periode.au" label="Au (exclu)" type="date" />
    <div class="champ"><button type="submit">Calculer</button></div>
  </form>

  <template v-if="stats">
    <div class="grille" aria-live="polite">
      <div class="carte stat"><p class="surtitre">Taux d'occupation</p><strong>{{ tauxMoyen }} %</strong><progress class="jauge" max="100" :value="tauxMoyen">{{ tauxMoyen }} %</progress><small class="doux">Moyenne des ressources, heures d'ouverture</small></div>
      <div class="carte stat"><p class="surtitre">Réservations</p><strong>{{ stats.annulations.nb_total }}</strong><small class="doux">Sur la période, {{ nbPrises }} ressource(s) utilisée(s)</small></div>
      <div class="carte stat"><p class="surtitre">Annulations</p><strong>{{ stats.annulations.nb_annulations }}</strong><small class="doux">{{ stats.annulations.taux_annulation ?? 0 }} % des réservations</small></div>
      <div class="carte stat"><p class="surtitre">Créneau le plus chargé</p><strong>{{ plusChargee ? `${plusChargee.heure} h` : '—' }}</strong><small class="doux">{{ plusChargee ? `${JOURS[plusChargee.jour_semaine]}, ${plusChargee.nb_reservations} réservation(s)` : 'Pas de données' }}</small></div>
    </div>

    <div class="fiche">
      <section class="carte" aria-labelledby="t-occ">
        <h2 id="t-occ">Occupation par ressource</h2>
        <ul class="liste barres">
          <li v-for="o in stats.occupation" :key="o.id">
            <span>{{ o.nom }}</span>
            <progress :class="['jauge', { alerte: Number(o.taux_occupation) >= 85 }]" max="100" :value="Number(o.taux_occupation ?? 0)">{{ o.taux_occupation ?? 0 }} %</progress>
            <span class="mono">{{ o.taux_occupation ?? 0 }} %</span>
          </li>
        </ul>
      </section>
      <section class="carte" aria-labelledby="t-top">
        <h2 id="t-top">Les plus réservées</h2>
        <ol v-if="stats.plus_demandees.length" class="liste barres">
          <li v-for="r in stats.plus_demandees" :key="r.id"><span>{{ r.nom }}</span><progress class="jauge" :max="maxDemandes" :value="r.nb_demandes">{{ r.nb_demandes }}</progress><span class="mono">{{ r.nb_demandes }}</span></li>
        </ol>
        <p v-else class="doux">Aucune réservation sur la période.</p>
      </section>
    </div>

    <section class="carte" aria-labelledby="t-sat">
      <div class="ligne entre"><h2 id="t-sat">Créneaux saturés</h2><span class="doux">Réservations par plage de 2 h, en % de la plage la plus chargée</span></div>
      <div class="defilement" tabindex="0" role="region" aria-label="Créneaux saturés, défilement horizontal">
        <table class="chaleur">
          <thead><tr><th scope="col"><span class="sr-only">Jour</span></th><th v-for="b in BANDES" :key="b[0]" scope="col">{{ String(b[0]).padStart(2, '0') }}–{{ b[1] }}</th></tr></thead>
          <tbody>
            <tr v-for="l in chaleur" :key="l.jour"><th scope="row">{{ l.jour }}</th><td v-for="(v, i) in l.valeurs" :key="i" :data-niveau="v.niveau">{{ v.pct }} %</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="carte" aria-labelledby="t-statuts">
      <h2 id="t-statuts">Répartition par statut</h2>
      <ul class="etiquettes"><li v-for="x in stats.statuts" :key="x.statut">{{ x.statut }} : {{ x.nb }}</li></ul>
    </section>
  </template>
  <p v-else class="chargement" role="status">Calcul en cours…</p>
</template>
