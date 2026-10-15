<script setup>
// Message de confirmation ou d'erreur (région annoncée par les lecteurs d'écran).
// La première phrase est mise en gras : « Réservation confirmée. » puis le détail.
import { computed } from 'vue';
import { message } from '../store.js';

const parties = computed(() => {
  const m = message.texte.match(/^(.+?[.!?])\s+(.+)$/s);
  return m ? { titre: m[1], suite: m[2] } : { titre: '', suite: message.texte };
});
</script>

<template>
  <p v-if="message.visible" :class="['message', `message-${message.type === 'erreur' ? 'erreur' : 'ok'}`]" :role="message.type === 'erreur' ? 'alert' : 'status'">
    <span><strong v-if="parties.titre">{{ parties.titre }}</strong> {{ parties.suite }}</span>
  </p>
</template>
