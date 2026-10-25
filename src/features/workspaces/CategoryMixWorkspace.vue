<script setup lang="ts">
import type { FeatureItem } from '../../types/feature'
import FolderPanel from '../../components/workspace/FolderPanel.vue'
import PreviewPanel from '../../components/workspace/PreviewPanel.vue'
import ScriptPanel from '../../components/workspace/ScriptPanel.vue'
import CategoryMixSettings from '../../components/settings/CategoryMixSettings.vue'
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
  const open = confirm(`分类混剪完成，共 ${n} 条成片。打开导出目录？`)
  if (open) {
    const dir = useFeatureStateStore().exportPath
    if (dir) await getDesktopApi()?.openPath(dir)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <FolderPanel reorder draggable import-label="导入分类文件夹" />
      <div class="workspace__center">
        <PreviewPanel overlay="左侧顺序即混剪结构 · 拖拽文件夹调整分类顺序" />
        <ScriptPanel placeholder="统一口播文案：按句对应各分类镜头（句数少于分类数时循环使用）…" />
      </div>
      <CategoryMixSettings @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
