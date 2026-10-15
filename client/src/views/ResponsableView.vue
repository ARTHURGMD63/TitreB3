<script setup>
// Espace du responsable : demandes à traiter (valider / refuser avec motif) et planning hebdomadaire de ses ressources.
import { computed, onMounted, ref } from 'vue';
import { api } from '../api.js';
import BoiteDialogue from '../components/BoiteDialogue.vue';
import ChampTexte from '../components/ChampTexte.vue';
import Icone from '../components/Icone.vue';
import { annoncer, rafraichirDemandes, session, signalerErreur } from '../store.js';
import { aujourdhui, cle, formaterJourCourt, formaterHeure, jourCourt, jourPlus, jourSemaine, libelleJour, local, versUtc } from '../temps.js';

const demandes = ref([]);
const planning = ref([]);
const ressources = ref([]);
const decalage = ref(0); // semaines par rapport à aujourd'hui
const aRefuser = ref(null);
const motifRefus = ref('');
const motifVide = ref(false);
const charge = ref(false);

const debutSemaine = computed(() => jourPlus(jourPlus(aujourdhui(), -jourSemaine(aujourdhui())), 7 * decalage.value));
const jours = computed(() => Array.from({ length: 7 }, (_, i) => jourPlus(debutSemaine.value, i)));
const lignes = computed(() => ressources.value.map((r) => ({
  ressource: r,
  jours: jours.value.map((j) => planning.value.filter((p) => p.ressource_id === r.id && cle(local(new Date(p.debut))) === cle(j)))
})));

async function recharger() {
  const du = versUtc(debutSemaine.value.a, debutSemaine.value.m, debutSemaine.value.j);
  const fin = jourPlus(debutSemaine.value, 7);
  [demandes.value, planning.value] = await Promise.all([
    api.get('/api/reservations/a-traiter'),
    api.get('/api/reservations/planning', { du: du.toISOString(), au: versUtc(fin.a, fin.m, fin.j).toISOString() })
  ]);
  charge.value = true;
  rafraichirDemandes();
}
onMounted(async () => {
  const toutes = await api.get('/api/ressources');
  ressources.value = session.utilisateur.role === 'admin' ? toutes : toutes.filter((r) => r.responsable_id === session.utilisateur.id);
  await recharger();
});
const semaine = (delta) => { decalage.value += delta; recharger(); };

async function valider(r) {
  try {
    await api.post(`/api/reservations/${r.id}/decision`, { decision: 'validee' });
    annoncer('Demande validée. Le demandeur est prévenu.', 'ok');
    await recharger();
  } catch (err) { signalerErreur(err); }
}

function ouvrirRefus(r) { motifRefus.value = ''; motifVide.value = false; aRefuser.value = r; }
async function refuser() {
  if (!motifRefus.value.trim()) {
    motifVide.value = true;
    throw new Error('Un motif est obligatoire : il est envoyé au demandeur.');
  }
  await api.post(`/api/reservations/${aRefuser.value.id}/decision`, { decision: 'refusee', motif: motifRefus.value });
  annoncer('Demande refusée. Le demandeur est prévenu, avec votre motif.', 'ok');
  await recharger();
}

async function annuler(r) {
  try {
    await api.post(`/api/reservations/${r.id}/annuler`);
    annoncer('Réservation annulée. Le demandeur est prévenu.', 'ok');
    await recharger();
  } catch (err) { signalerErreur(err); }
}
</script>

<template>
  <div class="ligne entre">
    <div><p class="surtitre">Espace responsable</p><h1>Demandes</h1></div>
    <p class="doux">{{ ressources.map((r) => r.nom).join(' · ') || 'Aucune ressource à gérer' }}</p>
  </div>

  <section class="pile" aria-labelledby="t-dem">
    <h2 id="t-dem">En attente de validation <span class="mono doux">{{ demandes.length }}</span></h2>
    <div v-if="demandes.length" class="grille">
      <article v-for="d in demandes" :key="d.id" class="carte">
        <header><span class="badge badge-en_attente">En attente</span></header>
        <h3>{{ d.ressource_nom }}</h3>
        <ul class="meta">
          <li><Icone nom="calendrier" />{{ formaterJourCourt(d.debut) }}, <span class="mono">{{ formaterHeure(d.debut) }}–{{ formaterHeure(d.fin) }}</span></li>
          <li><Icone nom="personnes" />{{ d.demandeur_nom }} · {{ d.demandeur_email }}</li>
        </ul>
        <p v-if="d.motif">« {{ d.motif }} »</p>
        <div class="actions">
          <button type="button" class="secondaire" @click="ouvrirRefus(d)">Refuser<span class="sr-only"> la demande de {{ d.demandeur_nom }}</span></button>
          <button type="button" @click="valider(d)"><Icone nom="check" />Valider<span class="sr-only"> la demande de {{ d.demandeur_nom }}</span></button>
        </div>
      </article>
    </div>
    <p v-else-if="!charge" class="chargement" role="status">Chargement…</p>
    <div v-else class="vide">
      <Icone nom="boite" /><strong>Aucune demande en attente</strong>
      <p>Les nouvelles demandes apparaîtront ici ; vous êtes aussi prévenu par e-mail.</p>
    </div>
  </section>

  <section class="carte" aria-labelledby="t-plan">
    <div class="ligne entre">
      <h2 id="t-plan">Planning de la semaine</h2>
      <div class="ligne">
        <button type="button" class="secondaire petit icone-seule" aria-label="Semaine précédente" @click="semaine(-1)"><Icone nom="gauche" /></button>
        <button type="button" class="secondaire petit icone-seule" aria-label="Semaine suivante" @click="semaine(1)"><Icone nom="droite" /></button>
        <span class="doux mono">{{ libelleJour(jours[0]) }} – {{ libelleJour(jours[6]) }}</span>
      </div>
    </div>
    <div class="defilement" tabindex="0" role="region" aria-label="Planning, défilement horizontal">
      <table class="planning">
        <thead><tr><th scope="col">Ressource</th><th v-for="j in jours" :key="cle(j)" scope="col">{{ jourCourt(j) }} {{ j.j }}</th></tr></thead>
        <tbody>
          <tr v-for="l in lignes" :key="l.ressource.id">
            <th scope="row">{{ l.ressource.nom }}</th>
            <td v-for="(items, i) in l.jours" :key="i">
              <span v-if="!items.length" class="doux">—</span>
              <ul v-else>
                <li v-for="p in items" :key="p.id">
                  <span class="mono">{{ formaterHeure(p.debut) }}–{{ formaterHeure(p.fin) }}</span><span>{{ p.demandeur_nom }}</span>
                  <span v-if="p.statut === 'en_attente'" class="badge badge-en_attente">En attente</span>
                  <button type="button" class="discret petit icone-seule" :aria-label="`Annuler la réservation de ${p.demandeur_nom}`" title="Annuler" @click="annuler(p)"><Icone nom="croix" /></button>
                </li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <BoiteDialogue v-if="aRefuser" titre="Refuser la demande" libelle-valider="Refuser la demande" danger :valider="refuser" @fermer="aRefuser = null">
    <p><b>{{ aRefuser.ressource_nom }}</b>, {{ formaterJourCourt(aRefuser.debut) }} {{ formaterHeure(aRefuser.debut) }}–{{ formaterHeure(aRefuser.fin) }}, {{ aRefuser.demandeur_nom }}</p>
    <ChampTexte v-model="motifRefus" label="Motif du refus (envoyé au demandeur)" multiligne maxlength="300" :invalide="motifVide" aide="Obligatoire : expliquez brièvement votre décision." />
  </BoiteDialogue>
</template>
