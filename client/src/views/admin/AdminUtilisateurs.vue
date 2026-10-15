<script setup>
// Comptes : le rôle, le profil de quota et l'état du compte s'enregistrent dès qu'on les modifie.
import { computed, nextTick, onMounted, ref } from 'vue';
import { api } from '../../api.js';
import ChampTexte from '../../components/ChampTexte.vue';
import ChampSelect from '../../components/ChampSelect.vue';
import { annoncer, signalerErreur } from '../../store.js';

const utilisateurs = ref([]);
const profils = ref([]);
const recherche = ref('');
const ROLES = [{ valeur: 'utilisateur', libelle: 'Utilisateur' }, { valeur: 'responsable', libelle: 'Responsable' }, { valeur: 'admin', libelle: 'Administrateur' }];

async function charger() {
  const [u, p] = await Promise.all([api.get('/api/admin/utilisateurs'), api.get('/api/admin/profils-quota')]);
  profils.value = p.map((x) => ({ valeur: x.id, libelle: x.libelle }));
  utilisateurs.value = u;
}
onMounted(charger);

const filtres = computed(() => {
  const q = recherche.value.trim().toLowerCase();
  return utilisateurs.value.filter((u) => !q || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q));
});

async function enregistrer(u) {
  await nextTick(); // laisse d'abord le v-model mettre à jour la ligne
  try {
    await api.patch(`/api/admin/utilisateurs/${u.id}`, { role: u.role, profil_quota_id: Number(u.profil_quota_id), actif: u.actif });
    annoncer(`Compte enregistré. ${u.email} a été mis à jour.`, 'ok');
  } catch (err) {
    signalerErreur(err);
    await charger(); // retour à l'état réel après un refus du serveur
  }
}
</script>

<template>
  <section class="carte" aria-labelledby="t-users">
    <div class="ligne entre">
      <h2 id="t-users">Utilisateurs <span class="mono doux">{{ filtres.length }}</span></h2>
      <ChampTexte v-model="recherche" label="Rechercher un utilisateur" masquer-label type="search" placeholder="Nom ou e-mail" />
    </div>
    <div class="defilement">
      <table class="empile">
        <thead><tr><th scope="col">Nom</th><th scope="col">Rôle</th><th scope="col">Profil</th><th scope="col">Compte</th></tr></thead>
        <tbody>
          <tr v-for="u in filtres" :key="u.id">
            <td data-label="Nom"><span><b>{{ u.prenom }} {{ u.nom }}</b><small>{{ u.email }}</small></span></td>
            <td data-label="Rôle"><ChampSelect v-model="u.role" :label="`Rôle de ${u.email}`" masquer-label :options="ROLES" @change="enregistrer(u)" /></td>
            <td data-label="Profil"><ChampSelect v-model="u.profil_quota_id" :label="`Profil de ${u.email}`" masquer-label :options="profils" @change="enregistrer(u)" /></td>
            <td data-label="Compte">
              <label class="case"><input v-model="u.actif" type="checkbox" role="switch" @change="enregistrer(u)"><span>{{ u.actif ? 'Actif' : 'Inactif' }}<span class="sr-only"> : {{ u.email }}</span></span></label>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
