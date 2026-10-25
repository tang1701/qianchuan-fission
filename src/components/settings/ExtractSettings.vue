<script setup lang="ts">
import { storeToRefs } from 'pinia'
import SliderField from '../ui/SliderField.vue'
import ExportPathField from '../workspace/ExportPathField.vue'
import { useFeatureStateStore } from '../../stores/featureState'

const emit = defineEmits<{ run: [] }>()

const store = useFeatureStateStore()
const {
  extractMode,
  extractPrompt,
  sliceMinSec,
  sliceMaxSec,
  batchCount,
} = storeToRefs(store)
</script>

<template>
  <aside class="panel settings-panel">
    <div class="settings-panel__scroll">
      <section class="settings-block">
        <h4 class="settings-block__title">提取模式</h4>
        <div class="segmented segmented--block">
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': extractMode === 'ai' }"
            @click="extractMode = 'ai'"
          >
            AI 智能分析
          </button>
          <button
            type="button"
            class="segmented__btn"
            :class="{ 'segmented__btn--active': extractMode === 'manual' }"
            @click="extractMode = 'manual'"
          >
            手动选段
          </button>
        </div>
        <label v-if="extractMode === 'ai'" class="field-label">
          AI 提示词
          <textarea v-model="extractPrompt" class="script-panel__textarea" rows="4" />
        </label>
        <SliderField v-model="sliceMinSec" label="片段最短" :min="3" :max="120" suffix="秒" />
        <SliderField v-model="sliceMaxSec" label="片段最长" :min="5" :max="300" suffix="秒" />
      </section>
      <section class="settings-block">
        <ExportPathField />
        <SliderField v-model="batchCount" label="每条视频导出切片数" :min="1" :max="50" />
      </section>
    </div>
    <footer class="settings-panel__actions">
      <button type="button" class="btn btn--primary btn--block" @click="emit('run')">
        开始批量切片
      </button>
    </footer>
  </aside>
</template>
