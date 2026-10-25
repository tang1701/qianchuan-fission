<script setup lang="ts">
import type { FeatureItem } from '../../types/feature'
import FolderPanel from '../../components/workspace/FolderPanel.vue'
import PreviewPanel from '../../components/workspace/PreviewPanel.vue'
import ScriptPanel from '../../components/workspace/ScriptPanel.vue'
import DramaSettings from '../../components/settings/DramaSettings.vue'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

async function onRun() {
  const res = await runJob()
  if (res.ok && res.outputs?.length) {
    window.alert(`短剧混剪完成，共 ${res.outputs.length} 条视频`)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <FolderPanel :show-match-mode="true" import-label="导入短剧全集文件夹" />
      <div class="workspace__center">
        <PreviewPanel overlay="剧情线 / 高光预览" />
        <ScriptPanel
          title="解说文案（可选）"
          placeholder="可添加统一解说文案；留空则仅按剧情/高光重组画面…"
        />
      </div>
      <DramaSettings @run="onRun" />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
