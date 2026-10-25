<script setup lang="ts">
import { storeToRefs } from 'pinia'
import MixSettings from './MixSettings.vue'
import SliderField from '../ui/SliderField.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import { useFeatureStateStore } from '../../stores/featureState'

const emit = defineEmits<{ run: [] }>()

const { outputPreset, outputWidth, outputHeight, outputFps, outputBrightness, removeBlackBar } =
  storeToRefs(useFeatureStateStore())

const presets = [
  { id: '9:16' as const, label: '竖屏 9:16' },
  { id: '16:9' as const, label: '横屏 16:9' },
  { id: '1:1' as const, label: '方形 1:1' },
  { id: 'original' as const, label: '原始比例' },
]

function applyPreset(id: typeof outputPreset.value) {
  outputPreset.value = id
  if (id === '9:16') {
    outputWidth.value = 1080
    outputHeight.value = 1920
  } else if (id === '16:9') {
    outputWidth.value = 1920
    outputHeight.value = 1080
  } else if (id === '1:1') {
    outputWidth.value = 1080
    outputHeight.value = 1080
  }
}
</script>

<template>
  <MixSettings action-label="开始分类混剪" show-category-rules @run="emit('run')">
    <template #frame-extra>
      <section class="settings-block">
        <h4 class="settings-block__title">成片输出</h4>
        <div class="tag-row">
          <button
            v-for="p in presets"
            :key="p.id"
            type="button"
            class="tag-btn"
            :class="{ 'tag-btn--active': outputPreset === p.id }"
            @click="applyPreset(p.id)"
          >
            {{ p.label }}
          </button>
        </div>
        <SliderField v-model="outputFps" label="帧率" :min="24" :max="60" />
        <SliderField v-model="outputBrightness" label="输出亮度" :min="80" :max="120" suffix="%" />
        <ToggleSwitch v-model="removeBlackBar" label="智能去黑边" />
      </section>
    </template>
  </MixSettings>
</template>
