<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import FxInteractivePreview from './FxInteractivePreview.vue'
import { useFeatureStateStore } from '../../stores/featureState'

const store = useFeatureStateStore()
const {
  fxCropEnabled,
  fxCropRatio,
  fxCropRectNorm,
  addTextWatermark,
} = storeToRefs(store)

const previewTool = ref<'none' | 'crop' | 'text'>('none')

function closeCrop() {
  previewTool.value = 'none'
  fxCropEnabled.value = false
}

function addTextLayer() {
  previewTool.value = 'text'
  store.setFxModuleEnabled('text-wm', true)
  addTextWatermark.value = true
  store.addFxTextOverlay()
}

function closeText() {
  previewTool.value = 'none'
}

function startCrop() {
  previewTool.value = 'crop'
  fxCropEnabled.value = true
  store.setFxModuleEnabled('bg', false)
}

function setCropRatio(r: '9:16' | '1:1' | '16:9') {
  fxCropRatio.value = r
  fxCropEnabled.value = true
  previewTool.value = 'crop'
  fxCropRectNorm.value = null
  store.setFxModuleEnabled('bg', false)
}
</script>

<template>
  <main class="fx-center">
    <header class="fx-pane-head">视频预览</header>
    <FxInteractivePreview
      :mode="previewTool"
      :crop-ratio="fxCropRatio"
      @close-crop="closeCrop"
      @add-text="addTextLayer"
      @close-text="closeText"
      @start-crop="startCrop"
      @set-crop-ratio="setCropRatio"
    />
  </main>
</template>
