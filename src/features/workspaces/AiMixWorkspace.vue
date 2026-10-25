<script setup lang="ts">
import type { FeatureItem } from '../../types/feature'
import FolderPanel from '../../components/workspace/FolderPanel.vue'
import PreviewPanel from '../../components/workspace/PreviewPanel.vue'
import ScriptPanel from '../../components/workspace/ScriptPanel.vue'
import AiMixSettings from '../../components/settings/AiMixSettings.vue'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'

defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const { running, progress, message, run: runJob } = useFeatureJob('ai-mix')

async function onRun() {
  const res = await runJob()
  if (res.ok && res.outputs?.length) {
    window.alert(`AI 智能混剪完成，共 ${res.outputs.length} 个成片`)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <FolderPanel import-label="导入文件夹" />
      <div class="workspace__center">
        <PreviewPanel />
        <ScriptPanel
          placeholder="添加文案或音频：AI 将理解语义、按句匹配镜头，合成配音并批量成片…"
        />
      </div>
      <AiMixSettings @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
