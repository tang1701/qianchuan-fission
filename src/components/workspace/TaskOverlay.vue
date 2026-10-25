<script setup lang="ts">
defineProps<{
  visible: boolean
  progress: number
  message: string
}>()
</script>

<template>
  <div v-if="visible" class="task-overlay" role="status" aria-live="polite">
    <div class="task-overlay__card">
      <p class="task-overlay__msg">{{ message }}</p>
      <div class="task-overlay__bar">
        <div class="task-overlay__fill" :style="{ width: `${progress}%` }" />
      </div>
      <span class="task-overlay__pct">{{ progress }}%</span>
    </div>
  </div>
</template>
