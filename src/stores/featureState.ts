import { defineStore } from 'pinia'
import { ref } from 'vue'
import { smartFxModuleEnabled } from '../features/video-effects/effectModules'
import { qianchuanPresetPatch } from '../features/video-effects/fxQianchuanPreset'
import {
  createFxTextOverlay,
  normFromWatermarkPosition,
  type FxTextOverlayItem,
} from '../features/video-effects/fxTextOverlay'

export const subtitlePresets = [
  { id: '1', textColor: '#ffffff', strokeColor: '#000000' },
  { id: '2', textColor: '#ffff00', strokeColor: '#000000' },
  { id: '3', textColor: '#ff4444', strokeColor: '#ffffff' },
  { id: '4', textColor: '#44ff88', strokeColor: '#003322' },
  { id: '5', textColor: '#ffffff', strokeColor: '#ff0000' },
  { id: '6', textColor: '#00ffff', strokeColor: '#000088' },
  { id: '7', textColor: '#ffaa00', strokeColor: '#442200' },
  { id: '8', textColor: '#e0e0e0', strokeColor: '#333333' },
  { id: '9', textColor: '#ffc0cb', strokeColor: '#880044' },
]

export const useFeatureStateStore = defineStore('featureState', () => {
  const scriptText = ref('')
  const scriptAudioPath = ref('')
  const exportPath = ref('')
  const batchCount = ref(10)
  const fxWorkerThreads = ref(3)

  const settingsTab = ref<'basic' | 'frame' | 'effect' | 'output'>('basic')

  const originalVolume = ref(100)
  const bgmEnabled = ref(false)
  const bgmPath = ref('')
  const bgmVolume = ref(30)
  const ttsEnabled = ref(true)
  const ttsVoice = ref('小何 2.0')
  const ttsDialect = ref('普通话')
  const ttsVolume = ref(200)
  const ttsRate = ref(1.0)

  const fontFamily = ref('Noto Sans SC')
  const fontSize = ref(30)
  const fontWeight = ref(900)
  const strokeWidth = ref(2)
  const fontOpacity = ref(100)
  const presetId = ref('1')

  const outputPreset = ref<'9:16' | '16:9' | '1:1' | 'original'>('9:16')
  const outputWidth = ref(1080)
  const outputHeight = ref(1920)
  const outputFps = ref(30)
  const outputBrightness = ref(100)
  const removeBlackBar = ref(true)
  const autoAspect = ref(false)

  const fissionCount = ref(1)
  const removeWatermark = ref(false)
  const watermarkRemoveMode = ref<'delogo' | 'inpaint'>('delogo')
  const eraseRemoveMode = ref<'delogo' | 'inpaint'>('inpaint')
  const addTextWatermark = ref(false)
  const watermarkText = ref('ECutAuto')
  const aiSplitEnabled = ref(true)
  const splitIntervalSec = ref(30)
  const fxSplitMaxSec = ref(0)
  const fxMergeShortSegments = ref(false)
  const fxAiSceneSensitivity = ref(50)
  const fxImportSort = ref<'name' | 'time' | 'size'>('name')
  const fxImportDedupe = ref(true)
  const fxFillMode = ref<'crop' | 'scale' | 'blur'>('blur')
  const fxPipWidthPct = ref(30)
  const fxBrightness = ref(0)
  const fxNamingMode = ref<'effect_suffix' | 'fission_idx' | 'prefix_idx' | 'timestamp'>(
    'effect_suffix',
  )
  const bgmFadeInSec = ref(0)
  const bgmFadeOutSec = ref(0)
  /** 导出时清除元数据，利于投放平台重新识别为新片 */
  const fxStripMetadata = ref(false)
  const fxWorkflowPreset = ref<'none' | 'qianchuan'>('none')
  const fxFissionProfile = ref<'default' | 'qianchuan'>('default')
  const mirrorRandom = ref(true)
  const speedJitter = ref(false)
  const fxDelogoLeft = ref(0)
  const fxDelogoWidth = ref(100)
  const fxAddImageWatermark = ref(false)
  const fxImageWatermarkPath = ref('')
  const fxAddVideoWatermark = ref(false)
  const fxVideoWatermarkPath = ref('')
  const fxWatermarkPosition = ref<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>(
    'top-right',
  )
  const fxSaturation = ref(100)
  const fxSaturationJitter = ref(true)
  const fxContrast = ref(100)
  const fxNoiseAmount = ref(0)
  const fxBrightnessJitter = ref(false)
  const fxCrf = ref(23)
  const fxUiTab = ref<'effects' | 'sticker'>('effects')
  const fxActiveModule = ref<string | null>(null)
  const fxSplitMode = ref<'none' | 'ai' | 'interval'>('none')
  const fxTrimIntroSec = ref(0)
  const fxTrimOutroSec = ref(0)
  const fxFilterMinSegmentSec = ref(1)
  const fxExportByFolder = ref(true)
  const fxConfigMode = ref<'manual' | 'smart'>('smart')
  const fxModuleEnabled = ref(smartFxModuleEnabled())
  const fxCropEnabled = ref(false)
  const fxCropRatio = ref<'9:16' | '16:9' | '1:1'>('9:16')
  /** 相对原视频 0~1 的裁剪框 */
  const fxCropRectNorm = ref<{ x: number; y: number; w: number; h: number } | null>(null)
  /** 文字块相对原视频区域 0~1（首条文本，兼容旧字段） */
  const fxTextOverlayNorm = ref({ x: 0.06, y: 0.72, w: 0.42, h: 0.12 })
  const fxTextOverlays = ref<FxTextOverlayItem[]>([])
  const fxActiveTextId = ref<string | null>(null)

  function syncLegacyTextFieldsFromOverlays() {
    const list = fxTextOverlays.value
    if (!list.length) return
    const active =
      list.find((o) => o.id === fxActiveTextId.value) ?? list[0]!
    watermarkText.value = active.text
    fxWatermarkPosition.value = active.position
    fxTextOverlayNorm.value = { ...active.norm }
  }

  function addFxTextOverlay() {
    const item = createFxTextOverlay(fxTextOverlays.value.length)
    fxTextOverlays.value = [...fxTextOverlays.value, item]
    fxActiveTextId.value = item.id
    addTextWatermark.value = true
    syncLegacyTextFieldsFromOverlays()
    return item
  }

  function removeFxTextOverlay(id: string) {
    const next = fxTextOverlays.value.filter((o) => o.id !== id)
    fxTextOverlays.value = next
    if (fxActiveTextId.value === id) {
      fxActiveTextId.value = next[0]?.id ?? null
    }
    if (!next.length) addTextWatermark.value = false
    else syncLegacyTextFieldsFromOverlays()
  }

  function setFxTextOverlayPosition(id: string, position: FxTextOverlayItem['position']) {
    const idx = fxTextOverlays.value.findIndex((o) => o.id === id)
    if (idx < 0) return
    const item = fxTextOverlays.value[idx]!
    item.position = position
    item.norm = normFromWatermarkPosition(position, idx)
    fxTextOverlays.value = [...fxTextOverlays.value]
    if (fxActiveTextId.value === id) syncLegacyTextFieldsFromOverlays()
  }

  function updateFxTextOverlayNorm(
    id: string,
    norm: { x: number; y: number; w: number; h: number },
  ) {
    const idx = fxTextOverlays.value.findIndex((o) => o.id === id)
    if (idx < 0) return
    const item = fxTextOverlays.value[idx]!
    item.norm = { ...norm }
    fxTextOverlays.value = [...fxTextOverlays.value]
    if (fxActiveTextId.value === id) fxTextOverlayNorm.value = { ...norm }
  }
  const fxIntroFadeSec = ref(0.6)
  const fxAudioLoudnorm = ref(true)
  const fxSpeedRate = ref(100)
  const fxCoverAtSec = ref(0)
  const fxDynamicBgBlur = ref(18)
  const fxOutResolution = ref('1080x1920')
  const fxOutFps = ref<string>('30')
  const fxOutFormat = ref('mp4')
  const fxKeepOriginalFile = ref(true)
  const fxEnforceRights = ref(false)
  const fxRotateDeg = ref(0)

  function applyFxSmartConfig() {
    fxWorkflowPreset.value = 'none'
    fxFissionProfile.value = 'default'
    fxConfigMode.value = 'smart'
    fxModuleEnabled.value = smartFxModuleEnabled()
    fissionCount.value = 3
    mirrorRandom.value = true
    speedJitter.value = true
    fxSaturationJitter.value = true
    fxSaturation.value = 102
    fxContrast.value = 100
    fxNoiseAmount.value = 2
    fxIntroFadeSec.value = 0.6
    fxSpeedRate.value = 100
    keepOriginalAudio.value = true
    originalVolume.value = 100
    removeWatermark.value = false
    addTextWatermark.value = false
    fxTextOverlays.value = []
    fxActiveTextId.value = null
    fxCropEnabled.value = false
  }

  function applyFxManualConfig() {
    fxConfigMode.value = 'manual'
    fxWorkflowPreset.value = 'none'
    fxFissionProfile.value = 'default'
  }

  /** 千川：一条素材 → 多版本差异化 MP4，便于上传过审 */
  function applyQianchuanFissionPreset() {
    const p = qianchuanPresetPatch()
    fxWorkflowPreset.value = 'qianchuan'
    fxFissionProfile.value = 'qianchuan'
    fxConfigMode.value = p.fxConfigMode
    fxModuleEnabled.value = p.fxModuleEnabled
    fissionCount.value = p.fissionCount
    speedJitter.value = p.speedJitter
    mirrorRandom.value = p.mirrorRandom
    fxBrightnessJitter.value = p.fxBrightnessJitter
    fxSaturationJitter.value = p.fxSaturationJitter
    fxNoiseAmount.value = p.fxNoiseAmount
    fxSpeedRate.value = p.fxSpeedRate
    fxSaturation.value = p.fxSaturation
    fxContrast.value = p.fxContrast
    fxBrightness.value = p.fxBrightness
    fxIntroFadeSec.value = p.fxIntroFadeSec
    fxAudioLoudnorm.value = p.fxAudioLoudnorm ?? true
    fxCoverAtSec.value = p.fxCoverAtSec
    fxOutResolution.value = p.fxOutResolution
    fxOutFps.value = p.fxOutFps
    fxOutFormat.value = p.fxOutFormat
    fxCrf.value = p.fxCrf
    fxNamingMode.value = p.fxNamingMode
    fxExportByFolder.value = p.fxExportByFolder
    fxSplitMode.value = p.fxSplitMode
    splitIntervalSec.value = p.splitIntervalSec
    fxTrimIntroSec.value = p.fxTrimIntroSec
    fxTrimOutroSec.value = p.fxTrimOutroSec
    removeBlackBar.value = p.removeBlackBar
    fxStripMetadata.value = p.fxStripMetadata
    keepOriginalAudio.value = p.keepOriginalAudio
    originalVolume.value = p.originalVolume
    bgmEnabled.value = p.bgmEnabled
    removeWatermark.value = p.removeWatermark
    addTextWatermark.value = p.addTextWatermark
    fxCropEnabled.value = p.fxCropEnabled
    fxTextOverlays.value = []
    fxActiveTextId.value = null
  }

  function applyModuleSideEffects(id: string, on: boolean) {
    if (!on) return
    if (id === 'scrub' || id === 'remove-wm') removeWatermark.value = true
    if (id === 'text-wm') {
      addTextWatermark.value = true
      if (!fxTextOverlays.value.length) addFxTextOverlay()
    }
    if (id === 'pip') fxAddVideoWatermark.value = true
    if (id === 'image-wm') fxAddImageWatermark.value = true
    if (id === 'audio') keepOriginalAudio.value = true
    if (id === 'intro' && fxIntroFadeSec.value <= 0) fxIntroFadeSec.value = 0.6
    if (id === 'speed' && fxSpeedRate.value === 100) fxSpeedRate.value = 110
    if (id === 'pixel' && fxNoiseAmount.value <= 0) fxNoiseAmount.value = 4
    if (id === 'picture' && fxSaturation.value === 100 && fxContrast.value === 100) {
      fxSaturation.value = 112
    }
    if (id === 'mirror') removeBlackBar.value = true
  }

  function setFxModuleEnabled(id: string, on: boolean) {
    fxModuleEnabled.value = { ...fxModuleEnabled.value, [id]: on }
    applyModuleSideEffects(id, on)
  }

  const clipMinSec = ref(2)
  const clipMaxSec = ref(5)
  const shuffleClips = ref(true)
  const keepOriginalAudio = ref(false)
  const mixClipsPerVideo = ref(8)
  const mixPreferFilenameMatch = ref(true)

  const categoryPickMode = ref<'random' | 'sequential'>('random')

  const rewritePrompt = ref('保持原意，换种说法，适合短视频口播，口语化。')
  const rewriteCopies = ref(3)
  const rewriteResults = ref<{ id: string; text: string }[]>([])

  const extractMode = ref<'manual' | 'ai'>('ai')
  const extractPrompt = ref('提取商品卖点、价格优惠与行动号召相关的高光片段。')
  const sliceMinSec = ref(5)
  const sliceMaxSec = ref(30)
  const slices = ref<{ id: string; title: string; start: string; end: string }[]>([])

  const dramaMode = ref<'plot' | 'highlight'>('highlight')
  const dramaLines = ref(3)
  const episodeOrder = ref<'asc' | 'shuffle'>('asc')

  const cropRatio = ref('9:16')
  const cropWidth = ref(1080)
  const cropHeight = ref(1920)

  const audioFormat = ref('mp3')
  const audioBitrate = ref(192)

  const eraseTop = ref(82)
  const eraseHeight = ref(14)
  const eraseBlur = ref(8)

  const md5Mirror = ref(true)
  const md5DropFrame = ref(true)
  const md5Brightness = ref(102)

  function resetRewriteResults() {
    rewriteResults.value = []
  }

  function appendRewriteResult(text: string) {
    rewriteResults.value.push({ id: crypto.randomUUID(), text })
  }

  function resetSlices() {
    slices.value = []
  }

  return {
    scriptText,
    scriptAudioPath,
    exportPath,
    batchCount,
    fxWorkerThreads,
    settingsTab,
    originalVolume,
    bgmEnabled,
    bgmPath,
    bgmVolume,
    ttsEnabled,
    ttsVoice,
    ttsDialect,
    ttsVolume,
    ttsRate,
    fontFamily,
    fontSize,
    fontWeight,
    strokeWidth,
    fontOpacity,
    presetId,
    outputPreset,
    outputWidth,
    outputHeight,
    outputFps,
    outputBrightness,
    removeBlackBar,
    autoAspect,
    fissionCount,
    removeWatermark,
    watermarkRemoveMode,
    eraseRemoveMode,
    addTextWatermark,
    watermarkText,
    aiSplitEnabled,
    splitIntervalSec,
    fxSplitMaxSec,
    fxMergeShortSegments,
    fxAiSceneSensitivity,
    fxImportSort,
    fxImportDedupe,
    fxFillMode,
    fxPipWidthPct,
    fxBrightness,
    fxNamingMode,
    bgmFadeInSec,
    bgmFadeOutSec,
    mirrorRandom,
    speedJitter,
    fxDelogoLeft,
    fxDelogoWidth,
    fxAddImageWatermark,
    fxImageWatermarkPath,
    fxAddVideoWatermark,
    fxVideoWatermarkPath,
    fxWatermarkPosition,
    fxSaturation,
    fxSaturationJitter,
    fxContrast,
    fxNoiseAmount,
    fxBrightnessJitter,
    fxCrf,
    fxUiTab,
    fxActiveModule,
    fxSplitMode,
    fxTrimIntroSec,
    fxTrimOutroSec,
    fxFilterMinSegmentSec,
    fxExportByFolder,
    fxConfigMode,
    fxModuleEnabled,
    fxCropEnabled,
    fxCropRatio,
    fxCropRectNorm,
    fxTextOverlayNorm,
    fxTextOverlays,
    fxActiveTextId,
    addFxTextOverlay,
    removeFxTextOverlay,
    setFxTextOverlayPosition,
    updateFxTextOverlayNorm,
    syncLegacyTextFieldsFromOverlays,
    fxIntroFadeSec,
    fxAudioLoudnorm,
    fxSpeedRate,
    fxCoverAtSec,
    fxDynamicBgBlur,
    applyFxSmartConfig,
    applyFxManualConfig,
    applyQianchuanFissionPreset,
    fxStripMetadata,
    fxWorkflowPreset,
    fxFissionProfile,
    setFxModuleEnabled,
    fxOutResolution,
    fxOutFps,
    fxOutFormat,
    fxKeepOriginalFile,
    fxEnforceRights,
    fxRotateDeg,
    clipMinSec,
    clipMaxSec,
    shuffleClips,
    keepOriginalAudio,
    mixClipsPerVideo,
    mixPreferFilenameMatch,
    categoryPickMode,
    rewritePrompt,
    rewriteCopies,
    rewriteResults,
    extractMode,
    extractPrompt,
    sliceMinSec,
    sliceMaxSec,
    slices,
    dramaMode,
    dramaLines,
    episodeOrder,
    cropRatio,
    cropWidth,
    cropHeight,
    audioFormat,
    audioBitrate,
    eraseTop,
    eraseHeight,
    eraseBlur,
    md5Mirror,
    md5DropFrame,
    md5Brightness,
    resetRewriteResults,
    appendRewriteResult,
    resetSlices,
  }
})
