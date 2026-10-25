<script setup lang="ts">
import type { FeatureItem } from '../../types/feature'
import FolderPanel from '../../components/workspace/FolderPanel.vue'
import PreviewPanel from '../../components/workspace/PreviewPanel.vue'
import ScriptPanel from '../../components/workspace/ScriptPanel.vue'
import VideoMixSettings from '../../components/settings/VideoMixSettings.vue'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

useFeatureStateStore().settingsTab = 'basic'
const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

async function onRun() {
  const res = await runJob()
  if (!res.ok) return
  const n = res.outputs?.length ?? 0
  if (n === 0) return
  const open = confirm(`混剪完成，共 ${n} 个成片。是否打开导出目录？`)
  if (open) {
    const dir = useFeatureStateStore().exportPath
    if (dir) await getDesktopApi()?.openPath(dir)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <FolderPanel import-label="导入素材文件夹" />
      <div class="workspace__center">
        <PreviewPanel overlay="视频混剪 · 随机重组或文案+TTS · 可导入整段配音" />
        <ScriptPanel
          placeholder="可选：输入口播文案并开启 TTS，将按句随机/文件名匹配素材并烧录字幕；留空则纯随机抽段混剪。也可仅导入配音音频。"
        />
      </div>
      <VideoMixSettings @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
