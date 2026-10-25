<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import type { FeatureItem } from '../../types/feature'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import EffectsAssetsPanel from '../video-effects/EffectsAssetsPanel.vue'
import EffectsPreviewCenter from '../video-effects/EffectsPreviewCenter.vue'
import EffectsFeatureRail from '../video-effects/EffectsFeatureRail.vue'
import EffectsFooterBar from '../video-effects/EffectsFooterBar.vue'
import EffectsSplitBar from '../video-effects/EffectsSplitBar.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'
import { useFeatureStateStore } from '../../stores/featureState'
import { useMaterialStore } from '../../stores/material'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const fx = useFeatureStateStore()
const material = useMaterialStore()
const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

const footerRef = ref<{ refreshLicense?: () => void } | null>(null)
const fileStatus = reactive<Record<string, 'idle' | 'done' | 'processing'>>({})
const stats = reactive({ done: 0, fail: 0 })
onMounted(() => {
  if (fx.fxWorkflowPreset !== 'qianchuan') {
    fx.applyQianchuanFissionPreset()
  }
})

watch(
  () => material.looseVideos.map((v) => v.id).join(','),
  () => {
    for (const v of material.looseVideos) {
      if (!fileStatus[v.id]) fileStatus[v.id] = 'idle'
    }
  },
  { immediate: true },
)

async function onRun() {
  stats.done = 0
  stats.fail = 0
  for (const v of material.looseVideos) fileStatus[v.id] = 'processing'

  const res = await runJob()

  for (const v of material.looseVideos) {
    fileStatus[v.id] = res.ok ? 'done' : 'idle'
  }
  if (res.ok) stats.done = material.looseVideos.length
  else stats.fail = material.looseVideos.length

  footerRef.value?.refreshLicense?.()
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="fx-workspace fx-theme">
      <div class="fx-workspace__body">
        <EffectsAssetsPanel :file-status="fileStatus" />
        <EffectsPreviewCenter />
        <EffectsFeatureRail />
      </div>
      <EffectsSplitBar v-if="fx.fxWorkflowPreset !== 'qianchuan'" />
      <EffectsFooterBar
        ref="footerRef"
        :running="running"
        :progress="progress"
        :message="message"
        :done-count="stats.done"
        :fail-count="stats.fail"
        @run="onRun"
      />
    </div>
  </WorkspaceShell>
</template>

<style src="../video-effects/fx-workspace.css"></style>
