<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useMaterialStore } from '../../stores/material'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'

withDefaults(
  defineProps<{
    title?: string
    placeholder?: string
  }>(),
  {
    title: '视频文案',
    placeholder: '在此输入视频文案…',
  },
)

const material = useMaterialStore()
const feature = useFeatureStateStore()
const { selectedFolder } = storeToRefs(material)
const { scriptText, scriptAudioPath } = storeToRefs(feature)

async function pickAudio() {
  const api = getDesktopApi()
  if (!api?.pickAudio) {
    window.alert('请使用桌面版导入音频')
    return
  }
  const p = await api.pickAudio()
  if (p) {
    scriptAudioPath.value = p
    feature.ttsEnabled = false
  }
}

function clearAudio() {
  scriptAudioPath.value = ''
}
</script>

<template>
  <section class="panel script-panel">
    <header class="script-panel__head">
      <h3>{{ title }}</h3>
      <button
        type="button"
        class="btn btn--ghost btn--sm"
        :disabled="!selectedFolder"
        @click="pickAudio"
      >
        添加音频
      </button>
    </header>
    <div v-if="!selectedFolder" class="empty-state empty-state--compact">
      <div class="empty-state__icon" aria-hidden="true">📝</div>
      <p class="empty-state__hint">
        请在左侧选择一个文件夹…选中文件夹后即可输入文案或添加音频
      </p>
    </div>
    <template v-else>
      <p v-if="scriptAudioPath" class="script-audio-tag">
        已导入配音：{{ scriptAudioPath }}
        <button type="button" class="link-btn" @click="clearAudio">清除</button>
      </p>
      <textarea
        v-model="scriptText"
        class="script-panel__textarea"
        :placeholder="placeholder"
        rows="6"
      />
    </template>
  </section>
</template>
