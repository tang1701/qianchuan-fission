import { buildVideoEffectsJobOptions, fxJobInputs } from '../features/video-effects/fxJobConfig'
import { useMaterialStore } from '../stores/material'
import { subtitlePresets, useFeatureStateStore } from '../stores/featureState'
import { cloneForIpc } from './cloneForIpc'

export interface JobPayload {
  featureId: string
  inputs: string[]
  outputDir: string
  options: Record<string, unknown>
}

export function buildJobPayload(featureId: string): JobPayload {
  const material = useMaterialStore()
  const state = useFeatureStateStore()
  const preset =
    subtitlePresets.find((p) => p.id === state.presetId) ?? subtitlePresets[0]!

  const outputDir = state.exportPath.trim()

  if (featureId === 'video-effects') {
    return cloneForIpc({
      featureId,
      inputs: fxJobInputs(material),
      outputDir,
      options: buildVideoEffectsJobOptions(state as unknown as Record<string, unknown>),
    })
  }

  const options: Record<string, unknown> = {
    scriptText: state.scriptText,
    scriptAudioPath: state.scriptAudioPath,
    rewritePrompt: state.rewritePrompt,
    rewriteCopies: state.rewriteCopies,
    clipMinSec: state.clipMinSec,
    clipMaxSec: state.clipMaxSec,
    shuffleClips: state.shuffleClips,
    categoryPickMode: state.categoryPickMode,
    folderPaths: material.folders.map((f) => f.path).filter(Boolean),
    fissionCount: state.fissionCount,
    mirrorRandom: state.mirrorRandom,
    speedJitter: state.speedJitter,
    addTextWatermark:
      state.addTextWatermark &&
      (state.fxTextOverlays.length > 0 || Boolean(state.watermarkText.trim())),
    watermarkText: state.watermarkText,
    fxTextOverlays: state.fxTextOverlays.map((o) => ({
      text: o.text,
      position: o.position,
      norm: { ...o.norm },
    })),
    aiSplitEnabled: state.fxSplitMode === 'ai',
    splitIntervalSec: state.fxSplitMode === 'interval' ? state.splitIntervalSec : 0,
    fxOutResolution: state.fxOutResolution,
    fxOutFps: Number(state.fxOutFps),
    fxModuleEnabled: cloneForIpc(state.fxModuleEnabled),
    fxCropEnabled: state.fxCropEnabled,
    fxCropRatio: state.fxCropRatio,
    fxCropRectNorm: state.fxCropRectNorm
      ? {
          x: Number(state.fxCropRectNorm.x),
          y: Number(state.fxCropRectNorm.y),
          w: Number(state.fxCropRectNorm.w),
          h: Number(state.fxCropRectNorm.h),
        }
      : null,
    fxTextOverlayNorm: {
      x: Number(state.fxTextOverlayNorm.x),
      y: Number(state.fxTextOverlayNorm.y),
      w: Number(state.fxTextOverlayNorm.w),
      h: Number(state.fxTextOverlayNorm.h),
    },
    fxIntroFadeSec: state.fxIntroFadeSec,
    fxSpeedRate: state.fxSpeedRate,
    fxCoverAtSec: state.fxCoverAtSec,
    fxDynamicBgBlur: state.fxDynamicBgBlur,
    fxConfigMode: state.fxConfigMode,
    batchCount: featureId === 'video-effects' ? state.fxWorkerThreads : state.batchCount,
    fxTrimIntroSec: state.fxTrimIntroSec,
    fxTrimOutroSec: state.fxTrimOutroSec,
    fxFilterMinSegmentSec: state.fxFilterMinSegmentSec,
    fxExportByFolder: state.fxExportByFolder,
    fxRotateDeg: state.fxRotateDeg,
    removeWatermark: state.removeWatermark,
    watermarkRemoveMode: state.watermarkRemoveMode,
    eraseRemoveMode: state.eraseRemoveMode,
    fxDelogoLeft: state.fxDelogoLeft,
    fxDelogoWidth: state.fxDelogoWidth,
    fxAddImageWatermark: state.fxAddImageWatermark,
    fxImageWatermarkPath: state.fxImageWatermarkPath,
    fxAddVideoWatermark: state.fxAddVideoWatermark,
    fxVideoWatermarkPath: state.fxVideoWatermarkPath,
    fxWatermarkPosition: state.fxWatermarkPosition,
    fxSaturation: state.fxSaturation,
    fxSaturationJitter: state.fxSaturationJitter,
    fxContrast: state.fxContrast,
    fxNoiseAmount: state.fxNoiseAmount,
    fxBrightnessJitter: state.fxBrightnessJitter,
    fxCrf: state.fxCrf,
    sliceMinSec: state.sliceMinSec,
    sliceMaxSec: state.sliceMaxSec,
    dramaMode: state.dramaMode,
    dramaLines: state.dramaLines,
    episodeOrder: state.episodeOrder,
    cropWidth: state.cropWidth,
    cropHeight: state.cropHeight,
    audioFormat: state.audioFormat,
    audioBitrate: state.audioBitrate,
    eraseTop: state.eraseTop,
    eraseHeight: state.eraseHeight,
    eraseBlur: state.eraseBlur,
    md5Mirror: state.md5Mirror,
    md5DropFrame: state.md5DropFrame,
    md5Brightness: state.md5Brightness,
    bgmEnabled: state.bgmEnabled,
    bgmPath: state.bgmPath,
    bgmVolume: state.bgmVolume,
    ttsEnabled: state.ttsEnabled,
    ttsVoice: state.ttsVoice,
    ttsDialect: state.ttsDialect,
    ttsRate: state.ttsRate,
    ttsVolume: state.ttsVolume,
    originalVolume: state.originalVolume,
    matchMode: material.matchMode,
    fontFamily: state.fontFamily,
    fontSize: state.fontSize,
    fontWeight: state.fontWeight,
    strokeWidth: state.strokeWidth,
    fontOpacity: state.fontOpacity,
    textColor: preset.textColor,
    strokeColor: preset.strokeColor,
    outputPreset: state.outputPreset,
    outputWidth: state.outputWidth,
    outputHeight: state.outputHeight,
    outputFps: state.outputFps,
    outputBrightness: state.outputBrightness,
    removeBlackBar: state.removeBlackBar,
    autoAspect: state.autoAspect,
    keepOriginalAudio: state.keepOriginalAudio,
    clipsPerVideo: state.mixClipsPerVideo,
    mixPreferFilenameMatch: state.mixPreferFilenameMatch,
  }

  const videoPaths = material.looseVideos.map((v) => v.path).filter(Boolean)
  const folderVideoPaths = material.folders.flatMap((f) => f.filePaths ?? [])
  const inputs = videoPaths.length ? videoPaths : folderVideoPaths

  return cloneForIpc({
    featureId,
    inputs,
    outputDir,
    options,
  })
}
