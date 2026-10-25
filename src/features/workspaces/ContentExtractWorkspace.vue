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
import { getDesktopApi } from '../../services/desktop'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const featureState = useFeatureStateStore()
const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

async function onRun() {
  featureState.resetSlices()
  const res = await runJob()
  if (!res.ok) return
  res.outputs?.forEach((out, i) => {
    const name = out.split(/[/\\]/).pop() ?? `片段 ${i + 1}`
    featureState.slices.push({
      id: crypto.randomUUID(),
      title: name,
      start: '—',
      end: '—',
    })
  })
  const n = res.outputs?.length ?? 0
  if (n === 0) return
  const open = confirm(`提炼完成，共 ${n} 个切片。打开导出目录？`)
  if (open && featureState.exportPath) await getDesktopApi()?.openPath(featureState.exportPath)
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <VideoListPanel import-label="导入视频 / 直播回放" />
      <div class="workspace__center">
        <PreviewPanel mode="video" overlay="AI 模式：场景切点 · 手动模式：随机区间切片" />
        <SlicePanel />
      </div>
      <ExtractSettings @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
