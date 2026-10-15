<script setup>
// Calendrier accessible (vues jour / semaine / mois) : vrai <table>, <button> natif pour chaque case libre.
// Chaque état a un motif propre (voir style.css) et un libellé texte, visible sur la première case d'un bloc
// et toujours présent en texte réservé aux lecteurs d'écran.
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api.js';
import Icone from './Icone.vue';
import { signalerErreur } from '../store.js';
import { aujourdhui, cle, enMinutes, hhmm, jourCourt, jourPlus, jourSemaine, libelleJour, libelleMois, local, versUtc } from '../temps.js';

const PAS = 30;
const props = defineProps({
  ressource: { type: Object, required: true },
  selection: { type: Object, default: null } // { debut: Date, fin: Date }
});
const emit = defineEmits(['choisir']);

const vue = ref('semaine');
const jourRef = ref(aujourdhui());
const occupations = ref([]);
const maintenant = ref(new Date());
const JOURS_MOIS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const lundi = (j) => jourPlus(j, -jourSemaine(j));

// Première journée affichée et nombre de jours selon la vue
const plage = computed(() => {
  const j = jourRef.value;
  if (vue.value === 'jour') return { debut: j, nb: 1 };
  if (vue.value === 'semaine') return { debut: lundi(j), nb: 7 };
  const suivant = j.m === 12 ? { a: j.a + 1, m: 1, j: 1 } : { a: j.a, m: j.m + 1, j: 1 };
  const debut = lundi({ a: j.a, m: j.m, j: 1 });
  const fin = jourPlus(lundi(jourPlus(suivant, -1)), 7);
  return { debut, nb: Math.round((Date.UTC(fin.a, fin.m - 1, fin.j) - Date.UTC(debut.a, debut.m - 1, debut.j)) / 86400000) };
});

const jours = computed(() => Array.from({ length: plage.value.nb }, (_, i) => jourPlus(plage.value.debut, i)));
const ouverture = computed(() => enMinutes(props.ressource.heure_ouverture));
const heures = computed(() => {
  const liste = [];
  for (let m = ouverture.value; m < enMinutes(props.ressource.heure_fermeture); m += PAS) liste.push(m);
  return liste;
});
const semaines = computed(() => Array.from({ length: Math.ceil(jours.value.length / 7) }, (_, i) => jours.value.slice(i * 7, i * 7 + 7)));
const aujourdhuiCle = computed(() => cle(local(maintenant.value)));

const libellePeriode = computed(() => {
  if (vue.value === 'jour') return libelleJour(jours.value[0]);
  if (vue.value === 'semaine') return `${libelleJour(jours.value[0])} – ${libelleJour(jours.value[6])}`;
  return libelleMois(jourRef.value);
});
const unite = computed(() => ({ jour: 'Jour', semaine: 'Semaine', mois: 'Mois' }[vue.value]));
const classeTable = computed(() => `calendrier ${vue.value}`);

async function charger() {
  const { debut, nb } = plage.value;
  const fin = jourPlus(debut, nb);
  maintenant.value = new Date();
  try {
    occupations.value = await api.get(`/api/ressources/${props.ressource.id}/occupation`, {
      du: versUtc(debut.a, debut.m, debut.j).toISOString(), au: versUtc(fin.a, fin.m, fin.j).toISOString()
    });
  } catch (err) {
    signalerErreur(err);
    occupations.value = [];
  }
}
onMounted(charger);

const changerVue = (v) => { vue.value = v; charger(); };
function deplacer(sens) {
  const j = jourRef.value;
  if (vue.value === 'jour') jourRef.value = jourPlus(j, sens);
  else if (vue.value === 'semaine') jourRef.value = jourPlus(j, 7 * sens);
  else jourRef.value = j.m + sens < 1 ? { a: j.a - 1, m: 12, j: 1 } : j.m + sens > 12 ? { a: j.a + 1, m: 1, j: 1 } : { a: j.a, m: j.m + sens, j: 1 };
  charger();
}
function ouvrirJour(jour) { jourRef.value = jour; vue.value = 'jour'; charger(); }

