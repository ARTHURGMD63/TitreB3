<script setup>
// Étiquette de statut : toujours du texte, jamais la couleur seule.
import { STATUTS } from '../temps.js';

defineProps({ statut: { type: String, required: true } });
</script>

<template>
  <span :class="`badge badge-${statut}`">{{ STATUTS[statut] }}</span>
</template>
