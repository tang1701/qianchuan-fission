<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'

const { exportPath } = storeToRefs(useFeatureStateStore())

async function browse() {
  const api = getDesktopApi()
  if (api) {
    const dir = await api.pickExportDir()
    if (dir) exportPath.value = dir
  } else {
    window.alert('浏览器预览模式下请手动输入路径；桌面版可点击浏览选择文件夹。')
  }
}
</script>

<template>
  <label class="field-label">
    导出目录
    <div class="export-path-row">
      <input v-model="exportPath" class="text-input" placeholder="选择或输入导出路径…" />
      <button type="button" class="btn btn--ghost btn--sm" @click="browse">浏览</button>
    </div>
  </label>
</template>