const instant = (jour, min) => versUtc(jour.a, jour.m, jour.j, Math.floor(min / 60), min % 60);
const occupant = (debut, fin) => occupations.value.find((o) => new Date(o.debut) < fin && new Date(o.fin) > debut);

// État d'une case : type, identifiant du bloc (pour n'afficher le libellé qu'une fois), texte, etc.
function etat(jour, min) {
  const debut = instant(jour, min);
  const fin = new Date(debut.getTime() + PAS * 60000);
  const sel = props.selection;
  const choisi = !!sel && debut >= sel.debut && fin <= sel.fin;
  const o = occupant(debut, fin);
  const lieu = `${libelleJour(jour)}, ${hhmm(min)} à ${hhmm(min + PAS)}`;
  if (o) {
    const attente = o.statut === 'en_attente';
    const texte = o.a_moi ? (attente ? 'Ma demande' : 'Ma réservation') : attente ? 'En attente' : 'Occupé';
    const conflit = !!sel && debut < sel.fin && fin > sel.debut;
    return { cle: `o${o.id}`, classe: o.a_moi ? 'moi' : attente ? 'attente' : 'occupe', texte, lieu, conflit, libre: false };
  }
  if (debut < maintenant.value || !props.ressource.active) {
    const passe = debut < maintenant.value;
    return { cle: passe ? 'passe' : 'ferme', classe: 'ferme', texte: passe ? 'Passé' : 'Fermé', lieu, libre: false };
  }
  return { cle: choisi ? 'choisi' : `l${min}`, classe: choisi ? 'choisi' : '', texte: choisi ? `${hhmm(local(sel.debut).h * 60 + local(sel.debut).min)}–${hhmm(local(sel.fin).h * 60 + local(sel.fin).min)}` : '', lieu, libre: true, choisi, debut, fin };
}

// Cellule + indicateur « première case du bloc » (libellé visible uniquement sur celle-ci)
function cellule(jour, min) {
  const c = etat(jour, min);
  c.premier = min === ouverture.value || etat(jour, min - PAS).cle !== c.cle;
  c.aria = `${libelleJour(jour)}, ${hhmm(min)} à ${hhmm(min + PAS)}, libre`;
  return c;
}

// Un premier clic fixe le début, un second clic plus tard le même jour étend la fin.
function choisir(c) {
  const sel = props.selection;
  const simple = sel && sel.fin - sel.debut === PAS * 60000;
  const memeJour = sel && cle(local(sel.debut)) === cle(local(c.debut));
  if (c.choisi && sel && sel.fin - sel.debut === PAS * 60000) emit('choisir', null); // re-clic : désélection
  else if (simple && memeJour && c.debut > sel.debut && !occupant(sel.debut, c.fin)) emit('choisir', { debut: sel.debut, fin: c.fin });
  else emit('choisir', { debut: c.debut, fin: c.fin });
}

// Vue mois : cases libres restantes et cases prises pour une journée
function resumeJour(jour) {
  const passe = cle(jour) < aujourdhuiCle.value;
  let libres = 0;
  let total = 0;
  for (const m of heures.value) {
    const c = etat(jour, m);
    if (c.classe === 'ferme') continue;
    total++;
    if (c.libre) libres++;
  }
  return { passe, libres, total, occupees: total - libres };
}

// Si la sélection (saisie dans le formulaire) sort de la période affichée, le calendrier s'y déplace
watch(() => props.selection, (sel) => {
  if (!sel) return;
  const c = local(sel.debut);
  if (!jours.value.some((j) => cle(j) === cle(c))) { jourRef.value = { a: c.a, m: c.m, j: c.j }; charger(); }
});

defineExpose({ recharger: charger });
</script>

