<script setup lang="ts">
defineProps<{
  label: string
  modelValue: number
  min?: number
  max?: number
  step?: number
  suffix?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <div class="slider-field">
    <div class="slider-field__row">
      <span class="slider-field__label">{{ label }}</span>
      <span class="slider-field__value">
        {{ modelValue }}{{ suffix ?? '' }}
      </span>
    </div>
    <input
      type="range"
      class="slider-field__input"
      :min="min ?? 0"
      :max="max ?? 100"
      :step="step ?? 1"
      :value="modelValue"
      @input="
        emit('update:modelValue', Number(($event.target as HTMLInputElement).value))
      "
    />
  </div>
</template>
