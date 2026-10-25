<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMaterialStore } from '../../stores/material'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'
import {
  displayRectToNorm,
  normToDisplayRect,
  rectFromAspect,
  videoContainRect,
  type NormRect,
} from './fxPreviewGeometry'

const props = defineProps<{
  mode: 'none' | 'crop' | 'text'
  cropRatio: '9:16' | '1:1' | '16:9'
}>()

const emit = defineEmits<{
  closeCrop: []
  addText: []
  closeText: []
  startCrop: []
  setCropRatio: ['9:16' | '1:1' | '16:9']
}>()

const material = useMaterialStore()
const store = useFeatureStateStore()
const { selectedVideo } = storeToRefs(material)
const {
  fxCropRatio,
  fxCropRectNorm,
  fxTextOverlays,
  fxActiveTextId,
} = storeToRefs(store)

const stageRef = ref<HTMLDivElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)
const loadError = ref(false)
const loadErrorReason = ref('')
const mediaRevision = ref(0)

const mediaUrl = computed(() => {
  const v = selectedVideo.value
  if (!v) return ''
  if (v.objectUrl) return v.objectUrl
  if (v.path && getDesktopApi()) return getDesktopApi()!.toMediaUrl(v.path)
  return ''
})

async function prepareDesktopPreview(filePath: string) {
  loadError.value = false
  loadErrorReason.value = ''
  const api = getDesktopApi()
  if (!api?.checkMediaPreview) {
    mediaRevision.value += 1
    return
  }
  const check = await api.checkMediaPreview(filePath)
  if (!check.ok) {
    loadError.value = true
    loadErrorReason.value = check.reason ?? '预览加载失败'
    return
  }
  mediaRevision.value += 1
}

watch(
  () => selectedVideo.value?.id,
  () => {
    loadError.value = false
    loadErrorReason.value = ''
  },
)

watch(
  () => {
    const v = selectedVideo.value
    return v ? `${v.id}|${v.path}|${v.objectUrl ?? ''}` : ''
  },
  async () => {
    const v = selectedVideo.value
    if (!v) return
    if (v.objectUrl) {
      loadError.value = false
      loadErrorReason.value = ''
      mediaRevision.value += 1
      return
    }
    if (v.path) await prepareDesktopPreview(v.path)
  },
  { immediate: true },
)

watch(mediaUrl, (url) => {
  const el = videoRef.value
  if (el && url && !loadError.value) el.load()
})

const contentRect = ref({ x: 0, y: 0, w: 0, h: 0 })

function measure() {
  const stage = stageRef.value
  const video = videoRef.value
  if (!stage || !video || !video.videoWidth) return
  const r = stage.getBoundingClientRect()
  contentRect.value = videoContainRect(r.width, r.height, video.videoWidth, video.videoHeight)
}

const cropDisplay = ref<NormRect>({ x: 0, y: 0, w: 100, h: 100 })

function syncCropFromStore() {
  if (fxCropRectNorm.value) {
    cropDisplay.value = normToDisplayRect(fxCropRectNorm.value, contentRect.value)
  } else {
    cropDisplay.value = rectFromAspect(contentRect.value, fxCropRatio.value)
    fxCropRectNorm.value = displayRectToNorm(cropDisplay.value, contentRect.value)
  }
}

watch(
  () => fxCropRatio.value,
  () => {
    if (props.mode === 'crop') {
      cropDisplay.value = rectFromAspect(contentRect.value, fxCropRatio.value)
      fxCropRectNorm.value = displayRectToNorm(cropDisplay.value, contentRect.value)
    }
  },
)

watch(
  () => props.mode,
  (m) => {
    if (m === 'crop') {
      measure()
      syncCropFromStore()
    }
  },
)

const cropLabel = computed(() => {
  const video = videoRef.value
  if (!video?.videoWidth) return ''
  const n = displayRectToNorm(cropDisplay.value, contentRect.value)
  const pw = Math.round(n.w * video.videoWidth)
  const ph = Math.round(n.h * video.videoHeight)
  const px = Math.round(n.x * video.videoWidth)
  const py = Math.round(n.y * video.videoHeight)
  return `${pw} × ${ph} · X${px}, Y${py}`
})

function textDisplayFor(id: string) {
  const item = fxTextOverlays.value.find((o) => o.id === id)
  if (!item) return { x: 0, y: 0, w: 0, h: 0 }
  return normToDisplayRect(item.norm, contentRect.value)
}

type DragKind = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'text-move'
const drag = ref<{
  kind: DragKind
  textId?: string
  startX: number
  startY: number
  orig: NormRect
} | null>(null)

