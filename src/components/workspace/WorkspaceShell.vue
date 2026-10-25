<script setup lang="ts">
defineProps<{
  title: string
  featureId?: string
}>()

const emit = defineEmits<{
  home: []
}>()
</script>

<template>
  <div class="workspace workspace--fx">
    <header class="workspace__topbar workspace__topbar--fx">
      <button type="button" class="btn btn--ghost" @click="emit('home')">← 返回首页</button>
      <h1 class="workspace__title">{{ title }}</h1>
      <div class="workspace__topbar-spacer" />
    </header>
    <slot />
  </div>
</template>
