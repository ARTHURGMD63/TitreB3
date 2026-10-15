<script setup>
// Champ de formulaire avec label toujours lié (RGAA 11.1) ; les attributs (type, min, maxlength...) passent à l'input.
// multiligne : affiche un <textarea>. invalide : signale l'erreur avec aria-invalid.
import { useId } from 'vue';

defineOptions({ inheritAttrs: false });
defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, required: true },
  requis: Boolean,
  multiligne: Boolean,
  invalide: Boolean,
  masquerLabel: Boolean,
  aide: String
});
defineEmits(['update:modelValue']);
const id = useId();
</script>

<template>
  <div class="champ">
    <label :for="id" :class="{ 'sr-only': masquerLabel }">{{ label }}<span v-if="requis" aria-hidden="true"> *</span></label>
    <component :is="multiligne ? 'textarea' : 'input'" :id="id" v-bind="$attrs" :value="modelValue" :required="requis"
      :aria-invalid="invalide ? 'true' : undefined" :aria-describedby="aide ? `${id}-aide` : undefined"
      @input="$emit('update:modelValue', $event.target.value)" />
    <small v-if="aide" :id="`${id}-aide`">{{ aide }}</small>
  </div>
</template>
