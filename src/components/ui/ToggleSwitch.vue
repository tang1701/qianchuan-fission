<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <label class="toggle">
    <span v-if="label" class="toggle__label">{{ label }}</span>
    <button
      type="button"
      class="toggle__track"
      :class="{ 'toggle__track--on': modelValue }"
      role="switch"
      :aria-checked="modelValue"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span class="toggle__thumb" />
    </button>
  </label>
</template>
