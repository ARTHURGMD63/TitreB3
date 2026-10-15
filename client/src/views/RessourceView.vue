<script setup>
// Fiche d'une ressource : calendrier + formulaire de réservation (avec créneaux alternatifs en cas de conflit).
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api.js';
import CalendrierRessource from '../components/CalendrierRessource.vue';
import ChampSelect from '../components/ChampSelect.vue';
import ChampTexte from '../components/ChampTexte.vue';
import Icone from '../components/Icone.vue';
import { annoncer, rafraichirDemandes, signalerErreur } from '../store.js';
import { aujourdhui, cle, enMinutes, formaterDate, formaterHeure, hhmm, local, versUtc } from '../temps.js';

const PAS = 30;
const route = useRoute();
const ressource = ref(null);
const quota = ref(null);
const calendrier = ref(null);
const selection = ref(null);
const manuel = ref(false);
const alternatives = ref([]);
const enCours = ref(false);
const form = reactive({ date: cle(aujourdhui()), debut: '08:00', fin: '09:00', motif: '' });

async function chargerQuota() { quota.value = await api.get('/api/me/quota').catch(() => null); }
onMounted(async () => {
  ressource.value = await api.get(`/api/ressources/${route.params.id}`);
  await chargerQuota();
  form.debut = ressource.value.heure_ouverture;
  form.fin = hhmm(enMinutes(ressource.value.heure_ouverture) + 60);
});

const options = (de, a) => {
  const liste = [];
  for (let m = de; m <= a; m += PAS) liste.push({ valeur: hhmm(m), libelle: hhmm(m) });
  return liste;
};
const optionsDebut = computed(() => options(enMinutes(ressource.value.heure_ouverture), enMinutes(ressource.value.heure_fermeture) - PAS));
const optionsFin = computed(() => options(enMinutes(ressource.value.heure_ouverture) + PAS, enMinutes(ressource.value.heure_fermeture)));
const hasSel = computed(() => !!selection.value || manuel.value);
const ordreInvalide = computed(() => enMinutes(form.fin) <= enMinutes(form.debut));

// Quota : réservations actives, plus celle en cours de saisie
const depasse = computed(() => !!quota.value && quota.value.reservations_restantes <= 0);
const quotaValeur = computed(() => (quota.value ? Math.min(quota.value.reservations_max, quota.value.reservations_actives + (hasSel.value && !depasse.value ? 1 : 0)) : 0));
const quotaAlerte = computed(() => !!quota.value && quotaValeur.value / quota.value.reservations_max >= 0.85);
const impossible = computed(() => !hasSel.value || ordreInvalide.value || depasse.value || enCours.value);

function creneau() {
  const [a, m, j] = form.date.split('-').map(Number);
  const d = enMinutes(form.debut);
  const f = enMinutes(form.fin);
  return { debut: versUtc(a, m, j, Math.floor(d / 60), d % 60), fin: versUtc(a, m, j, Math.floor(f / 60), f % 60) };
}

// Calendrier -> formulaire
function choisir(sel) {
  selection.value = sel;
  alternatives.value = [];
  if (!sel) return;
  const d = local(sel.debut);
  const f = local(new Date(sel.fin.getTime() - 1));
  form.date = cle(d);
  form.debut = hhmm(d.h * 60 + d.min);
  form.fin = hhmm(f.h * 60 + f.min + 1);
}
// Formulaire -> calendrier (nextTick : laisse d'abord le v-model mettre à jour le formulaire)
function synchroniser() {
  nextTick(() => {
    if (!form.date || ordreInvalide.value) return;
    selection.value = creneau();
  });
}

async function reserver() {
  alternatives.value = [];
  const c = creneau();
  enCours.value = true;
  try {
    const r = await api.post('/api/reservations', { ressource_id: ressource.value.id, debut: c.debut.toISOString(), fin: c.fin.toISOString(), motif: form.motif });
    annoncer(r.statut === 'en_attente' ? 'Demande envoyée. Elle est en attente de validation.' : 'Réservation confirmée. Un rappel vous sera envoyé la veille.', 'ok');
    selection.value = null;
    manuel.value = false;
    form.motif = '';
    await Promise.all([calendrier.value.recharger(), chargerQuota(), rafraichirDemandes()]);
  } catch (err) {
    if (err.corps?.alternatives) alternatives.value = err.corps.alternatives;
    else signalerErreur(err);
  } finally {
    enCours.value = false;
  }
}

