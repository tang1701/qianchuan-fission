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
const isVideoMix = props.feature.id === 'video-mix'

async function onRun() {
  const res = await runJob()
  if (res.ok && res.outputs?.length) {
    window.alert(`已导出 ${res.outputs.length} 个文件到导出目录`)
  }
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="workspace__layout">
      <FolderPanel />
      <div class="workspace__center">
        <PreviewPanel />
        <ScriptPanel
          :placeholder="
            isVideoMix
              ? '输入口播文案，系统将随机抽取文件夹片段并匹配配音…'
              : '输入文案或粘贴脚本，AI 将理解语义并从素材库匹配画面…'
          "
        />
      </div>
      <MixSettings
        :action-label="feature.primaryAction"
        :show-mix-rules="isVideoMix"
        @run="onRun"
      />
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