<template>
  <section class="carte pile" aria-labelledby="t-cal">
    <h2 id="t-cal" class="sr-only">Disponibilités de {{ ressource.nom }}</h2>
    <div class="ligne entre">
      <div class="ligne">
        <button type="button" class="secondaire petit icone-seule" :aria-label="`${unite} précédent${vue === 'semaine' ? 'e' : ''}`" @click="deplacer(-1)"><Icone nom="gauche" /></button>
        <button type="button" class="secondaire petit icone-seule" :aria-label="`${unite} suivant${vue === 'semaine' ? 'e' : ''}`" @click="deplacer(1)"><Icone nom="droite" /></button>
        <strong aria-live="polite">{{ libellePeriode }}</strong>
      </div>
      <div class="onglets" role="group" aria-label="Vue du calendrier">
        <button v-for="v in [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois']]" :key="v[0]" type="button" :aria-pressed="String(vue === v[0])" @click="changerVue(v[0])">{{ v[1] }}</button>
      </div>
    </div>

    <div v-if="vue !== 'mois'" class="defilement" tabindex="0" role="region" aria-label="Calendrier, défilement horizontal">
      <table :class="classeTable">
        <caption class="sr-only">Créneaux de {{ ressource.nom }}. Chaque case correspond à {{ PAS }} minutes.</caption>
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">Horaire</span></th>
            <th v-for="j in jours" :key="cle(j)" scope="col" :aria-current="cle(j) === aujourdhuiCle ? 'date' : undefined">{{ jourCourt(j) }}<b>{{ j.j }}</b></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="min in heures" :key="min">
            <th scope="row">{{ hhmm(min) }}</th>
            <td v-for="j in jours" :key="cle(j)">
              <template v-for="c in [cellule(j, min)]" :key="c.cle">
                <button v-if="c.libre" type="button" :class="['cellule', c.classe]" :aria-pressed="String(c.choisi)" :aria-label="c.aria" @click="choisir(c)">
                  <template v-if="c.choisi && c.premier">{{ c.texte }}</template>
                </button>
                <span v-else :class="['cellule', c.classe, { conflit: c.conflit }]">
                  <span aria-hidden="true">{{ c.premier ? c.texte : '' }}</span><span class="sr-only">{{ hhmm(min) }}, {{ c.texte.toLowerCase() }}</span>
                </span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <table v-else class="calendrier mois">
      <caption class="sr-only">{{ libellePeriode }}, disponibilités de {{ ressource.nom }} par jour</caption>
      <thead><tr><th v-for="d in JOURS_MOIS" :key="d" scope="col">{{ d }}</th></tr></thead>
      <tbody>
        <tr v-for="(semaine, i) in semaines" :key="i">
          <td v-for="j in semaine" :key="cle(j)">
            <template v-for="r in [resumeJour(j)]" :key="`${cle(j)}-${r.libres}`">
              <span v-if="r.passe || !r.total" class="cellule ferme"><b>{{ j.j }}</b><span>{{ r.passe ? 'Passé' : 'Fermé' }}</span></span>
              <button v-else type="button" class="cellule" :aria-label="`${libelleJour(j)}, ${r.libres ? `${r.libres} créneaux libres` : 'complet'}, ouvrir la vue jour`"
                :aria-current="cle(j) === aujourdhuiCle ? 'date' : undefined" @click="ouvrirJour(j)">
                <b>{{ j.j }}</b><span>{{ r.libres ? `${r.libres} libres` : 'Complet' }}</span>
                <progress class="jauge" :max="r.total" :value="r.occupees" aria-hidden="true" />
              </button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>

    <ul class="legende" aria-label="Légende">
      <li><span class="cellule" aria-hidden="true" />Libre</li>
      <li><span class="cellule occupe" aria-hidden="true" />Occupé</li>
      <li><span class="cellule attente" aria-hidden="true" />En attente de validation</li>
      <li><span class="cellule moi" aria-hidden="true" />Ma réservation</li>
      <li><span class="cellule ferme" aria-hidden="true" />Passé / fermé</li>
      <li><span class="cellule choisi" aria-hidden="true" />Sélection</li>
    </ul>
  </section>
</template>
