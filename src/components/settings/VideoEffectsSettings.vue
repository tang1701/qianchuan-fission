<script setup lang="ts">
import { storeToRefs } from 'pinia'
import SliderField from '../ui/SliderField.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import ExportPathField from '../workspace/ExportPathField.vue'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'

const emit = defineEmits<{ run: [] }>()

const store = useFeatureStateStore()
const {
  settingsTab,
  fissionCount,
  removeWatermark,
  watermarkRemoveMode,
  eraseTop,
  eraseHeight,
  fxDelogoLeft,
  fxDelogoWidth,
  addTextWatermark,
  watermarkText,
  fxAddImageWatermark,
  fxImageWatermarkPath,
  fxAddVideoWatermark,
  fxVideoWatermarkPath,
  fxWatermarkPosition,
  aiSplitEnabled,
  splitIntervalSec,
  mirrorRandom,
  speedJitter,
  fxSaturation,
  fxSaturationJitter,
  fxContrast,
  fxNoiseAmount,
  fxBrightnessJitter,
  fxCrf,
  batchCount,
} = storeToRefs(store)

const wmPositions = [
  { id: 'top-left' as const, label: '左上' },
  { id: 'top-right' as const, label: '右上' },
  { id: 'bottom-left' as const, label: '左下' },
  { id: 'bottom-right' as const, label: '右下' },
]

async function pickImage() {
  const api = getDesktopApi()
  if (!api?.pickImage) return
  const p = await api.pickImage()
  if (p) fxImageWatermarkPath.value = p
}

async function pickVideoWm() {
  const api = getDesktopApi()
  if (!api?.pickVideos) return
  const files = await api.pickVideos()
  if (files[0]?.path) fxVideoWatermarkPath.value = files[0].path
}
</script>

<template>
  <aside class="panel settings-panel">
    <div class="tabs">
      <button
        type="button"
        class="tabs__btn"
        :class="{ 'tabs__btn--active': settingsTab === 'effect' }"
        @click="settingsTab = 'effect'"
      >
        效果设置
      </button>
      <button
        type="button"
        class="tabs__btn"
        :class="{ 'tabs__btn--active': settingsTab === 'output' }"
        @click="settingsTab = 'output'"
      >
        输出设置
      </button>
    </div>

    <div v-show="settingsTab === 'effect'" class="settings-panel__scroll">
      <section class="settings-block">
        <h4 class="settings-block__title">裂变与差异化</h4>
        <SliderField v-model="fissionCount" label="每条裂变数量" :min="1" :max="50" />
        <ToggleSwitch v-model="mirrorRandom" label="随机镜像翻转" />
        <ToggleSwitch v-model="speedJitter" label="随机微变速" />
        <ToggleSwitch v-model="fxSaturationJitter" label="饱和度差异化" />
        <ToggleSwitch v-model="fxBrightnessJitter" label="亮度微扰" />
        <SliderField v-model="fxSaturation" label="基础饱和度 %" :min="50" :max="150" />
        <SliderField v-model="fxContrast" label="对比度 %" :min="80" :max="130" />
        <SliderField v-model="fxNoiseAmount" label="胶片噪点" :min="0" :max="25" />
      </section>

      <section class="settings-block">
        <h4 class="settings-block__title">水印</h4>
        <ToggleSwitch v-model="removeWatermark" label="去水印 / 字幕条" />
        <div v-if="removeWatermark" class="segmented segmented--block">
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': watermarkRemoveMode === 'delogo' }"
            @click="watermarkRemoveMode = 'delogo'"
          >
            快速 delogo
          </button>
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': watermarkRemoveMode === 'inpaint' }"
            @click="watermarkRemoveMode = 'inpaint'"
          >
            智能模糊修复
          </button>
        </div>
        <template v-if="removeWatermark">
          <SliderField v-model="eraseTop" label="区域顶部 %" :min="0" :max="95" />
          <SliderField v-model="eraseHeight" label="区域高度 %" :min="4" :max="40" />
          <SliderField v-model="fxDelogoLeft" label="区域左侧 %" :min="0" :max="90" />
          <SliderField v-model="fxDelogoWidth" label="区域宽度 %" :min="10" :max="100" />
        </template>
        <ToggleSwitch v-model="addTextWatermark" label="添加文字水印" />
        <label v-if="addTextWatermark" class="field-label">
          水印文字
          <input v-model="watermarkText" class="text-input" />
        </label>
        <ToggleSwitch v-model="fxAddImageWatermark" label="添加图片水印" />
        <div v-if="fxAddImageWatermark" class="field-row">
          <button type="button" class="btn btn--ghost btn--sm" @click="pickImage">选择图片</button>
          <span class="field-hint">{{ fxImageWatermarkPath || '未选择' }}</span>
        </div>
        <ToggleSwitch v-model="fxAddVideoWatermark" label="画中画视频水印" />
        <div v-if="fxAddVideoWatermark" class="field-row">
          <button type="button" class="btn btn--ghost btn--sm" @click="pickVideoWm">选择视频</button>
          <span class="field-hint">{{ fxVideoWatermarkPath || '未选择' }}</span>
        </div>
        <label v-if="fxAddImageWatermark || fxAddVideoWatermark" class="field-label">
          水印位置
          <select v-model="fxWatermarkPosition" class="text-input">
            <option v-for="p in wmPositions" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </label>
      </section>

      <section class="settings-block">
        <h4 class="settings-block__title">分割</h4>
        <ToggleSwitch v-model="aiSplitEnabled" label="AI 场景分割（切点检测）" />
        <p v-if="aiSplitEnabled" class="field-hint">
          按镜头切点导出多段；关闭后可用下方固定间隔分割。
        </p>
        <SliderField
          v-model="splitIntervalSec"
          label="固定间隔（秒，0=不分割；非 AI 时生效）"
          :min="0"
          :max="120"
        />
      </section>
    </div>

    <div v-show="settingsTab === 'output'" class="settings-panel__scroll">
      <section class="settings-block">
        <ExportPathField />
        <SliderField v-model="fxCrf" label="画质 CRF（越小越清晰）" :min="18" :max="28" />
        <SliderField v-model="batchCount" label="并行任务数（预留）" :min="1" :max="16" />
      </section>
    </div>

    <footer class="settings-panel__actions">
      <button type="button" class="btn btn--primary btn--block" @click="emit('run')">
        开始批量处理
      </button>
    </footer>
  </aside>
</template>
