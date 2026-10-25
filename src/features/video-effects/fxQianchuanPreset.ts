/**
 * 巨量千川：观感接近原片，但时间轴/像素/编码指纹已变（参考竞品 _裂变01~03）
 */
import { defaultFxModuleEnabled, type FxModuleId } from './effectModules'

export const QIANCHUAN_WORKFLOW_HINT =
  '导入素材 →「千川裂变过审」→ 导出目录 → 开始处理 → 上传各裂变 MP4（勿传原片）。'

export function buildQianchuanModuleFlags(): Record<FxModuleId, boolean> {
  const m = defaultFxModuleEnabled()
  m.fission = true
  m.cover = true
  m.intro = true
  return m
}

export function qianchuanPresetPatch() {
  return {
    fxConfigMode: 'smart' as const,
    fxWorkflowPreset: 'qianchuan' as const,
    fxFissionProfile: 'qianchuan' as const,
    fxModuleEnabled: buildQianchuanModuleFlags(),
    fissionCount: 3,
    speedJitter: false,
    mirrorRandom: false,
    fxBrightnessJitter: false,
    fxSaturationJitter: false,
    fxNoiseAmount: 0,
    fxSpeedRate: 100,
    fxSaturation: 100,
    fxContrast: 100,
    fxBrightness: 0,
    fxIntroFadeSec: 0.3,
    fxAudioLoudnorm: true,
    fxCoverAtSec: 0,
    fxOutResolution: 'original',
    fxOutFps: 'original',
    fxOutFormat: 'mp4',
    fxCrf: 17,
    fxNamingMode: 'fission_idx' as const,
    fxExportByFolder: true,
    fxSplitMode: 'none' as const,
    splitIntervalSec: 0,
    fxTrimIntroSec: 0,
    fxTrimOutroSec: 0,
    removeBlackBar: false,
    fxStripMetadata: true,
    keepOriginalAudio: true,
    originalVolume: 100,
    bgmEnabled: false,
    removeWatermark: false,
    addTextWatermark: false,
    fxCropEnabled: false,
  }
}
