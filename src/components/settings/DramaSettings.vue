<script setup lang="ts">
import { storeToRefs } from 'pinia'
import SliderField from '../ui/SliderField.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import ExportPathField from '../workspace/ExportPathField.vue'
import { useFeatureStateStore } from '../../stores/featureState'

const emit = defineEmits<{ run: [] }>()

const store = useFeatureStateStore()
const {
  dramaMode,
  dramaLines,
  episodeOrder,
  ttsEnabled,
  keepOriginalAudio,
  removeBlackBar,
  outputPreset,
} = storeToRefs(store)
</script>

<template>
  <aside class="panel settings-panel">
    <div class="settings-panel__scroll">
      <section class="settings-block">
        <h4 class="settings-block__title">短剧策略</h4>
        <div class="segmented segmented--block">
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': dramaMode === 'highlight' }"
            @click="dramaMode = 'highlight'"
          >
            高光提取
          </button>
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': dramaMode === 'plot' }"
            @click="dramaMode = 'plot'"
          >
            剧情精剪
          </button>
        </div>
        <SliderField v-model="dramaLines" label="剧情线数量" :min="1" :max="10" />
        <div class="segmented segmented--block">
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': episodeOrder === 'asc' }"
            @click="episodeOrder = 'asc'"
          >
            按集数顺序
          </button>
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': episodeOrder === 'shuffle' }"
            @click="episodeOrder = 'shuffle'"
          >
            随机集数
          </button>
        </div>
      </section>
      <section class="settings-block">
        <h4 class="settings-block__title">解说</h4>
        <ToggleSwitch v-model="ttsEnabled" label="解说 TTS（需填写文案）" />
        <ToggleSwitch v-model="keepOriginalAudio" label="无 TTS 时保留原音轨" />
        <ToggleSwitch v-model="removeBlackBar" label="成片去黑边" />
        <div class="segmented segmented--block">
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': outputPreset === '9:16' }"
            @click="outputPreset = '9:16'"
          >
            竖屏 9:16
          </button>
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': outputPreset === '16:9' }"
            @click="outputPreset = '16:9'"
          >
            横屏 16:9
          </button>
        </div>
      </section>
      <section class="settings-block">
        <ExportPathField />
      </section>
    </div>
    <footer class="settings-panel__actions">
      <button type="button" class="btn btn--primary btn--block" @click="emit('run')">
        开始短剧混剪
      </button>
    </footer>
  </aside>
</template>
