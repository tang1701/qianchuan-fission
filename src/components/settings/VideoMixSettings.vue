<script setup lang="ts">
import { storeToRefs } from 'pinia'
import MixSettings from './MixSettings.vue'
import SliderField from '../ui/SliderField.vue'
import ToggleSwitch from '../ui/ToggleSwitch.vue'
import { useFeatureStateStore } from '../../stores/featureState'

const emit = defineEmits<{ run: [] }>()

const {
  outputPreset,
  outputWidth,
  outputHeight,
  outputFps,
  outputBrightness,
  removeBlackBar,
  autoAspect,
  mixClipsPerVideo,
  mixPreferFilenameMatch,
} = storeToRefs(useFeatureStateStore())

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
  <MixSettings action-label="开始批量混剪" show-mix-rules @run="emit('run')">
    <template #frame-extra>
      <section class="settings-block">
        <h4 class="settings-block__title">随机混剪</h4>
        <SliderField v-model="mixClipsPerVideo" label="每条成片片段数" :min="3" :max="30" />
        <p class="settings-block__muted">
          无文案或未开 TTS 时：从素材库随机抽段重组；填写文案并开启 TTS 则按句配音选片。
        </p>
        <ToggleSwitch
          v-model="mixPreferFilenameMatch"
          label="按文件名匹配素材（本地启发式）"
        />
      </section>
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
        <SliderField
          v-if="outputPreset !== 'original'"
          v-model="outputWidth"
          label="输出宽度"
          :min="720"
          :max="3840"
        />
        <SliderField
          v-if="outputPreset !== 'original'"
          v-model="outputHeight"
          label="输出高度"
          :min="720"
          :max="3840"
        />
        <SliderField v-model="outputFps" label="帧率" :min="24" :max="60" />
        <SliderField v-model="outputBrightness" label="输出亮度" :min="80" :max="120" suffix="%" />
        <ToggleSwitch v-model="removeBlackBar" label="智能去黑边（裁剪填充）" />
        <ToggleSwitch v-model="autoAspect" label="横竖屏自适应（预留）" />
      </section>
    </template>
  </MixSettings>
</template>
