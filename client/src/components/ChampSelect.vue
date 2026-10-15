<script setup>
// Liste déroulante étiquetée. options : [{ valeur, libelle }]
import { useId } from 'vue';

defineOptions({ inheritAttrs: false });
defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, required: true },
  options: { type: Array, required: true },
  masquerLabel: Boolean
});
defineEmits(['update:modelValue']);
const id = useId();
</script>

<template>
  <div class="champ">
    <label :for="id" :class="{ 'sr-only': masquerLabel }">{{ label }}</label>
    <select :id="id" v-bind="$attrs" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option v-for="o in options" :key="o.valeur" :value="o.valeur">{{ o.libelle }}</option>
    </select>
  </div>
</template>
