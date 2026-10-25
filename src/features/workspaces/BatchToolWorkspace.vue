<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { FeatureItem } from '../../types/feature'
import VideoListPanel from '../../components/workspace/VideoListPanel.vue'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import ExportPathField from '../../components/workspace/ExportPathField.vue'
import SliderField from '../../components/ui/SliderField.vue'
import ToggleSwitch from '../../components/ui/ToggleSwitch.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'
import { useMaterialStore } from '../../stores/material'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const material = useMaterialStore()
const state = useFeatureStateStore()
const { looseVideos } = storeToRefs(material)
const {
  batchCount,
  cropRatio,
  cropWidth,
  cropHeight,
  audioFormat,
  audioBitrate,
  eraseTop,
  eraseHeight,
  eraseBlur,
  eraseRemoveMode,
  md5Mirror,
  md5DropFrame,
  md5Brightness,
} = storeToRefs(state)

const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)
const ratioPresets = ['9:16', '16:9', '1:1', '4:3']

const summary = computed(() => {
  switch (props.feature.id) {
    case 'batch-crop':
      return `将 ${looseVideos.value.length} 个视频裁剪为 ${cropRatio.value}（${cropWidth.value}×${cropHeight.value}）`
    case 'audio-extract':
      return `从 ${looseVideos.value.length} 个视频提取 ${audioFormat.value.toUpperCase()}，${audioBitrate.value}kbps`
    case 'subtitle-erase':
      return `擦除区域：距顶 ${eraseTop.value}%，高度 ${eraseHeight.value}%`
    case 'md5-diff':
      return `镜像 ${md5Mirror.value ? '开' : '关'} · 抽帧 ${md5DropFrame.value ? '开' : '关'} · 亮度 ${md5Brightness.value}%`
    default:
      return ''
  }
})

function applyRatio(r: string) {
  cropRatio.value = r
  if (r === '9:16') {
    cropWidth.value = 1080
    cropHeight.value = 1920
  } else if (r === '16:9') {
    cropWidth.value = 1920
    cropHeight.value = 1080
  } else if (r === '1:1') {
    cropWidth.value = 1080
    cropHeight.value = 1080
  }
}

async function onRun() {
  const res = await runJob()
  if (!res.ok) return
  const n = res.outputs?.length ?? 0
  if (n === 0) return
  const open = confirm(`完成，共 ${n} 个文件。打开导出目录？`)
  if (open && state.exportPath) await getDesktopApi()?.openPath(state.exportPath)
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="batch-tool-layout">
      <VideoListPanel />
      <section class="panel batch-tool-main">
        <h3>{{ feature.title }}</h3>
        <p class="settings-block__muted">{{ feature.description }}</p>
        <p v-if="looseVideos.length" class="batch-tool-summary">{{ summary }}</p>

        <div v-if="feature.id === 'batch-crop'" class="settings-block">
          <p class="settings-block__title">裁剪比例</p>
          <div class="tag-row">
            <button
              v-for="r in ratioPresets"
              :key="r"
              type="button"
              class="tag-btn"
              :class="{ 'tag-btn--active': cropRatio === r }"
              @click="applyRatio(r)"
            >
              {{ r }}
            </button>
          </div>
          <SliderField v-model="cropWidth" label="宽度" :min="480" :max="3840" />
          <SliderField v-model="cropHeight" label="高度" :min="480" :max="3840" />
        </div>

        <div v-else-if="feature.id === 'audio-extract'" class="settings-block">
          <label class="field-label">
            音频格式
            <select v-model="audioFormat" class="select select--block">
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="aac">AAC</option>
            </select>
          </label>
          <SliderField v-model="audioBitrate" label="码率" :min="128" :max="320" suffix=" kbps" />
        </div>

        <div v-else-if="feature.id === 'subtitle-erase'" class="settings-block">
          <div class="segmented segmented--block">
            <button
              type="button"
              class="segmented__btn"
              :class="{ 'segmented__btn--active': eraseRemoveMode === 'delogo' }"
              @click="eraseRemoveMode = 'delogo'"
            >
              delogo
            </button>
            <button
              type="button"
              class="segmented__btn"
              :class="{ 'segmented__btn--active': eraseRemoveMode === 'inpaint' }"
              @click="eraseRemoveMode = 'inpaint'"
            >
              智能模糊修复
            </button>
          </div>
          <SliderField v-model="eraseTop" label="擦除区域距顶部" :min="0" :max="100" suffix="%" />
          <SliderField v-model="eraseHeight" label="擦除高度" :min="5" :max="40" suffix="%" />
          <SliderField v-model="eraseBlur" label="边缘模糊" :min="0" :max="20" />
          <div class="erase-preview">
            <div
              class="erase-preview__bar"
              :style="{ top: `${eraseTop}%`, height: `${eraseHeight}%` }"
            />
          </div>
        </div>

        <div v-else-if="feature.id === 'md5-diff'" class="settings-block">
          <ToggleSwitch v-model="md5Mirror" label="随机水平镜像" />
          <ToggleSwitch v-model="md5DropFrame" label="随机抽帧" />
          <SliderField v-model="md5Brightness" label="亮度微调" :min="95" :max="110" suffix="%" />
          <SliderField v-model="batchCount" label="每条生成版本数" :min="1" :max="20" />
        </div>

        <ExportPathField />
        <button type="button" class="btn btn--primary" @click="onRun">
          {{ feature.primaryAction }}
        </button>
      </section>
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
