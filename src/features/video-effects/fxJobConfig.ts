/**
 * 视频自动化处理任务配置（需求清单：input → split → video → audio → effect → variation → output）
 */
import { cloneForIpc } from '../../services/cloneForIpc'

/** build 时传入 featureState 的字段快照 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildVideoEffectsJobOptions(state: Record<string, any>): Record<string, unknown> {
  const crop = state.fxCropRectNorm as
    | { x: number; y: number; w: number; h: number }
    | null
    | undefined
  const overlays = (state.fxTextOverlays ?? []) as {
    text: string
    position: string
    norm: { x: number; y: number; w: number; h: number }
  }[]

  return cloneForIpc({
    input: {
      sortBy: state.fxImportSort,
      dedupe: state.fxImportDedupe,
    },
    split: {
      mode: state.fxSplitMode,
      intervalSec: state.fxSplitMode === 'interval' ? state.splitIntervalSec : 0,
      minSegmentSec: state.fxFilterMinSegmentSec,
      maxSegmentSec: state.fxSplitMaxSec,
      mergeShortSegments: state.fxMergeShortSegments,
      aiSceneSensitivity: state.fxAiSceneSensitivity,
      trimIntroSec: state.fxTrimIntroSec,
      trimOutroSec: state.fxTrimOutroSec,
    },
    video: {
      fillMode: state.fxFillMode,
      cropEnabled: state.fxCropEnabled,
      cropRatio: state.fxCropRatio,
      pipWidthPct: state.fxPipWidthPct,
      dynamicBgBlur: state.fxDynamicBgBlur,
      removeBlackBar: state.removeBlackBar,
    },
    audio: {
      keepOriginal: state.keepOriginalAudio,
      originalVolume: state.originalVolume,
      bgmEnabled: state.bgmEnabled,
      bgmPath: state.bgmPath,
      bgmVolume: state.bgmVolume,
      bgmFadeInSec: state.bgmFadeInSec,
      bgmFadeOutSec: state.bgmFadeOutSec,
    },
    variation: {
      fissionCount: state.fissionCount,
    },
    output: {
      resolution: state.fxOutResolution,
      fps: state.fxOutFps,
      format: state.fxOutFormat,
      crf: state.fxCrf,
      naming: state.fxNamingMode,
      exportByFolder: state.fxExportByFolder,
      workerThreads: state.fxWorkerThreads,
    },
    aiSplitEnabled: state.fxSplitMode === 'ai',
    splitIntervalSec: state.fxSplitMode === 'interval' ? state.splitIntervalSec : 0,
    fxFilterMinSegmentSec: state.fxFilterMinSegmentSec,
    fxSplitMaxSec: state.fxSplitMaxSec,
    fxMergeShortSegments: state.fxMergeShortSegments,
    fxAiSceneSensitivity: state.fxAiSceneSensitivity,
    fxFillMode: state.fxFillMode,
    fxPipWidthPct: state.fxPipWidthPct,
    fxNamingMode: state.fxNamingMode,
    fxTrimIntroSec: state.fxTrimIntroSec,
    fxTrimOutroSec: state.fxTrimOutroSec,
    fxModuleEnabled: state.fxModuleEnabled,
    fxCropEnabled: state.fxCropEnabled,
    fxCropRatio: state.fxCropRatio,
    fxCropRectNorm: crop
      ? { x: crop.x, y: crop.y, w: crop.w, h: crop.h }
      : null,
    fxOutResolution: state.fxOutResolution,
    fxOutFps: state.fxOutFps === 'original' ? 0 : Number(state.fxOutFps),
    fxOutFpsOriginal: state.fxOutFps === 'original',
    fxOutFormat: state.fxOutFormat,
    fxCrf: state.fxCrf,
    fxExportByFolder: state.fxExportByFolder,
    fissionCount: state.fissionCount,
    fxConfigMode: state.fxConfigMode,
    batchCount: state.fxWorkerThreads,
    fxIntroFadeSec: state.fxIntroFadeSec,
    fxSpeedRate: state.fxSpeedRate,
    fxCoverAtSec: state.fxCoverAtSec,
    fxDynamicBgBlur: state.fxDynamicBgBlur,
    fxRotateDeg: state.fxRotateDeg,
    removeWatermark: state.removeWatermark,
    watermarkRemoveMode: state.watermarkRemoveMode,
    fxDelogoLeft: state.fxDelogoLeft,
    fxDelogoWidth: state.fxDelogoWidth,
    eraseTop: state.eraseTop,
    eraseHeight: state.eraseHeight,
    fxAddImageWatermark: state.fxAddImageWatermark,
    fxImageWatermarkPath: state.fxImageWatermarkPath,
    fxAddVideoWatermark: state.fxAddVideoWatermark,
    fxVideoWatermarkPath: state.fxVideoWatermarkPath,
    fxWatermarkPosition: state.fxWatermarkPosition,
    fxSaturation: state.fxSaturation,
    fxSaturationJitter: state.fxSaturationJitter,
    fxContrast: state.fxContrast,
    fxBrightness: state.fxBrightness,
    fxNoiseAmount: state.fxNoiseAmount,
    fxBrightnessJitter: state.fxBrightnessJitter,
    mirrorRandom: state.mirrorRandom,
    speedJitter: state.speedJitter,
    bgmEnabled: state.bgmEnabled,
    bgmPath: state.bgmPath,
    bgmVolume: state.bgmVolume,
    bgmFadeInSec: state.bgmFadeInSec,
    bgmFadeOutSec: state.bgmFadeOutSec,
    keepOriginalAudio: state.keepOriginalAudio,
    originalVolume: state.originalVolume,
    removeBlackBar: state.removeBlackBar,
    addTextWatermark:
      state.addTextWatermark &&
      (overlays.length > 0 || Boolean(String(state.watermarkText ?? '').trim())),
    watermarkText: state.watermarkText,
    fxTextOverlays: overlays.map((o) => ({
      text: o.text,
      position: o.position,
      norm: { ...o.norm },
    })),
    fxTextOverlayNorm: { ...(state.fxTextOverlayNorm as object) },
    fxStripMetadata: state.fxStripMetadata,
    fxFissionProfile:
      state.fxWorkflowPreset === 'qianchuan' || state.fxFissionProfile === 'qianchuan'
        ? 'qianchuan'
        : 'default',
    /** 默认 false：不挡处理；true 时未登记授权会阻断 */
    fxEnforceRights: state.fxEnforceRights === true,
    fxAudioLoudnorm: state.fxAudioLoudnorm !== false,
  })
}

export function fxJobInputs(material: {
  looseVideos: { path: string }[]
  folders: { filePaths?: string[] }[]
}): string[] {
  const videoPaths = material.looseVideos.map((v) => v.path).filter(Boolean)
  const folderVideoPaths = material.folders.flatMap((f) => f.filePaths ?? [])
  return videoPaths.length ? videoPaths : folderVideoPaths
}
