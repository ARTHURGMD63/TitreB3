<script setup>
// Fiche résumée d'une ressource : toute la carte est cliquable grâce au lien du titre.
import { RouterLink } from 'vue-router';
import Icone from './Icone.vue';

defineProps({ ressource: { type: Object, required: true } });
</script>

<template>
  <article class="carte">
    <header>
      <span class="surtitre">{{ ressource.type === 'salle' ? 'Salle' : 'Matériel' }}</span>
      <span class="ligne">
        <span v-if="!ressource.active" class="badge badge-annulee">Indisponible</span>
        <span v-else-if="ressource.disponible_ce_jour" class="badge badge-dispo">Créneaux disponibles</span>
        <span v-else class="badge badge-complet">Complet ce jour</span>
        <span v-if="ressource.validation_requise" class="badge badge-validation">Validation requise</span>
      </span>
    </header>
    <h3><RouterLink :to="`/ressource/${ressource.id}`">{{ ressource.nom }}</RouterLink></h3>
    <ul class="meta">
      <li><Icone nom="personnes" />{{ ressource.capacite }} {{ ressource.capacite > 1 ? 'places' : 'place' }}</li>
      <li><Icone nom="lieu" />{{ ressource.localisation || 'Lieu non précisé' }}</li>
      <li><Icone nom="horloge" /><span class="mono">{{ ressource.heure_ouverture }}–{{ ressource.heure_fermeture }}</span></li>
    </ul>
    <ul v-if="ressource.equipements.length" class="etiquettes" aria-label="Équipements">
      <li v-for="e in ressource.equipements" :key="e">{{ e }}</li>
    </ul>
    <p v-if="!ressource.active && ressource.motif_indisponibilite" class="doux">{{ ressource.motif_indisponibilite }}</p>
  </article>
</template>
