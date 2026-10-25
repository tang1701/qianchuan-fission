<script setup lang="ts">
import type { FeatureItem } from '../../types/feature'
import VideoListPanel from '../../components/workspace/VideoListPanel.vue'
import PreviewPanel from '../../components/workspace/PreviewPanel.vue'
import SlicePanel from '../../components/workspace/SlicePanel.vue'
import ExtractSettings from '../../components/settings/ExtractSettings.vue'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'
import { useFeatureStateStore } from '../../stores/featureState'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const featureState = useFeatureStateStore()
const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

async function onRun() {
  featureState.resetSlices()
  const res = await runJob()
  if (res.ok && res.outputs?.length) {
    res.outputs.forEach((out, i) => {
      const name = out.split(/[/\\]/).pop() ?? `片段 ${i + 1}`
      featureState.slices.push({
        id: crypto.randomUUID(),
        title: name,
        start: '—',
        end: '—',
      })
    })
    window.alert(`切片完成，共 ${res.outputs.length} 个文件`)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <VideoListPanel import-label="导入视频 / 直播回放" />
      <div class="workspace__center">
        <PreviewPanel mode="video" overlay="切片预览" />
        <SlicePanel />
      </div>
      <ExtractSettings @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
