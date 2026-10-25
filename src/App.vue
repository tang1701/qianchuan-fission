<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAppSettingsStore } from './stores/appSettings'
import { useFeatureStateStore } from './stores/featureState'
onMounted(async () => {
  const appSettings = useAppSettingsStore()
  await appSettings.load()
  if (appSettings.lastExportDir && !useFeatureStateStore().exportPath) {
    useFeatureStateStore().exportPath = appSettings.lastExportDir
  }
})
</script>

<template>
  <RouterView />
</template>
