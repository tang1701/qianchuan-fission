<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMaterialStore } from '../../stores/material'
import { useFeatureStateStore } from '../../stores/featureState'

const props = defineProps<{
  fileStatus: Record<string, 'idle' | 'done' | 'processing'>
}>()

const material = useMaterialStore()
const { fxImportSort, fxImportDedupe } = storeToRefs(useFeatureStateStore())
const { looseVideos, selectedVideoId } = storeToRefs(material)
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)

const totalMb = computed(() =>
  (looseVideos.value.reduce((s, v) => s + (v.size || 0), 0) / 1024 / 1024).toFixed(1),
)

watch(fxImportSort, (mode) => {
  if (looseVideos.value.length) material.sortLooseVideos(mode)
})

async function pickFiles() {
  const desktop = await material.importVideosInteractive()
  if (desktop === null) fileInput.value?.click()
  else material.sortLooseVideos(fxImportSort.value)
}

function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    const ok = material.addLooseVideos(input.files, fxImportDedupe.value)
    if (!ok) window.alert('未识别为视频文件，请选择 mp4 / mov / mkv 等格式。')
    else material.sortLooseVideos(fxImportSort.value)
  }
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files?.length) {
    material.addLooseVideos(e.dataTransfer.files, fxImportDedupe.value)
    material.sortLooseVideos(fxImportSort.value)
  }
}

function statusLabel(id: string) {
  const s = props.fileStatus[id] ?? 'idle'
  if (s === 'done') return '处理完成'
  if (s === 'processing') return '处理中…'
  const v = looseVideos.value.find((x) => x.id === id)
  if (v && (v.path || v.objectUrl)) return '已导入'
  return '待处理'
}
</script>

<template>
  <aside class="fx-assets">
    <header class="fx-pane-head">素材列表</header>

    <div class="fx-assets__top">
      <button type="button" class="btn btn--primary fx-assets__import-main" @click="pickFiles">
        + 导入视频
      </button>
      <div class="fx-assets__toolbar">
        <label class="fx-assets__tool">
          排序
          <select v-model="fxImportSort" class="fx-select fx-select--sm">
            <option value="name">文件名</option>
            <option value="size">大小</option>
            <option value="time">时间</option>
          </select>
        </label>
        <label class="fx-assets__tool fx-assets__tool--check">
          <input v-model="fxImportDedupe" type="checkbox" />
          去重
        </label>
      </div>
    </div>

    <input ref="fileInput" type="file" class="sr-only" accept="video/*" multiple @change="onFiles" />

    <div
      class="fx-assets__list"
      :class="{ 'fx-assets__list--drag': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div
        v-for="(video, idx) in looseVideos"
        :key="video.id"
        class="fx-assets__item"
        :class="{ 'fx-assets__item--active': video.id === selectedVideoId }"
        role="button"
        tabindex="0"
        @click="material.selectVideo(video.id)"
        @keydown.enter="material.selectVideo(video.id)"
      >
        <span class="fx-assets__item-idx">{{ idx + 1 }}</span>
        <div class="fx-assets__item-body">
          <span class="fx-assets__item-name" :title="video.name">{{ video.name }}</span>
          <div class="fx-assets__item-row">
            <span class="fx-assets__item-meta">
              {{ video.size ? `${(video.size / 1024 / 1024).toFixed(1)} MB` : '—' }}
            </span>
            <span
              class="fx-assets__item-status"
              :class="{
                'fx-assets__item-status--done': (fileStatus[video.id] ?? 'idle') === 'done',
                'fx-assets__item-status--run': (fileStatus[video.id] ?? 'idle') === 'processing',
              }"
            >
              {{ statusLabel(video.id) }}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="fx-assets__remove"
          title="移除"
          @click.stop="material.removeVideo(video.id)"
        >
          ×
        </button>
      </div>
      <div v-if="!looseVideos.length" class="fx-assets__drop-hint">
        <p>拖拽视频到此处</p>
        <p class="fx-assets__drop-sub">或点击「导入视频」</p>
      </div>
    </div>

    <footer v-if="looseVideos.length" class="fx-assets__foot">
      <p class="fx-assets__summary">共 {{ looseVideos.length }} 个 · {{ totalMb }} MB</p>
    </footer>
  </aside>
</template>
