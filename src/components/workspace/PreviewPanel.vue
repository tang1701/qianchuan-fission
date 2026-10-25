<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useMaterialStore } from '../../stores/material'
import { subtitlePresets, useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'

const props = withDefaults(
  defineProps<{
    mode?: 'folder' | 'video'
    overlay?: string
    hideSubtitle?: boolean
    compactToolbar?: boolean
    /** 裁剪参考框比例（仅画框，不改变播放器外框大小） */
    cropGuideRatio?: '9:16' | '1:1' | '16:9' | null
    /** 效果页文字水印预览 */
    textOverlay?: string | null
    textOverlayPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  }>(),
  {
    mode: 'folder',
    overlay: '',
    hideSubtitle: false,
    compactToolbar: false,
    cropGuideRatio: null,
    textOverlay: null,
    textOverlayPosition: 'top-left',
  },
)

const material = useMaterialStore()
const feature = useFeatureStateStore()
const { selectedFolder, selectedVideo, previewFilePath } = storeToRefs(material)
const { fontSize, fontWeight, strokeWidth, fontOpacity, presetId, scriptText } =
  storeToRefs(feature)

const loadError = ref(false)

const previewPath = computed(() => {
  if (props.mode === 'video') {
    const v = selectedVideo.value
    if (!v) return ''
    return v.path || v.objectUrl || ''
  }
  if (previewFilePath.value) return previewFilePath.value
  const folder = selectedFolder.value
  if (!folder?.filePaths?.length) return ''
  return folder.filePaths[0] ?? ''
})

const mediaUrl = computed(() => {
  const p = previewPath.value
  if (!p) return ''
  if (p.startsWith('blob:')) return p
  const api = getDesktopApi()
  if (api) return api.toMediaUrl(p)
  return ''
})

const label = computed(() => {
  if (props.mode === 'video') return selectedVideo.value?.name ?? ''
  return selectedFolder.value?.name ?? ''
})

const activePreset = computed(
  () => subtitlePresets.find((p) => p.id === presetId.value) ?? subtitlePresets[0],
)

const subtitleStyle = computed(() => ({
  color: activePreset.value.textColor,
  WebkitTextStroke: `${strokeWidth.value}px ${activePreset.value.strokeColor}`,
  fontSize: `${Math.min(fontSize.value * 0.35, 28)}px`,
  fontWeight: fontWeight.value,
  opacity: fontOpacity.value / 100,
}))

const previewSubtitle = computed(
  () => scriptText.value.trim().split(/[。！？\n]/)[0]?.slice(0, 40) || '预览字幕样式',
)

watch(mediaUrl, () => {
  loadError.value = false
})

const cropFrameAspect = computed(() => {
  const r = props.cropGuideRatio
  if (r === '9:16') return '9 / 16'
  if (r === '1:1') return '1 / 1'
  if (r === '16:9') return '16 / 9'
  return null
})
</script>

<template>
  <section class="panel preview-panel">
    <div v-if="!compactToolbar || previewPath" class="panel__toolbar">
      <span v-if="!compactToolbar" class="panel__toolbar-title">使用指引</span>
      <span v-if="previewPath" class="panel__toolbar-title preview-panel__path">{{ label }}</span>
    </div>
    <div class="preview-panel__stage">
      <template v-if="previewPath">
        <div
          class="preview-panel__mock-video preview-panel__mock-video--player"
          :class="{ 'preview-panel__mock-video--fx': compactToolbar }"
        >
          <video
            v-if="mediaUrl && !loadError"
            class="preview-panel__video"
            :src="mediaUrl"
            controls
            playsinline
            @error="loadError = true"
          />
          <div v-else class="preview-panel__fallback">
            <p>{{ label }}</p>
            <p class="settings-block__muted">
              {{
                getDesktopApi()
                  ? '无法解码该视频预览，导出仍可使用 FFmpeg 处理'
                  : '请使用 npm run dev:app 桌面版导入，以便导出到本地'
              }}
            </p>
          </div>
          <div
            v-if="cropFrameAspect"
            class="preview-crop-guide"
            aria-hidden="true"
          >
            <div
              class="preview-crop-guide__frame"
              :style="{ aspectRatio: cropFrameAspect }"
            />
            <span class="preview-crop-guide__label">裁剪区域 · {{ cropGuideRatio }}</span>
          </div>
          <p
            v-if="textOverlay"
            class="preview-text-overlay"
            :class="`preview-text-overlay--${textOverlayPosition}`"
          >
            {{ textOverlay }}
          </p>
          <p v-if="overlay" class="preview-panel__overlay">{{ overlay }}</p>
          <p
            v-if="!hideSubtitle"
            class="preview-panel__subtitle preview-panel__subtitle--live"
            :style="subtitleStyle"
          >
            {{ previewSubtitle }}
          </p>
        </div>
      </template>
      <div v-else class="empty-state">
        <div class="empty-state__icon empty-state__icon--video" aria-hidden="true" />
        <p class="empty-state__title">选择素材后在此预览</p>
      </div>
    </div>
  </section>
</template>
