<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMaterialStore } from '../../stores/material'

withDefaults(
  defineProps<{
    importLabel?: string
  }>(),
  { importLabel: '导入视频' },
)

const store = useMaterialStore()
const { looseVideos, selectedVideoId } = storeToRefs(store)
const fileInput = ref<HTMLInputElement | null>(null)

async function pickFiles() {
  const desktop = await store.importVideosInteractive()
  if (desktop === null) fileInput.value?.click()
}

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    const ok = store.addLooseVideos(input.files)
    if (!ok) window.alert('请选择 mp4/mov/mkv 等视频文件。')
  }
  input.value = ''
}
</script>

<template>
  <aside class="panel folder-panel">
    <input ref="fileInput" type="file" class="sr-only" accept="video/*" multiple @change="onFiles" />
    <button type="button" class="btn btn--primary btn--block" @click="pickFiles">
      {{ importLabel }}
    </button>

    <div class="folder-panel__list">
      <template v-if="looseVideos.length">
        <button
          v-for="video in looseVideos"
          :key="video.id"
          type="button"
          class="folder-item"
          :class="{ 'folder-item--active': video.id === selectedVideoId }"
          @click="store.selectVideo(video.id)"
        >
          <span class="folder-item__icon" aria-hidden="true">🎬</span>
          <span class="folder-item__meta">
            <span class="folder-item__name">{{ video.name }}</span>
            <span class="folder-item__count">{{ (video.size / 1024 / 1024).toFixed(1) }} MB</span>
          </span>
          <button
            type="button"
            class="folder-item__remove"
            title="移除"
            @click.stop="store.removeVideo(video.id)"
          >
            ×
          </button>
        </button>
      </template>
      <div v-else class="empty-state empty-state--compact">
        <div class="empty-state__icon" aria-hidden="true">🎞️</div>
        <p class="empty-state__title">暂无视频</p>
        <p class="empty-state__hint">导入待处理的视频文件</p>
      </div>
    </div>
  </aside>
</template>
