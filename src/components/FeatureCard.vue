<script setup lang="ts">
import type { FeatureItem } from '../types/feature'

defineProps<{
  feature: FeatureItem
}>()

const emit = defineEmits<{
  open: [id: string]
}>()
</script>

<template>
  <article
    class="feature-card"
    :class="{ 'feature-card--disabled': !feature.available }"
    role="button"
    tabindex="0"
    @click="feature.available && emit('open', feature.id)"
    @keydown.enter="feature.available && emit('open', feature.id)"
  >
    <header class="feature-card__head">
      <h2 class="feature-card__title">{{ feature.title }}</h2>
      <span v-if="feature.available" class="badge badge--ok">功能可用</span>
      <span v-else class="badge badge--soon">功能开发中</span>
    </header>
    <ul class="feature-card__tags">
      <li v-for="tag in feature.tags" :key="tag">{{ tag }}</li>
    </ul>
    <p class="feature-card__desc">{{ feature.description }}</p>
  </article>
</template>
