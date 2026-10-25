<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMaterialStore } from '../../stores/material'

withDefaults(
  defineProps<{
    showMatchMode?: boolean
    importLabel?: string
    reorder?: boolean
    draggable?: boolean
  }>(),
  {
    showMatchMode: true,
    importLabel: '导入文件夹',
    reorder: false,
    draggable: false,
  },
)

const store = useMaterialStore()
const { folders, selectedFolderId, matchMode, previewFilePath } = storeToRefs(store)

const previewLimit = 12
const folderInput = ref<HTMLInputElement | null>(null)
const dragFromIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  dragFromIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(toIndex: number, e: DragEvent) {
  e.preventDefault()
  const from =
    dragFromIndex.value ??
    (e.dataTransfer?.getData('text/plain') ? Number(e.dataTransfer.getData('text/plain')) : null)
  if (from == null || Number.isNaN(from) || from === toIndex) return
  store.moveFolderOrder(from, toIndex)
  dragFromIndex.value = null
}

async function pickFolder() {
  const desktop = await store.importFolderInteractive()
  if (desktop === null) folderInput.value?.click()
}

function onFolderChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    const ok = store.addFolderFromFiles(input.files)
    if (!ok) window.alert('未检测到视频文件，请选择包含 mp4/mov 等文件的文件夹。')
  }
  input.value = ''
}

function moveUp(index: number) {
  store.moveFolderOrder(index, index - 1)
}

function moveDown(index: number) {
  store.moveFolderOrder(index, index + 1)
}
</script>

<template>
  <aside class="panel folder-panel">
    <input
      ref="folderInput"
      type="file"
      class="sr-only"
      webkitdirectory
      directory
      multiple
      @change="onFolderChange"
    />
    <button type="button" class="btn btn--primary btn--block" @click="pickFolder">
      {{ importLabel }}
    </button>

    <div class="folder-panel__list">
      <template v-if="folders.length">
        <div
          v-for="(folder, index) in folders"
          :key="folder.id"
          class="folder-item-wrap"
          :class="{ 'folder-item-wrap--drag': draggable || reorder }"
          :draggable="draggable || reorder"
          @dragstart="onDragStart(index, $event)"
          @dragover="onDragOver"
          @drop="onDrop(index, $event)"
        >
          <button
            type="button"
            class="folder-item"
            :class="{ 'folder-item--active': folder.id === selectedFolderId }"
            @click="store.selectFolder(folder.id)"
          >
            <span class="folder-item__icon" aria-hidden="true">📁</span>
            <span class="folder-item__meta">
              <span class="folder-item__name">{{ folder.name }}</span>
              <span class="folder-item__count">{{ folder.fileCount }} 个视频</span>
            </span>
            <button
              type="button"
              class="folder-item__remove"
              title="移除"
              @click.stop="store.removeFolder(folder.id)"
            >
              ×
            </button>
          </button>
          <ul
            v-if="folder.id === selectedFolderId && folder.filePaths.length"
            class="folder-files"
          >
            <li
              v-for="(fp, fi) in folder.filePaths.slice(0, previewLimit)"
              :key="fp"
            >
              <button
                type="button"
                class="folder-files__btn"
                :class="{ 'folder-files__btn--active': previewFilePath === fp }"
                @click="store.selectPreviewFile(fp)"
              >
                {{ folder.videoFiles[fi] ?? fp }}
              </button>
            </li>
            <li v-if="folder.filePaths.length > previewLimit" class="folder-files__more">
              还有 {{ folder.filePaths.length - previewLimit }} 个…
            </li>
          </ul>
          <div v-if="reorder" class="folder-item__order">
            <button type="button" class="btn btn--ghost btn--sm" :disabled="index === 0" @click="moveUp(index)">
              ↑
            </button>
            <span class="folder-item__order-label">顺序 {{ index + 1 }}</span>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              :disabled="index === folders.length - 1"
              @click="moveDown(index)"
            >
              ↓
            </button>
          </div>
        </div>
      </template>
      <div v-else class="empty-state empty-state--compact">
        <div class="empty-state__icon" aria-hidden="true">📂</div>
        <p class="empty-state__title">暂无文件夹</p>
        <p class="empty-state__hint">点击导入；分类混剪下可拖拽文件夹调整顺序</p>
      </div>
    </div>

    <div v-if="showMatchMode" class="folder-panel__footer">
      <p class="folder-panel__footer-label">选镜模式</p>
      <div class="match-mode-grid">
        <button
          type="button"
          class="segmented__btn"
          :class="{ 'segmented__btn--active': matchMode === 'local' }"
          @click="matchMode = 'local'"
        >
          本地文件名
        </button>
        <button
          type="button"
          class="segmented__btn"
          :class="{ 'segmented__btn--active': matchMode === 'cloud' }"
          @click="matchMode = 'cloud'"
        >
          云端嵌入
        </button>
        <button
          type="button"
          class="segmented__btn"
          :class="{ 'segmented__btn--active': matchMode === 'clip' }"
          @click="matchMode = 'clip'"
        >
          CLIP 本地
        </button>
        <button
          type="button"
          class="segmented__btn"
          :class="{ 'segmented__btn--active': matchMode === 'vision' }"
          @click="matchMode = 'vision'"
        >
          Vision API
        </button>
      </div>
      <p class="folder-panel__hint">CLIP / Vision / 云端需在「全局设置」配置 Key 或本地 Ollama</p>
    </div>
  </aside>
</template>
