<script setup>
// Espace personnel : quota, réservations à venir et passées, modification / annulation, notifications, droits RGPD.
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../api.js';
import BadgeStatut from '../components/BadgeStatut.vue';
import BoiteDialogue from '../components/BoiteDialogue.vue';
import Icone from '../components/Icone.vue';
import ModifierReservation from '../components/ModifierReservation.vue';
import { annoncer, session, signalerErreur } from '../store.js';
import { formaterDateHeure, formaterJourCourt, horaire } from '../temps.js';

const DELAI_MODIF_MS = 24 * 3600 * 1000;
const router = useRouter();
const periode = ref('avenir');
const quota = ref(null);
const reservations = ref([]);
const notifications = ref([]);
const aModifier = ref(null);
const aAnnuler = ref(null);
const suppression = ref(false);
const charge = ref(false);
const nonLus = computed(() => notifications.value.some((n) => !n.lue));
const quotaAlerte = computed(() => !!quota.value && quota.value.reservations_actives / quota.value.reservations_max >= 0.85);

async function recharger() {
  const [q, liste, notifs] = await Promise.all([api.get('/api/me/quota'), api.get('/api/reservations/mes', { periode: periode.value }), api.get('/api/me/notifications')]);
  quota.value = q;
  reservations.value = liste;
  notifications.value = notifs.slice(0, 10);
  charge.value = true;
}
onMounted(recharger);

const active = (r) => ['en_attente', 'validee'].includes(r.statut) && new Date(r.fin) > new Date();
const modifiable = (r) => active(r) && new Date(r.debut) - new Date() >= DELAI_MODIF_MS;
const annulable = (r) => active(r) && new Date(r.debut) > new Date();
const choisirPeriode = (p) => { periode.value = p; recharger(); };

async function annuler() {
  await api.post(`/api/reservations/${aAnnuler.value.id}/annuler`);
  annoncer('Réservation annulée. Le créneau est libéré et votre quota recrédité.', 'ok');
  await recharger();
}

async function toutMarquerLu() {
  try {
    await api.post('/api/me/notifications/lues');
    notifications.value = notifications.value.map((n) => ({ ...n, lue: true }));
  } catch (err) { signalerErreur(err); }
}

async function exporter() {
  try {
    const donnees = await api.get('/api/me/export');
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' }));
    lien.download = 'creneau-mes-donnees.json';
    lien.click();
    URL.revokeObjectURL(lien.href);
    annoncer('Export prêt. Le fichier creneau-mes-donnees.json a été téléchargé.', 'ok');
  } catch (err) { signalerErreur(err); }
}

async function supprimerCompte() {
  await api.delete('/api/me');
  session.utilisateur = null;
  await router.push({ name: 'connexion' });
  annoncer('Compte supprimé. Vos données personnelles ont été anonymisées.', 'ok');
}
</script>

