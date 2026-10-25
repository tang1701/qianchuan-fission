<script setup lang="ts">
import { computed } from 'vue'
import { featureParity } from '../../data/featureParity'

const props = defineProps<{ featureId: string }>()

const info = computed(() => featureParity[props.featureId])
</script>

<template>
  <div v-if="info" class="parity-bar">
    <span class="parity-bar__label">模块进度（逐模块对齐正版）</span>
    <ul class="parity-bar__list">
      <li v-for="(n, i) in info.notes" :key="i">{{ n }}</li>
    </ul>
  </div>
</template>
