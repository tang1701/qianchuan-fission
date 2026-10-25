<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getFeatureById } from '../data/features'
import { workspaceByLayout } from '../features/registry'
import { workspaceByFeatureId } from '../features/workspaceByFeatureId'

const props = defineProps<{
  featureId: string
}>()

const router = useRouter()
const feature = computed(() => getFeatureById(props.featureId))
const workspaceComponent = computed(() => {
  if (!feature.value) return null
  return (
    workspaceByFeatureId[feature.value.id] ?? workspaceByLayout[feature.value.layout]
  )
})

function goHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div v-if="feature && !feature.available" class="workspace workspace--missing">
    <p>「{{ feature.title }}」功能开发中，敬请期待。</p>
    <button type="button" class="btn btn--primary" @click="goHome">返回首页</button>
  </div>
  <component
    :is="workspaceComponent"
    v-else-if="feature && workspaceComponent"
    :feature="feature"
    @home="goHome"
  />
  <div v-else class="workspace workspace--missing">
    <p>未找到该功能</p>
    <button type="button" class="btn btn--primary" @click="goHome">返回首页</button>
  </div>
</template>