function appliquer(p) {
  choisir({ debut: new Date(p.debut), fin: new Date(p.fin) });
}
</script>

<template>
  <template v-if="ressource">
    <RouterLink to="/"><Icone nom="gauche" /> Catalogue</RouterLink>
    <div class="ligne entre">
      <div><p class="surtitre">{{ ressource.type === 'salle' ? 'Salle' : 'Matériel' }} · {{ ressource.localisation || 'lieu non précisé' }}</p><h1>{{ ressource.nom }}</h1></div>
      <ul class="meta">
        <li><Icone nom="personnes" />{{ ressource.capacite }} {{ ressource.capacite > 1 ? 'places' : 'place' }}</li>
        <li><Icone nom="horloge" /><span class="mono">{{ ressource.heure_ouverture }}–{{ ressource.heure_fermeture }}</span></li>
        <li v-if="ressource.equipements.length">{{ ressource.equipements.join(', ') }}</li>
      </ul>
    </div>
    <p v-if="!ressource.active" class="message message-erreur" role="alert">
      <span><strong>Ressource indisponible.</strong> {{ ressource.motif_indisponibilite || 'Elle ne peut pas être réservée pour le moment.' }}</span>
    </p>

    <div class="fiche">
      <CalendrierRessource ref="calendrier" :ressource="ressource" :selection="selection" @choisir="choisir" />

      <aside v-if="ressource.active" class="carte pile" aria-labelledby="t-resa">
        <h2 id="t-resa">Réserver</h2>
        <form class="pile" @submit.prevent="reserver">
          <template v-if="hasSel">
            <ChampTexte v-model="form.date" label="Date" type="date" requis :min="cle(aujourdhui())" @change="synchroniser" />
            <div class="ligne">
              <ChampSelect v-model="form.debut" label="Début" :options="optionsDebut" @change="synchroniser" />
              <ChampSelect v-model="form.fin" label="Fin" :options="optionsFin" :aria-invalid="ordreInvalide ? 'true' : undefined" @change="synchroniser" />
            </div>
          </template>
          <div v-else class="vide">
            <Icone nom="calendrier" />
            <p>Cliquez une case libre pour fixer le début, puis une seconde pour la fin.</p>
            <button type="button" class="secondaire petit" @click="manuel = true">Saisir les horaires</button>
          </div>

          <p v-if="hasSel && ordreInvalide" class="message message-erreur" role="alert"><span>L'heure de fin doit suivre l'heure de début.</span></p>
          <div v-if="alternatives.length" class="message message-erreur" role="alert">
            <div class="pile serree">
              <p><strong>Créneau indisponible.</strong> Il chevauche une réservation existante. Créneaux libres de même durée :</p>
              <div class="ligne">
                <button v-for="p in alternatives" :key="p.debut" type="button" class="secondaire petit" @click="appliquer(p)">
                  {{ formaterDate(p.debut).replace(/ \d{4}$/, '') }}, {{ formaterHeure(p.debut) }}–{{ formaterHeure(p.fin) }}
                </button>
              </div>
            </div>
          </div>

          <ChampTexte v-model="form.motif" label="Motif" multiligne maxlength="300" placeholder="ex. Conseil de classe" />

          <div v-if="quota" class="pile serree">
            <div class="ligne entre"><b>Quota</b><span class="mono">{{ quotaValeur }} / {{ quota.reservations_max }}</span></div>
            <progress :class="['jauge', { alerte: quotaAlerte }]" :max="quota.reservations_max" :value="quotaValeur">{{ quotaValeur }} sur {{ quota.reservations_max }}</progress>
            <small class="doux">{{ quota.reservations_actives }} réservation(s) active(s){{ hasSel && !depasse ? ', + 1 avec cette demande' : '' }}. Durée maximale {{ quota.duree_max_minutes }} min, jusqu'à {{ quota.delai_max_jours }} jours à l'avance.</small>
          </div>
          <p v-if="depasse" class="message message-erreur" role="alert"><span>Votre quota de réservations actives est atteint.</span></p>

          <button type="submit" :disabled="impossible">{{ ressource.validation_requise ? 'Envoyer la demande' : 'Réserver ce créneau' }}</button>
          <small class="doux">{{ ressource.validation_requise ? `Réponse après validation par ${ressource.responsable_nom || 'le responsable'}.` : 'Confirmation immédiate, sans validation.' }}</small>
        </form>
      </aside>
    </div>
  </template>
  <p v-else class="chargement" role="status">Chargement…</p>
</template>
