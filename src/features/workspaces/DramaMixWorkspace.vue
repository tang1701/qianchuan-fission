<script setup lang="ts">
import type { FeatureItem } from '../../types/feature'
import FolderPanel from '../../components/workspace/FolderPanel.vue'
import PreviewPanel from '../../components/workspace/PreviewPanel.vue'
import ScriptPanel from '../../components/workspace/ScriptPanel.vue'
import DramaSettings from '../../components/settings/DramaSettings.vue'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

async function onRun() {
  const res = await runJob()
  if (!res.ok) return
  const n = res.outputs?.length ?? 0
  if (n === 0) return
  const open = confirm(`短剧混剪完成，共 ${n} 条剧情线。打开导出目录？`)
  if (open) {
    const dir = useFeatureStateStore().exportPath
    if (dir) await getDesktopApi()?.openPath(dir)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <FolderPanel import-label="导入短剧全集文件夹" />
      <div class="workspace__center">
        <PreviewPanel overlay="按集数顺序或随机 · 高光/剧情精剪 · 多剧情线批量" />
        <ScriptPanel
          title="解说文案（可选）"
          placeholder="填写解说将按镜头分段 TTS；留空则仅重组画面…"
        />
      </div>
      <DramaSettings @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
