<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../../api.js';
import BoiteDialogue from '../../components/BoiteDialogue.vue';
import ChampSelect from '../../components/ChampSelect.vue';
import ChampTexte from '../../components/ChampTexte.vue';
import Icone from '../../components/Icone.vue';
import { annoncer, signalerErreur } from '../../store.js';

const ressources = ref([]);
const responsables = ref([]);
const edition = ref(null); // ressource en cours d'édition ({} = création)
const aDesactiver = ref(null);
const motif = ref('');
const nomVide = ref(false);
const form = reactive({});
const TYPES = [{ valeur: 'salle', libelle: 'Salle' }, { valeur: 'materiel', libelle: 'Matériel' }];

async function recharger() { ressources.value = await api.get('/api/ressources'); }
onMounted(async () => {
  await recharger();
  responsables.value = [{ valeur: '', libelle: '— aucun —' }, ...(await api.get('/api/admin/responsables')).map((x) => ({ valeur: x.id, libelle: `${x.prenom} ${x.nom}` }))];
});

function ouvrir(r) {
  nomVide.value = false;
  Object.assign(form, {
    nom: r?.nom ?? '', type: r?.type ?? 'salle', capacite: r?.capacite ?? 1, localisation: r?.localisation ?? '',
    equipements: (r?.equipements ?? []).join(', '), photo: r?.photo_url ?? '', ouv: r?.heure_ouverture ?? '08:00', fer: r?.heure_fermeture ?? '19:00',
    validation: r?.validation_requise ?? false, resp: r?.responsable_id ?? ''
  });
  edition.value = r || {};
}

async function enregistrer() {
  if (!form.nom.trim()) { nomVide.value = true; throw new Error('Le nom de la ressource est obligatoire.'); }
  const donnees = {
    nom: form.nom, type: form.type, capacite: Number(form.capacite), localisation: form.localisation,
    equipements: form.equipements.split(',').map((x) => x.trim()).filter(Boolean), photo_url: form.photo || null,
    heure_ouverture: form.ouv, heure_fermeture: form.fer, validation_requise: form.validation,
    responsable_id: form.resp ? Number(form.resp) : null
  };
  if (edition.value.id) await api.put(`/api/ressources/${edition.value.id}`, donnees);
  else await api.post('/api/ressources', donnees);
  annoncer('Ressource enregistrée. Le catalogue est à jour.', 'ok');
  await recharger();
}

function basculer(r) {
  if (r.active) { motif.value = ''; aDesactiver.value = r; return; }
  api.patch(`/api/ressources/${r.id}/activation`, { active: true }).then(recharger).catch(signalerErreur);
}
async function desactiver() {
  await api.patch(`/api/ressources/${aDesactiver.value.id}/activation`, { active: false, motif: motif.value });
  annoncer('Ressource désactivée. Elle n\'est plus réservable.', 'ok');
  await recharger();
}
</script>

<template>
  <section class="carte" aria-labelledby="t-ress">
    <div class="ligne entre">
      <h2 id="t-ress">Ressources <span class="mono doux">{{ ressources.length }}</span></h2>
      <button type="button" @click="ouvrir(null)"><Icone nom="plus" />Ajouter une ressource</button>
    </div>
    <div class="defilement">
      <table class="empile">
        <thead><tr><th scope="col">Nom</th><th scope="col">Type</th><th scope="col">Capacité</th><th scope="col">Lieu</th><th scope="col">Validation</th><th scope="col">Responsable</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>
          <tr v-for="r in ressources" :key="r.id">
            <td data-label="Nom"><span><b>{{ r.nom }}</b><small v-if="!r.active">Désactivée{{ r.motif_indisponibilite ? ` : ${r.motif_indisponibilite}` : '' }}</small></span></td>
            <td data-label="Type">{{ r.type === 'salle' ? 'Salle' : 'Matériel' }}</td>
            <td data-label="Capacité" class="mono">{{ r.capacite }}</td>
            <td data-label="Lieu">{{ r.localisation || '—' }}</td>
            <td data-label="Validation"><span v-if="r.validation_requise" class="badge badge-validation">Requise</span><span v-else class="doux">Non</span></td>
            <td data-label="Responsable">{{ r.responsable_nom || '—' }}</td>
            <td data-label="">
              <div class="actions">
                <button type="button" class="discret petit icone-seule" :aria-label="`Modifier ${r.nom}`" title="Modifier" @click="ouvrir(r)"><Icone nom="crayon" /></button>
                <button type="button" class="secondaire petit" @click="basculer(r)">{{ r.active ? 'Désactiver' : 'Réactiver' }}<span class="sr-only"> {{ r.nom }}</span></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <BoiteDialogue v-if="edition" :titre="edition.id ? `Modifier ${edition.nom}` : 'Nouvelle ressource'" libelle-valider="Enregistrer" :valider="enregistrer" @fermer="edition = null">
    <ChampTexte v-model="form.nom" label="Nom" requis maxlength="120" :invalide="nomVide" />
    <div class="ligne">
      <ChampSelect v-model="form.type" label="Type" :options="TYPES" />
      <ChampTexte v-model="form.capacite" label="Capacité" type="number" min="1" requis />
    </div>
    <ChampTexte v-model="form.localisation" label="Lieu" maxlength="160" />
    <ChampTexte v-model="form.equipements" label="Équipements" aide="Séparés par des virgules." />
    <ChampTexte v-model="form.photo" label="Photo (URL https)" type="url" />
    <div class="ligne">
      <ChampTexte v-model="form.ouv" label="Ouverture" type="time" requis />
      <ChampTexte v-model="form.fer" label="Fermeture" type="time" requis />
    </div>
    <ChampSelect v-model="form.resp" label="Responsable" :options="responsables" />
    <label class="case"><input v-model="form.validation" type="checkbox"><span>Les réservations doivent être validées par le responsable</span></label>
  </BoiteDialogue>

  <BoiteDialogue v-if="aDesactiver" titre="Désactiver la ressource ?" libelle-valider="Désactiver" danger :valider="desactiver" @fermer="aDesactiver = null">
    <p><b>{{ aDesactiver.nom }}</b> ne sera plus réservable (maintenance). Les réservations existantes sont conservées.</p>
    <ChampTexte v-model="motif" label="Motif de l'indisponibilité" maxlength="200" />
  </BoiteDialogue>
</template>
