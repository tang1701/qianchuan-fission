<script setup lang="ts">
import type { FeatureItem } from '../../types/feature'
import FolderPanel from '../../components/workspace/FolderPanel.vue'
import PreviewPanel from '../../components/workspace/PreviewPanel.vue'
import ScriptPanel from '../../components/workspace/ScriptPanel.vue'
import MixSettings from '../../components/settings/MixSettings.vue'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

async function onRun() {
  const res = await runJob()
  if (res.ok && res.outputs?.length) {
    window.alert(`分类混剪完成，共 ${res.outputs.length} 条成片`)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <FolderPanel reorder import-label="导入分类文件夹" />
      <div class="workspace__center">
        <PreviewPanel overlay="按文件夹顺序结构化混剪" />
        <ScriptPanel placeholder="输入统一口播文案，各分类文件夹按顺序或随机供片…" />
      </div>
      <MixSettings :action-label="feature.primaryAction" show-category-rules @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
