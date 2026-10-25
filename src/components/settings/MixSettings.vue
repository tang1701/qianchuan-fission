<script setup lang="ts">
import { storeToRefs } from 'pinia'
import SliderField from '../ui/SliderField.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import ExportPathField from '../workspace/ExportPathField.vue'
import { subtitlePresets, useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'

defineProps<{
  actionLabel: string
  showMixRules?: boolean
  showCategoryRules?: boolean
}>()

const emit = defineEmits<{ run: [] }>()

const store = useFeatureStateStore()
const {
  settingsTab,
  originalVolume,
  bgmEnabled,
  bgmPath,
  bgmVolume,
  ttsEnabled,
  ttsVoice,
  ttsDialect,
  ttsVolume,
  ttsRate,
  fontFamily,
  fontSize,
  fontWeight,
  strokeWidth,
  fontOpacity,
  presetId,
  batchCount,
  clipMinSec,
  clipMaxSec,
  shuffleClips,
  keepOriginalAudio,
  categoryPickMode,
} = storeToRefs(store)

const fontOptions = ['Noto Sans SC', 'Source Han Sans', 'PingFang SC', 'Microsoft YaHei']
const voiceOptions = ['小何 2.0', '云希', '晓晓', '东北话-老铁']
const dialectOptions = ['普通话', '粤语', '四川话', '东北话']

async function pickBgm() {
  const api = getDesktopApi()
  if (!api?.pickAudio) {
    window.alert('请使用桌面版选择 BGM 文件')
    return
  }
  const p = await api.pickAudio()
  if (p) bgmPath.value = p
}
</script>

<template>
  <aside class="panel settings-panel">
    <div class="tabs">
      <button
        type="button"
        class="tabs__btn"
        :class="{ 'tabs__btn--active': settingsTab === 'basic' }"
        @click="settingsTab = 'basic'"
      >
        基础设置
      </button>
      <button
        type="button"
        class="tabs__btn"
        :class="{ 'tabs__btn--active': settingsTab === 'frame' }"
        @click="settingsTab = 'frame'"
      >
        画面处理
      </button>
    </div>

    <div v-show="settingsTab === 'basic'" class="settings-panel__scroll">
      <section v-if="showCategoryRules" class="settings-block">
        <h4 class="settings-block__title">分类抽取</h4>
        <div class="segmented segmented--block">
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': categoryPickMode === 'random' }"
            @click="categoryPickMode = 'random'"
          >
            随机抽取
          </button>
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': categoryPickMode === 'sequential' }"
            @click="categoryPickMode = 'sequential'"
          >
            顺序抽取
          </button>
        </div>
        <p class="settings-block__muted">左侧文件夹顺序即为混剪结构，可用 ↑↓ 调整。</p>
      </section>

      <section v-if="showMixRules" class="settings-block">
        <h4 class="settings-block__title">混剪规则</h4>
        <SliderField v-model="clipMinSec" label="片段最短" :min="1" :max="30" suffix="秒" />
        <SliderField v-model="clipMaxSec" label="片段最长" :min="2" :max="60" suffix="秒" />
        <ToggleSwitch v-model="shuffleClips" label="随机重组片段" />
        <ToggleSwitch v-model="keepOriginalAudio" label="保留原视频音轨" />
      </section>

      <section class="settings-block">
        <h4 class="settings-block__title">音频</h4>
        <SliderField v-model="originalVolume" label="原视频音量" :min="0" :max="100" suffix="%" />
        <div class="settings-block__row">
          <ToggleSwitch v-model="bgmEnabled" label="背景音乐" />
          <button type="button" class="btn btn--ghost btn--sm" :disabled="!bgmEnabled" @click="pickBgm">
            选择文件
          </button>
        </div>
        <p v-if="bgmPath" class="settings-block__muted bgm-path">{{ bgmPath }}</p>
        <SliderField v-model="bgmVolume" label="BGM 音量" :min="0" :max="100" suffix="%" />
      </section>

      <section class="settings-block">
        <div class="settings-block__row">
          <h4 class="settings-block__title">语音合成</h4>
          <ToggleSwitch v-model="ttsEnabled" />
        </div>
        <div v-if="ttsEnabled" class="voice-picker">
          <div class="voice-picker__avatar">何</div>
          <div class="voice-picker__fields">
            <select v-model="ttsVoice" class="select">
              <option v-for="v in voiceOptions" :key="v" :value="v">{{ v }}</option>
            </select>
            <select v-model="ttsDialect" class="select">
              <option v-for="d in dialectOptions" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>
        </div>
        <SliderField v-model="ttsVolume" label="音量调整" :min="0" :max="300" suffix="%" />
        <SliderField v-model="ttsRate" label="语速调整" :min="0.5" :max="2" :step="0.1" suffix="x" />
      </section>

      <section class="settings-block">
        <h4 class="settings-block__title">字幕样式</h4>
        <label class="field-label">
          选择字体
          <select v-model="fontFamily" class="select select--block">
            <option v-for="f in fontOptions" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <SliderField v-model="fontSize" label="字号大小" :min="12" :max="72" />
        <SliderField v-model="fontWeight" label="字体粗细" :min="400" :max="900" :step="100" />
        <SliderField v-model="strokeWidth" label="描边粗细" :min="0" :max="8" />
        <SliderField v-model="fontOpacity" label="字体透明" :min="0" :max="100" suffix="%" />
        <p class="preset-label">样式预设</p>
        <div class="preset-grid">
          <button
            v-for="p in subtitlePresets"
            :key="p.id"
            type="button"
            class="preset-dot"
            :class="{ 'preset-dot--active': presetId === p.id }"
            :style="{ background: p.textColor, boxShadow: `inset 0 0 0 3px ${p.strokeColor}` }"
            @click="presetId = p.id"
          />
        </div>
      </section>
    </div>

    <div v-show="settingsTab === 'frame'" class="settings-panel__scroll">
      <slot name="frame-extra">
        <section class="settings-block">
          <h4 class="settings-block__title">画面处理</h4>
          <SliderField v-model="originalVolume" label="输出亮度" :min="50" :max="150" suffix="%" />
          <ToggleSwitch :model-value="true" label="智能去黑边" />
          <ToggleSwitch :model-value="false" label="横竖屏自适应" />
        </section>
      </slot>
    </div>

    <footer class="settings-panel__actions settings-panel__actions--stack">
      <ExportPathField />
      <SliderField v-model="batchCount" label="生成数量" :min="1" :max="999" />
      <button type="button" class="btn btn--primary btn--block" @click="emit('run')">
        {{ actionLabel }}
      </button>
    </footer>
  </aside>
</template>
