<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ExportPathField from '../../components/workspace/ExportPathField.vue'
import FxLicenseStrip from './FxLicenseStrip.vue'
import { useMaterialStore } from '../../stores/material'
import { useFeatureStateStore } from '../../stores/featureState'

const emit = defineEmits<{ run: [] }>()

defineProps<{
  running: boolean
  progress: number
  message: string
  doneCount: number
  failCount: number
}>()

const { looseVideos } = storeToRefs(useMaterialStore())
const store = useFeatureStateStore()
const {
  fxOutResolution,
  fxOutFps,
  fxOutFormat,
  fxWorkerThreads,
  fxCrf,
  fissionCount,
  fxNamingMode,
  fxExportByFolder,
  fxModuleEnabled,
  fxKeepOriginalFile,
  fxWorkflowPreset,
} = storeToRefs(store)

const total = computed(() => looseVideos.value.length)
const isQianchuan = computed(() => fxWorkflowPreset.value === 'qianchuan')

const resOptions = [
  { v: 'original', l: '原分辨率' },
  { v: '1080x1920', l: '1080×1920（9:16）' },
  { v: '720x1280', l: '720×1280（9:16）' },
  { v: '1080P', l: '1920×1080（16:9）' },
  { v: '720P', l: '1280×720' },
  { v: '2K', l: '2560×1440' },
]
const fpsOptions = [
  { v: 'original', l: '原帧率' },
  { v: '24', l: '24' },
  { v: '25', l: '25' },
  { v: '30', l: '30' },
  { v: '60', l: '60' },
]

function onFissionChange(n: number) {
  fissionCount.value = n
  if (n > 1) {
    fxModuleEnabled.value = { ...fxModuleEnabled.value, fission: true }
    if (fxNamingMode.value === 'effect_suffix') fxNamingMode.value = 'fission_idx'
  }
}

watch(fxNamingMode, (m) => {
  fxExportByFolder.value = m !== 'effect_suffix' && m !== 'timestamp'
})

const licenseRef = ref<InstanceType<typeof FxLicenseStrip> | null>(null)

defineExpose({
  refreshLicense: () => licenseRef.value?.refresh?.(),
})
</script>

<template>
  <footer class="fx-footer">
    <div class="fx-footer__grid">
      <section class="fx-footer__panel">
        <h3 class="fx-footer__heading">输出设置</h3>
        <div class="fx-footer__fields">
          <label class="fx-footer__field">
            裂变数量
            <input
              :value="fissionCount"
              type="number"
              min="1"
              max="50"
              class="fx-footer__num"
              @input="onFissionChange(Number(($event.target as HTMLInputElement).value) || 1)"
            />
          </label>
          <label v-if="!isQianchuan" class="fx-footer__field">
            分辨率
            <select v-model="fxOutResolution" class="fx-footer__select">
              <option v-for="r in resOptions" :key="r.v" :value="r.v">{{ r.l }}</option>
            </select>
          </label>
          <label v-if="!isQianchuan" class="fx-footer__field">
            帧率
            <select v-model="fxOutFps" class="fx-footer__select">
              <option v-for="f in fpsOptions" :key="f.v" :value="f.v">{{ f.l }}</option>
            </select>
          </label>
          <label v-if="!isQianchuan" class="fx-footer__field">
            格式
            <select v-model="fxOutFormat" class="fx-footer__select">
              <option value="mp4">MP4</option>
            </select>
          </label>
          <label class="fx-footer__field">
            画质 CRF
            <input
              v-model.number="fxCrf"
              type="number"
              min="15"
              max="28"
              class="fx-footer__num"
              title="越小越清晰，千川建议 15～17"
            />
          </label>
          <label v-if="!isQianchuan" class="fx-footer__field">
            命名
            <select v-model="fxNamingMode" class="fx-footer__select">
              <option value="effect_suffix">原名_effect</option>
              <option value="fission_idx">裂变编号</option>
              <option value="prefix_idx">前缀序号</option>
              <option value="timestamp">时间戳</option>
            </select>
          </label>
          <label v-if="!isQianchuan" class="fx-footer__field">
            原文件
            <select v-model="fxKeepOriginalFile" class="fx-footer__select">
              <option :value="true">保留</option>
              <option :value="false">仅输出成片</option>
            </select>
          </label>
          <label class="fx-footer__field">
            线程
            <select v-model="fxWorkerThreads" class="fx-footer__select">
              <option v-for="n in [1, 2, 3, 4]" :key="n" :value="n">{{ n }}</option>
            </select>
          </label>
        </div>
      </section>

      <section class="fx-footer__panel fx-footer__panel--action">
        <h3 class="fx-footer__heading">导出</h3>
        <ExportPathField />
        <button
          type="button"
          class="btn btn--primary fx-footer__start"
          :disabled="!total || running"
          @click="emit('run')"
        >
          开始处理
        </button>
      </section>
    </div>

    <FxLicenseStrip ref="licenseRef" />

    <div class="fx-footer__progress">
      <div class="fx-footer__progress-meta">
        <span>总视频 {{ total }} · 完成 {{ doneCount }} · 失败 {{ failCount }}</span>
        <span>{{ message || (running ? '处理中…' : '就绪') }}</span>
        <span>{{ progress.toFixed(1) }}%</span>
      </div>
      <div class="fx-footer__track">
        <div class="fx-footer__fill" :style="{ width: `${Math.min(100, progress)}%` }" />
      </div>
    </div>
  </footer>
</template>