function onTextPointerDown(e: PointerEvent, id: string) {
  if (props.mode !== 'text') return
  fxActiveTextId.value = id
  store.syncLegacyTextFieldsFromOverlays()
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  drag.value = {
    kind: 'text-move',
    textId: id,
    startX: e.clientX,
    startY: e.clientY,
    orig: { ...textDisplayFor(id) },
  }
}

function onPointerDown(e: PointerEvent, kind: DragKind) {
  if (props.mode !== 'crop') return
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  drag.value = {
    kind,
    startX: e.clientX,
    startY: e.clientY,
    orig: { ...cropDisplay.value },
  }
}

function onPointerMove(e: PointerEvent) {
  if (!drag.value) return
  const dx = e.clientX - drag.value.startX
  const dy = e.clientY - drag.value.startY
  const c = contentRect.value
  const o = drag.value.orig

  if (drag.value.kind === 'text-move' && drag.value.textId) {
    let x = o.x + dx
    let y = o.y + dy
    x = Math.max(0, Math.min(c.w - o.w, x))
    y = Math.max(0, Math.min(c.h - o.h, y))
    store.updateFxTextOverlayNorm(
      drag.value.textId,
      displayRectToNorm({ x, y, w: o.w, h: o.h }, c),
    )
    return
  }

  let { x, y, w, h } = { ...o }
  const min = 24
  if (drag.value.kind === 'move') {
    x = o.x + dx
    y = o.y + dy
  } else if (drag.value.kind === 'se') {
    w = o.w + dx
    h = o.h + dy
  } else if (drag.value.kind === 'sw') {
    x = o.x + dx
    w = o.w - dx
    h = o.h + dy
  } else if (drag.value.kind === 'ne') {
    y = o.y + dy
    w = o.w + dx
    h = o.h - dy
  } else if (drag.value.kind === 'nw') {
    x = o.x + dx
    y = o.y + dy
    w = o.w - dx
    h = o.h - dy
  }
  w = Math.max(min, w)
  h = Math.max(min, h)
  x = Math.max(0, Math.min(c.w - w, x))
  y = Math.max(0, Math.min(c.h - h, y))
  if (x + w > c.w) w = c.w - x
  if (y + h > c.h) h = c.h - y
  cropDisplay.value = { x, y, w, h }
  fxCropRectNorm.value = displayRectToNorm(cropDisplay.value, c)
}

function onPointerUp(e: PointerEvent) {
  if (drag.value) {
    ;(e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId)
  }
  drag.value = null
}

function onVideoMeta() {
  measure()
  if (props.mode === 'crop') syncCropFromStore()
}

let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver(() => measure())
  if (stageRef.value) ro.observe(stageRef.value)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})
