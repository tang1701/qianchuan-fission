<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useFeatureStateStore } from '../../stores/featureState'

const store = useFeatureStateStore()
const {
  fxSplitMode,
  fxTrimIntroSec,
  fxTrimOutroSec,
  fxFilterMinSegmentSec,
  splitIntervalSec,
  fxSplitMaxSec,
  fxMergeShortSegments,
  fxAiSceneSensitivity,
} = storeToRefs(store)

function setSplit(mode: 'none' | 'ai' | 'interval') {
  fxSplitMode.value = mode
  if (mode === 'none') splitIntervalSec.value = 0
  if (mode === 'interval' && splitIntervalSec.value < 1) splitIntervalSec.value = 30
  if (mode !== 'none' && fxFilterMinSegmentSec.value < 1) fxFilterMinSegmentSec.value = 1
}
</script>

<template>
  <section class="fx-split-bar" aria-label="视频分割">
    <div class="fx-split-bar__row">
      <span class="fx-split-bar__label">视频分割：</span>
      <label class="fx-split-bar__radio">
        <input
          type="radio"
          name="fx-split"
          :checked="fxSplitMode === 'none'"
          @change="setSplit('none')"
        />
        不启用
      </label>
      <label class="fx-split-bar__radio">
        <input
          type="radio"
          name="fx-split"
          :checked="fxSplitMode === 'ai'"
          @change="setSplit('ai')"
        />
        AI 智能分割
      </label>
      <label class="fx-split-bar__radio">
        <input
          type="radio"
          name="fx-split"
          :checked="fxSplitMode === 'interval'"
          @change="setSplit('interval')"
        />
        自定义间隔
      </label>
    </div>
    <div class="fx-split-bar__fields">
      <label class="fx-split-bar__field">
        去头
        <input v-model.number="fxTrimIntroSec" type="number" min="0" max="60" step="0.1" class="fx-input" />
        <span class="fx-split-bar__unit">秒</span>
      </label>
      <label class="fx-split-bar__field">
        去尾
        <input v-model.number="fxTrimOutroSec" type="number" min="0" max="60" step="0.1" class="fx-input" />
        <span class="fx-split-bar__unit">秒</span>
      </label>
      <label class="fx-split-bar__field">
        最短片段
        <input v-model.number="fxFilterMinSegmentSec" type="number" min="0" max="3600" step="0.1" class="fx-input" />
        <span class="fx-split-bar__unit">秒</span>
      </label>
      <label v-if="fxSplitMode === 'interval'" class="fx-split-bar__field">
        分割间隔
        <input v-model.number="splitIntervalSec" type="number" min="1" max="3600" class="fx-input" />
        <span class="fx-split-bar__unit">秒</span>
      </label>
      <label v-if="fxSplitMode === 'ai'" class="fx-split-bar__field">
        AI 灵敏度
        <input v-model.number="fxAiSceneSensitivity" type="number" min="0" max="100" class="fx-input" />
      </label>
      <label v-if="fxSplitMode !== 'none'" class="fx-split-bar__field">
        最长片段
        <input
          v-model.number="fxSplitMaxSec"
          type="number"
          min="0"
          max="3600"
          class="fx-input"
          title="0 表示不限制"
        />
        <span class="fx-split-bar__unit">秒</span>
      </label>
      <label v-if="fxSplitMode !== 'none'" class="fx-split-bar__check">
        <input v-model="fxMergeShortSegments" type="checkbox" />
        合并过短片段
      </label>
    </div>
  </section>
</template>