<template>
  <div class="ligne entre">
    <div><p class="surtitre">Bonjour {{ session.utilisateur.prenom }}</p><h1>Mon espace</h1></div>
    <RouterLink class="bouton" to="/"><Icone nom="plus" />Nouvelle réservation</RouterLink>
  </div>

  <div class="fiche">
    <div class="pile">
      <section v-if="quota" class="carte" aria-labelledby="t-quota">
        <div class="ligne entre"><h2 id="t-quota">Mon quota</h2><span class="doux">{{ quota.profil }}</span></div>
        <p><strong class="mono">{{ quota.reservations_actives }}</strong> <span class="doux">réservation(s) active(s) sur {{ quota.reservations_max }}, il en reste {{ quota.reservations_restantes }}</span></p>
        <progress :class="['jauge', { alerte: quotaAlerte }]" :max="quota.reservations_max" :value="quota.reservations_actives">{{ quota.reservations_actives }} sur {{ quota.reservations_max }}</progress>
        <small class="doux">Durée maximale {{ quota.duree_max_minutes }} min par réservation, jusqu'à {{ quota.delai_max_jours }} jours à l'avance. Les demandes en attente sont décomptées.</small>
      </section>

      <section class="carte" aria-labelledby="t-res">
        <div class="ligne entre">
          <h2 id="t-res">Mes réservations</h2>
          <div class="onglets" role="group" aria-label="Période">
            <button type="button" :aria-pressed="String(periode === 'avenir')" @click="choisirPeriode('avenir')">À venir</button>
            <button type="button" :aria-pressed="String(periode === 'passe')" @click="choisirPeriode('passe')">Passées</button>
          </div>
        </div>
        <div v-if="reservations.length" class="defilement">
          <table class="empile">
            <thead><tr><th scope="col">Ressource</th><th scope="col">Date</th><th scope="col">Horaire</th><th scope="col">Statut</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              <tr v-for="r in reservations" :key="r.id">
                <td data-label="Ressource"><span><b>{{ r.ressource_nom }}</b><small v-if="r.motif_decision">Motif : {{ r.motif_decision }}</small></span></td>
                <td data-label="Date" class="nowrap">{{ formaterJourCourt(r.debut) }}</td>
                <td data-label="Horaire" class="mono">{{ horaire(r.debut, r.fin) }}</td>
                <td data-label="Statut"><BadgeStatut :statut="r.statut" /></td>
                <td data-label="">
                  <div class="actions">
                    <button v-if="modifiable(r)" type="button" class="secondaire petit" @click="aModifier = r"><Icone nom="crayon" />Modifier<span class="sr-only"> {{ r.ressource_nom }}</span></button>
                    <button v-if="annulable(r)" type="button" class="secondaire petit" @click="aAnnuler = r">Annuler<span class="sr-only"> {{ r.ressource_nom }}</span></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="!charge" class="chargement" role="status">Chargement…</p>
        <div v-else class="vide">
          <Icone nom="calendrier" /><strong>Aucune réservation {{ periode === 'avenir' ? 'à venir' : 'passée' }}</strong>
          <p>Parcourez le catalogue pour réserver une salle ou du matériel.</p>
          <RouterLink class="bouton secondaire" to="/">Ouvrir le catalogue</RouterLink>
        </div>
      </section>
    </div>

    <aside class="pile">
      <section class="carte" aria-labelledby="t-notif">
        <div class="ligne entre"><h2 id="t-notif">Notifications</h2><button v-if="nonLus" type="button" class="discret petit" @click="toutMarquerLu">Tout marquer comme lu</button></div>
        <ul v-if="notifications.length" class="liste">
          <li v-for="n in notifications" :key="n.id" :class="{ 'non-lu': !n.lue }">
            <div class="pile serree"><p><span v-if="!n.lue" class="sr-only">Non lu : </span>{{ n.message }}</p><small class="doux">{{ formaterDateHeure(n.cree_le) }}</small></div>
          </li>
        </ul>
        <div v-else class="vide"><Icone nom="cloche" /><strong>Aucune notification</strong><p>Vous serez prévenu ici des validations et des rappels.</p></div>
      </section>

      <section class="carte" aria-labelledby="t-rgpd">
        <h2 id="t-rgpd">Mes données</h2>
        <p class="doux">Vous pouvez télécharger l'ensemble de vos données (profil, réservations, notifications, journal) ou demander la suppression de votre compte.</p>
        <div class="actions">
          <button type="button" class="secondaire" @click="exporter"><Icone nom="telecharger" />Exporter</button>
          <button type="button" class="danger" @click="suppression = true">Supprimer mon compte</button>
        </div>
      </section>
    </aside>
  </div>

  <ModifierReservation v-if="aModifier" :reservation="aModifier" @fermer="aModifier = null" @modifiee="recharger" />
  <BoiteDialogue v-if="aAnnuler" titre="Annuler cette réservation ?" libelle-valider="Annuler la réservation" danger :valider="annuler" @fermer="aAnnuler = null">
    <p><b>{{ aAnnuler.ressource_nom }}</b>, {{ formaterDateHeure(aAnnuler.debut) }}</p>
    <p class="doux">Le créneau sera libéré immédiatement et votre quota recrédité.</p>
  </BoiteDialogue>
  <BoiteDialogue v-if="suppression" titre="Supprimer votre compte ?" libelle-valider="Supprimer définitivement" danger :valider="supprimerCompte" @fermer="suppression = false">
    <p>Votre compte sera anonymisé de façon définitive : vous ne pourrez plus vous connecter. Vos réservations passées sont conservées sans lien avec votre identité.</p>
  </BoiteDialogue>
</template>