onUnmounted(() => {
  ro?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

function onTextInput(id: string) {
  fxActiveTextId.value = id
  store.syncLegacyTextFieldsFromOverlays()
}

function onTextPositionChange(id: string, ev: Event) {
  const v = (ev.target as HTMLSelectElement).value as
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
  store.setFxTextOverlayPosition(id, v)
}

function labelForText(text: string) {
  return text.trim() ? text : '输入文字…'
}
</script>

<template>
  <div class="fx-player">
    <header class="fx-player__head">
      <div class="fx-player__guide">
        <span class="fx-player__guide-label">使用指引</span>
        <span class="fx-player__guide-name" :title="selectedVideo?.name">{{
          selectedVideo?.name ?? '—'
        }}</span>
      </div>
      <div class="fx-player__head-actions">
        <button
          v-if="mode === 'crop'"
          type="button"
          class="fx-player__pill fx-player__pill--on"
          @click="emit('closeCrop')"
        >
          ✂ 关闭裁剪
        </button>
        <button
          v-else
          type="button"
          class="fx-player__pill"
          @click="emit('startCrop')"
        >
          ✂ 视频裁剪
        </button>
        <button
          v-if="mode === 'text'"
          type="button"
          class="fx-player__pill fx-player__pill--on"
          @click="emit('closeText')"
        >
          T 关闭文本
        </button>
        <button
          v-else
          type="button"
          class="fx-player__pill"
          @click="emit('addText')"
        >
          T 添加文本
        </button>
        <button
          v-if="mode === 'text'"
          type="button"
          class="fx-player__pill fx-player__pill--ghost"
          @click="emit('addText')"
        >
          + 一条
        </button>
      </div>
    </header>

    <div v-if="mode === 'crop'" class="fx-player__ratio">
      <span>裁剪比例</span>
      <button
        type="button"
        class="fx-player__ratio-btn"
        :class="{ 'fx-player__ratio-btn--on': cropRatio === '9:16' }"
        @click="emit('setCropRatio', '9:16')"
      >
        9:16
      </button>
      <button
        type="button"
        class="fx-player__ratio-btn"
        :class="{ 'fx-player__ratio-btn--on': cropRatio === '1:1' }"
        @click="emit('setCropRatio', '1:1')"
      >
        1:1
      </button>
      <button
        type="button"
        class="fx-player__ratio-btn"
        :class="{ 'fx-player__ratio-btn--on': cropRatio === '16:9' }"
        @click="emit('setCropRatio', '16:9')"
      >
        16:9
      </button>
    </div>

    <div v-if="mode === 'text'" class="fx-player__text-list">
      <div
        v-for="(item, idx) in fxTextOverlays"
        :key="item.id"
        class="fx-player__text-row"
        :class="{ 'fx-player__text-row--active': fxActiveTextId === item.id }"
        @click="fxActiveTextId = item.id"
      >
        <span class="fx-player__text-idx">{{ idx + 1 }}</span>
        <input
          v-model="item.text"
          class="fx-input"
          placeholder="输入文字…"
          @focus="onTextInput(item.id)"
          @input="onTextInput(item.id)"
        />
        <select
          class="fx-select"
          :value="item.position"
          @change="onTextPositionChange(item.id, $event)"
        >
          <option value="top-left">左上</option>
          <option value="top-right">右上</option>
          <option value="bottom-left">左下</option>
          <option value="bottom-right">右下</option>
        </select>
        <button
          v-if="fxTextOverlays.length > 1"
          type="button"
          class="fx-player__text-del"
          title="删除本条"
          @click.stop="store.removeFxTextOverlay(item.id)"
        >
          ×
        </button>
      </div>
      <button type="button" class="fx-player__text-more" @click="emit('addText')">
        + 再添加一条文本
      </button>
    </div>

    <div ref="stageRef" class="fx-player__stage">
      <template v-if="mediaUrl && !loadError">
        <video
          ref="videoRef"
          :key="`${mediaUrl}#${mediaRevision}`"
          class="fx-player__video"
          :src="mediaUrl"
          controls
          playsinline
          preload="metadata"
          @loadedmetadata="onVideoMeta"
          @error="
            () => {
              loadError = true
              if (!loadErrorReason) loadErrorReason = '解码或网络读取失败，请重试或重新导入'
            }
          "
        />
        <div
          class="fx-player__overlay"
          :style="{
            left: `${contentRect.x}px`,
            top: `${contentRect.y}px`,
            width: `${contentRect.w}px`,
            height: `${contentRect.h}px`,
          }"
        >
          <template v-if="mode === 'crop'">
            <div
              class="fx-crop-box"
              :style="{
                left: `${cropDisplay.x}px`,
                top: `${cropDisplay.y}px`,
                width: `${cropDisplay.w}px`,
                height: `${cropDisplay.h}px`,
              }"
              @pointerdown="onPointerDown($event, 'move')"
            >
              <span class="fx-crop-box__label">{{ cropLabel }}</span>
              <span
                class="fx-crop-box__handle fx-crop-box__handle--nw"
                @pointerdown.stop="onPointerDown($event, 'nw')"
              />
              <span
                class="fx-crop-box__handle fx-crop-box__handle--ne"
                @pointerdown.stop="onPointerDown($event, 'ne')"
              />
              <span
                class="fx-crop-box__handle fx-crop-box__handle--sw"
                @pointerdown.stop="onPointerDown($event, 'sw')"
              />
              <span
                class="fx-crop-box__handle fx-crop-box__handle--se"
                @pointerdown.stop="onPointerDown($event, 'se')"
              />
            </div>
          </template>

          <template v-if="mode === 'text'">
            <div
              v-for="item in fxTextOverlays"
              :key="item.id"
              class="fx-text-box"
              :class="{ 'fx-text-box--active': fxActiveTextId === item.id }"
              :style="{
                left: `${textDisplayFor(item.id).x}px`,
                top: `${textDisplayFor(item.id).y}px`,
                width: `${textDisplayFor(item.id).w}px`,
                minHeight: `${textDisplayFor(item.id).h}px`,
              }"
              @pointerdown="onTextPointerDown($event, item.id)"
            >
              {{ labelForText(item.text) }}
            </div>
          </template>
        </div>
      </template>
      <div v-else class="fx-player__empty">
        <p v-if="loadError">
          {{ loadErrorReason || '预览加载失败，请点左侧素材重试或重新导入' }}
        </p>
        <p v-else>{{ selectedVideo?.name ?? '选择素材后在此预览' }}</p>
      </div>
    </div>
  </div>
</template>
