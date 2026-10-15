<script setup>
// Journal d'audit (MongoDB) : recherche par action, acteur et période, avec pagination numérotée.
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api } from '../../api.js';
import Icone from '../../components/Icone.vue';
import ChampSelect from '../../components/ChampSelect.vue';
import ChampTexte from '../../components/ChampTexte.vue';
import { signalerErreur } from '../../store.js';
import { formaterDateHeure, versUtc } from '../../temps.js';

const PAR_PAGE = 50;
const ACTIONS = ['CONNEXION', 'CONNEXION_ECHEC', 'COMPTE_VERROUILLE', 'DECONNEXION', 'INSCRIPTION', 'MDP_RESET_DEMANDE', 'MDP_RESET', 'RESERVATION_CREEE', 'RESERVATION_MODIFIEE',
  'RESERVATION_ANNULEE', 'RESERVATION_VALIDEE', 'RESERVATION_REFUSEE', 'UTILISATEUR_MODIFIE', 'RESSOURCE_CREEE', 'RESSOURCE_MODIFIEE', 'RESSOURCE_ACTIVATION', 'QUOTA_MODIFIE',
  'DONNEES_EXPORTEES', 'COMPTE_SUPPRIME'];
const options = [{ valeur: '', libelle: 'Toutes' }, ...ACTIONS.map((a) => ({ valeur: a, libelle: a }))];
const filtres = reactive({ action: '', acteur_id: '', du: '', au: '' });
const page = ref(1);
const resultat = ref({ elements: [], total: 0 });
const charge = ref(false);

const nbPages = computed(() => Math.max(1, Math.ceil(resultat.value.total / PAR_PAGE)));
const pages = computed(() => Array.from({ length: nbPages.value }, (_, i) => i + 1).filter((n) => Math.abs(n - page.value) <= 2 || n === 1 || n === nbPages.value));
const info = computed(() => {
  const t = resultat.value.total;
  return t ? `${(page.value - 1) * PAR_PAGE + 1}–${Math.min(t, page.value * PAR_PAGE)} sur ${t} événements` : '0 événement';
});

// Les dates saisies (jour) sont converties en instants ISO : début du jour « du », fin du jour « au »
const debutJour = (s) => { const [a, m, j] = s.split('-').map(Number); return versUtc(a, m, j).toISOString(); };
const finJour = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(versUtc(a, m, j + 1).getTime() - 1).toISOString(); };

async function charger() {
  try {
    resultat.value = await api.get('/api/admin/audit', {
      action: filtres.action, acteur_id: filtres.acteur_id, du: filtres.du ? debutJour(filtres.du) : '', au: filtres.au ? finJour(filtres.au) : '', page: page.value
    });
  } catch (err) { signalerErreur(err); }
  charge.value = true;
}
onMounted(charger);
let minuteur;
watch(filtres, () => { clearTimeout(minuteur); minuteur = setTimeout(() => { page.value = 1; charger(); }, 300); });
const aller = (n) => { page.value = n; charger(); };
const resume = (e) => (e.avant || e.apres ? JSON.stringify({ avant: e.avant, apres: e.apres }) : '—');
</script>

<template>
  <section class="carte" aria-labelledby="t-audit">
    <h2 id="t-audit">Journal d'audit</h2>
    <form class="ligne" role="search" aria-label="Filtrer le journal" @submit.prevent="charger">
      <ChampTexte v-model="filtres.acteur_id" label="Identifiant de l'utilisateur" type="number" min="1" />
      <ChampSelect v-model="filtres.action" label="Action" :options="options" />
      <ChampTexte v-model="filtres.du" label="Du" type="date" />
      <ChampTexte v-model="filtres.au" label="Au" type="date" />
    </form>

    <template v-if="resultat.elements.length">
      <div class="defilement" tabindex="0" role="region" aria-label="Journal d'audit, défilement horizontal">
        <table class="empile">
          <thead><tr><th scope="col">Date et heure</th><th scope="col">Utilisateur</th><th scope="col">Action</th><th scope="col">Cible</th><th scope="col">IP</th><th scope="col">Détail</th></tr></thead>
          <tbody>
            <tr v-for="(e, i) in resultat.elements" :key="i">
              <td data-label="Date" class="mono">{{ formaterDateHeure(e.date) }}</td>
              <td data-label="Utilisateur" class="mono">{{ e.acteur_id ?? '—' }}</td>
              <td data-label="Action"><b>{{ e.action }}</b></td>
              <td data-label="Cible">{{ e.cible ? `${e.cible.type} #${e.cible.id}` : '—' }}</td>
              <td data-label="IP" class="mono">{{ e.ip ?? '—' }}</td>
              <td data-label="Détail" class="doux"><code>{{ resume(e) }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="ligne entre">
        <small class="doux" role="status">{{ info }}</small>
        <nav class="pagination" aria-label="Pagination du journal">
          <button type="button" class="petit" :disabled="page <= 1" @click="aller(page - 1)"><Icone nom="gauche" />Précédent</button>
          <button v-for="n in pages" :key="n" type="button" class="petit" :aria-current="n === page ? 'page' : undefined" :aria-label="`Page ${n}`" @click="aller(n)">{{ n }}</button>
          <button type="button" class="petit" :disabled="page >= nbPages" @click="aller(page + 1)">Suivant<Icone nom="droite" /></button>
        </nav>
      </div>
    </template>
    <p v-else-if="!charge" class="chargement" role="status">Chargement…</p>
    <div v-else class="vide"><Icone nom="recherche" /><strong>Aucun événement ne correspond</strong><p>Modifiez la recherche ou la période.</p></div>
  </section>
</template>
