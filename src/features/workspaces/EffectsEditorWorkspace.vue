<script setup lang="ts">
import type { FeatureItem } from '../../types/feature'
import VideoListPanel from '../../components/workspace/VideoListPanel.vue'
import PreviewPanel from '../../components/workspace/PreviewPanel.vue'
import EffectsSettings from '../../components/settings/EffectsSettings.vue'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'
import { useFeatureStateStore } from '../../stores/featureState'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

useFeatureStateStore().settingsTab = 'effect'
const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

async function onRun() {
  const res = await runJob()
  if (res.ok && res.outputs?.length) {
    window.alert(`处理完成，共 ${res.outputs.length} 个输出文件`)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <VideoListPanel import-label="导入视频" />
      <div class="workspace__center">
        <PreviewPanel mode="video" overlay="效果预览 · 水印 / 分割 / 裂变" />
      </div>
      <EffectsSettings @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
