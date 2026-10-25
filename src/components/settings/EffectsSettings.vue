<script setup lang="ts">
import { storeToRefs } from 'pinia'
import SliderField from '../ui/SliderField.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import ExportPathField from '../workspace/ExportPathField.vue'
import { useFeatureStateStore } from '../../stores/featureState'

const emit = defineEmits<{ run: [] }>()

const store = useFeatureStateStore()
const {
  settingsTab,
  fissionCount,
  removeWatermark,
  addTextWatermark,
  watermarkText,
  aiSplitEnabled,
  splitIntervalSec,
  mirrorRandom,
  speedJitter,
  batchCount,
} = storeToRefs(store)
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
      </section>
      <section class="settings-block">
        <h4 class="settings-block__title">水印</h4>
        <ToggleSwitch v-model="removeWatermark" label="智能去水印" />
        <ToggleSwitch v-model="addTextWatermark" label="添加文字水印" />
        <label v-if="addTextWatermark" class="field-label">
          水印文字
          <input v-model="watermarkText" class="text-input" />
        </label>
      </section>
      <section class="settings-block">
        <h4 class="settings-block__title">分割</h4>
        <ToggleSwitch v-model="aiSplitEnabled" label="AI 智能分割" />
        <SliderField
          v-model="splitIntervalSec"
          label="自定义间隔（秒）"
          :min="1"
          :max="30"
        />
      </section>
    </div>

    <div v-show="settingsTab === 'output'" class="settings-panel__scroll">
      <section class="settings-block">
        <ExportPathField />
        <SliderField v-model="batchCount" label="并行任务数" :min="1" :max="16" />
      </section>
    </div>

    <footer class="settings-panel__actions">
      <button type="button" class="btn btn--primary btn--block" @click="emit('run')">
        开始批量处理
      </button>
    </footer>
  </aside>
</template>
