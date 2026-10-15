<script setup>
// Icône du sprite (décorative : le texte ou l'aria-label du parent porte le sens).
defineProps({ nom: { type: String, required: true } });
</script>

<template>
  <svg class="icone" aria-hidden="true" focusable="false"><use :href="`#i-${nom}`" /></svg>
</template>
