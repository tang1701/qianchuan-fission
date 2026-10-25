import path from 'node:path'
import fs from 'node:fs/promises'
import { buildInpaintFilter } from '../ffmpeg/inpaintWatermark'
import { probeDuration, probeVideoStream, runFfmpeg } from '../ffmpeg/util'
import { assertOutputDoesNotReplaceSource } from '../quality/paths'
import {
  buildVariantPlan,
  qianchuanFissionParams,
  smartFissionParams,
  type FissionParams,
} from './fissionEngine'
import { mixBackgroundMusic } from '../ffmpeg/bgm'
import { normalizeFxJobOptions } from './fxModuleNormalize'

export type WatermarkPos = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface FxModuleFlags {
  audio: boolean
  cover: boolean
  intro: boolean
  scrub: boolean
  pip: boolean
  picture: boolean
  pixel: boolean
  mirror: boolean
  speed: boolean
  bg: boolean
  textWm: boolean
  imageWm: boolean
  removeWm: boolean
  fission: boolean
}

export interface VideoFxOpts {
  fission: number
  crf: number
  mirrorRandom: boolean
  speedJitter: boolean
  addTextWatermark: boolean
  watermarkText: string
  removeWatermark: boolean
  watermarkRemoveMode: 'delogo' | 'inpaint'
  eraseTop: number
  eraseHeight: number
  delogoLeft: number
  delogoWidth: number
  addImageWatermark: boolean
  imageWatermarkPath: string
  addVideoWatermark: boolean
  videoWatermarkPath: string
  watermarkPos: WatermarkPos
  saturation: number
  saturationJitter: boolean
  contrast: number
  noiseAmount: number
  brightnessJitter: boolean
  rotateDeg: number
  keepOriginalAudio: boolean
  originalVolume: number
  /** 导出前 loudnorm，投放常见约 -16 LUFS */
  audioLoudnorm: boolean
  introFadeSec: number
  speedRatePct: number
  cropEnabled: boolean
  cropRatio: string
  cropW: number
  cropH: number
  cropRectNorm: { x: number; y: number; w: number; h: number } | null
  textOverlayNorm: { x: number; y: number; w: number; h: number } | null
  textOverlays: {
    text: string
    position: WatermarkPos
    norm: { x: number; y: number; w: number; h: number } | null
  }[]
  dynamicBgBlur: number
  outW: number
  outH: number
  outFps: number
  coverAtSec: number
  trimIntro: number
  trimOutro: number
  modules: FxModuleFlags
  useFissionEngine: boolean
  fissionParams: FissionParams
  configMode: 'manual' | 'smart'
  bgmEnabled: boolean
  bgmPath: string
  bgmVolume: number
  removeBlackBar: boolean
  pipWidthPct: number
  brightness: number
  outFpsOriginal: boolean
  namingMode: string
  stripMetadata: boolean
  fissionProfile: string
}

function videoMuxArgs(opts: VideoFxOpts, encodeOut: string): string[] {
  const qianchuan = opts.fissionProfile === 'qianchuan'
  const highQ = qianchuan || opts.crf <= 20 || opts.configMode === 'manual'
  const preset = qianchuan ? 'slow' : highQ ? 'medium' : 'fast'
  const crf = qianchuan ? Math.min(opts.crf, 17) : opts.crf
  const args = [
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
  ]
  if (qianchuan) {
    args.push(
      '-x264-params',
      'ref=5:me=umh:subme=9:rc-lookahead=50:trellis=2:deblock=-1,-1',
    )
  }
  if (opts.stripMetadata) args.push('-map_metadata', '-1')
  args.push('-movflags', '+faststart', encodeOut)
  return args
}

/** 避免与源同尺寸时二次缩放，或把小分辨率强行放大到导出框 */
function shouldApplyOutputScale(
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
  opts: VideoFxOpts,
): boolean {
  if (!outW || !outH || !srcW || !srcH) return false
  if (opts.fissionProfile === 'qianchuan' && !opts.cropEnabled) return false
  const tol = 8
  if (Math.abs(srcW - outW) <= tol && Math.abs(srcH - outH) <= tol) return false
  if (srcW <= outW && srcH <= outH) return false
  return true
}

function outputScalePadFilter(outW: number, outH: number): string {
  return `scale=${outW}:${outH}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black`
}

export function parseModuleFlags(raw: unknown): FxModuleFlags {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, boolean>
  return {
    audio: Boolean(m.audio),
    cover: Boolean(m.cover),
    intro: Boolean(m.intro),
    scrub: Boolean(m.scrub),
    pip: Boolean(m.pip),
    picture: Boolean(m.picture),
    pixel: Boolean(m.pixel),
    mirror: Boolean(m.mirror),
    speed: Boolean(m.speed),
    bg: Boolean(m.bg),
    textWm: Boolean(m['text-wm']),
    imageWm: Boolean(m['image-wm']),
    removeWm: Boolean(m['remove-wm']),
    fission: m.fission !== false,
  }
}

function applyScrubDelogoToParams(
  p: FissionParams,
  modules: FxModuleFlags,
  options: Record<string, unknown>,
  width: number,
  height: number,
) {
  if (!(modules.scrub || modules.removeWm) || !options.removeWatermark) return
  p.delogo.enabled = true
  const y = Math.floor((height * Number(options.eraseTop ?? 82)) / 100)
  const h = Math.max(8, Math.floor((height * Number(options.eraseHeight ?? 14)) / 100))
  const x = Math.floor((width * Number(options.fxDelogoLeft ?? 0)) / 100)
  const w = Math.max(8, Math.floor((width * Number(options.fxDelogoWidth ?? 100)) / 100))
  p.delogo.regions = [{ x, y, w, h, refW: width, refH: height }]
}

/** 千川：用户打开的效果模块走 buildVFilters，裂变引擎不再重复做同类扰动 */
function deferQianchuanFissionWhenUserModules(modules: FxModuleFlags, p: FissionParams) {
  if (modules.speed) p.video.speed.enabled = false
  if (modules.mirror) {
    p.video.mirror.enabled = false
    p.video.rotate.enabled = false
  }
  if (modules.picture) {
    p.video.brightness.enabled = false
    p.video.contrast.enabled = false
    p.video.saturation.enabled = false
    p.video.hue.enabled = false
  }
  if (modules.pixel) {
    p.video.noise.enabled = false
    p.video.zoom.enabled = false
  }
}

/** smart 裂变下是否跳过手动差异化滤镜（千川在用户开模块时仍要生效） */
export function shouldSkipDifferentiation(opts: VideoFxOpts): boolean {
  if (!opts.useFissionEngine || opts.configMode !== 'smart') return false
  const f = opts.modules
  const userManual =
    f.mirror || f.picture || f.pixel || f.speed || f.scrub || f.removeWm
  if (opts.fissionProfile === 'qianchuan') return !userManual
  return true
}

function resToFissionLabel(w: number, h: number): string {
  if (w === 2560 && h === 1440) return '2560x1440'
  if (w === 1920 && h === 1080) return '1920x1080'
  if (w === 1280 && h === 720) return '1280x720'
  if (w === 1080 && h === 1920) return '1080x1920'
  if (w === 720 && h === 1280) return '720x1280'
  return 'original'
}

function buildFissionParamsFromOptions(
  options: Record<string, unknown>,
  modules: FxModuleFlags,
  outW: number,
  outH: number,
  width: number,
  height: number,
): FissionParams {
  const profile = String(options.fxFissionProfile ?? '')
  const smart = options.fxConfigMode === 'smart'
  const p =
    profile === 'qianchuan' ? qianchuanFissionParams() : smartFissionParams()
  if (profile === 'qianchuan') {
    p.seed = String(options.fxSeed ?? '')
    const shortSide = Math.min(width, height)
    if (shortSide <= 720 || width < 1080) {
      p.video.cropEdge.enabled = false
    }
    deferQianchuanFissionWhenUserModules(modules, p)
    applyScrubDelogoToParams(p, modules, options, width, height)
    if (modules.audio) {
      p.audio.volume.enabled = true
      const vol = Number(options.originalVolume ?? 100) / 100
      p.audio.volume.min = vol
      p.audio.volume.max = vol
    }
    return p
  }
  if (!smart) {
    for (const key of Object.keys(p.video) as (keyof FissionParams['video'])[]) {
      const v = p.video[key]
      if (v && typeof v === 'object' && 'enabled' in v) (v as { enabled: boolean }).enabled = false
    }
    p.audio.pitch.enabled = false
    p.audio.volume.enabled = false
    p.video.mirror.enabled = modules.mirror
    p.video.mirror.probability = options.mirrorRandom ? 50 : 100
    // 手动配置：变速由 buildVFilters + speedMult 处理，避免与裂变 plan 重复
    p.video.speed.enabled = false
    p.video.brightness.enabled = modules.picture
    p.video.contrast.enabled = modules.picture
    p.video.saturation.enabled = modules.picture
    p.video.hue.enabled = modules.picture
    p.video.noise.enabled = modules.pixel
    p.video.zoom.enabled = modules.pixel
    p.video.cropEdge.enabled = modules.mirror
    p.video.rotate.enabled = modules.mirror
    p.video.fps.enabled = false
  }
  p.seed = String(options.fxSeed ?? '')
  const ratio = String(options.fxCropRatio ?? '9:16')
  if (smart) {
    p.video.resolution = options.fxCropEnabled
      ? resToFissionLabel(
          ratio === '9:16' ? 1080 : ratio === '1:1' ? 1080 : 1920,
          ratio === '9:16' ? 1920 : ratio === '1:1' ? 1080 : 1080,
        )
      : resToFissionLabel(outW, outH)
  } else {
    p.video.resolution = options.fxCropEnabled
      ? resToFissionLabel(
          ratio === '9:16' ? 1080 : ratio === '1:1' ? 1080 : 1920,
          ratio === '9:16' ? 1920 : ratio === '1:1' ? 1080 : 1080,
        )
      : 'original'
  }
  applyScrubDelogoToParams(p, modules, options, width, height)
  if (modules.audio) {
    p.audio.volume.enabled = true
    const vol = Number(options.originalVolume ?? 100) / 100
    p.audio.volume.min = vol
    p.audio.volume.max = vol
  }
  return p
}

function resToSize(label: string): { w: number; h: number } {
  if (label === 'original' || label === 'ORIGINAL' || label === '原分辨率') return { w: 0, h: 0 }
  if (label === '720P') return { w: 1280, h: 720 }
  if (label === '2K') return { w: 2560, h: 1440 }
  if (label === '1080x1920') return { w: 1080, h: 1920 }
  if (label === '720x1280') return { w: 720, h: 1280 }
  return { w: 1920, h: 1080 }
}

export function parseVideoFxOpts(options: Record<string, unknown>): VideoFxOpts {
  const modules = parseModuleFlags(options.fxModuleEnabled)
  normalizeFxJobOptions(options, {
    ...modules,
    scrub: modules.scrub,
    'remove-wm': modules.removeWm,
    'text-wm': modules.textWm,
    'image-wm': modules.imageWm,
  })
  if (modules.scrub && options.fxFillMode === 'blur') modules.bg = true
  const res = resToSize(String(options.fxOutResolution ?? '1080x1920'))
  let cropW = res.w
  let cropH = res.h
  const ratio = String(options.fxCropRatio ?? '9:16')
  const cropEnabled = Boolean(options.fxCropEnabled)
  const cropRectNorm =
    options.fxCropRectNorm && typeof options.fxCropRectNorm === 'object'
      ? (options.fxCropRectNorm as VideoFxOpts['cropRectNorm'])
      : null

  if (cropEnabled) {
    if (ratio === '9:16') {
      cropW = 1080
      cropH = 1920
    } else if (ratio === '1:1') {
      cropW = 1080
      cropH = 1080
    } else if (ratio === '16:9') {
      cropW = 1920
      cropH = 1080
    }
  }

  /** 用户手动框选裁剪：导出与预览一致，勿加底纹/裂变随机裁边 */
  const wysiwygCrop = cropEnabled && cropRectNorm != null
  if (wysiwygCrop) {
    modules.bg = false
  }

  const outW = cropEnabled ? cropW : res.w
  const outH = cropEnabled ? cropH : res.h
  const outFpsOriginal = Boolean(options.fxOutFpsOriginal)
  let outFps = Number(options.fxOutFps ?? 30)
  if (outFpsOriginal || outFps <= 0) outFps = 30

  const useFissionEngine =
    !wysiwygCrop &&
    (options.fxFissionProfile === 'qianchuan' ||
      options.fxConfigMode === 'smart' ||
      (modules.fission && Number(options.fissionCount ?? 1) > 1))

  const fission = wysiwygCrop
    ? 1
    : modules.fission
      ? Math.max(1, Number(options.fissionCount ?? 3))
      : 1

  return {
    fission,
    crf: Math.min(28, Math.max(18, Number(options.fxCrf ?? 23))),
    mirrorRandom: Boolean(options.mirrorRandom ?? true),
    speedJitter: Boolean(options.speedJitter ?? false),
    addTextWatermark: Boolean(options.addTextWatermark ?? false),
    watermarkText: String(options.watermarkText ?? 'ECutAuto'),
    removeWatermark: Boolean(options.removeWatermark ?? false),
    watermarkRemoveMode:
      options.watermarkRemoveMode === 'inpaint' ? 'inpaint' : 'delogo',
    eraseTop: Number(options.eraseTop ?? 82),
    eraseHeight: Number(options.eraseHeight ?? 14),
    delogoLeft: Number(options.fxDelogoLeft ?? 0),
    delogoWidth: Number(options.fxDelogoWidth ?? 100),
    addImageWatermark: Boolean(options.fxAddImageWatermark ?? false),
    imageWatermarkPath: String(options.fxImageWatermarkPath ?? ''),
    addVideoWatermark: Boolean(options.fxAddVideoWatermark ?? false),
    videoWatermarkPath: String(options.fxVideoWatermarkPath ?? ''),
    watermarkPos: (options.fxWatermarkPosition as WatermarkPos) ?? 'top-right',
    saturation: Number(options.fxSaturation ?? 100),
    saturationJitter: Boolean(options.fxSaturationJitter ?? true),
    contrast: Number(options.fxContrast ?? 100),
    noiseAmount: Number(options.fxNoiseAmount ?? 0),
    brightnessJitter: Boolean(options.fxBrightnessJitter ?? false),
    rotateDeg: Number(options.fxRotateDeg ?? 0),
    keepOriginalAudio: Boolean(options.keepOriginalAudio ?? true),
    originalVolume: Number(options.originalVolume ?? 100),
    audioLoudnorm:
      options.fxAudioLoudnorm === true ||
      (options.fxAudioLoudnorm !== false &&
        String(options.fxFissionProfile ?? '') === 'qianchuan'),
    introFadeSec: Number(options.fxIntroFadeSec ?? 0.6),
    speedRatePct: Number(options.fxSpeedRate ?? 100),
    cropEnabled,
    cropRatio: ratio,
    cropW,
    cropH,
    cropRectNorm,
    textOverlayNorm:
      options.fxTextOverlayNorm && typeof options.fxTextOverlayNorm === 'object'
        ? (options.fxTextOverlayNorm as VideoFxOpts['textOverlayNorm'])
        : null,
    textOverlays: parseTextOverlays(options),
    dynamicBgBlur: Number(options.fxDynamicBgBlur ?? 18),
    outW,
    outH,
    outFps,
    outFpsOriginal,
    coverAtSec: Number(options.fxCoverAtSec ?? 0),
    trimIntro: Number(options.fxTrimIntroSec ?? 0),
    trimOutro: Number(options.fxTrimOutroSec ?? 0),
    modules,
    configMode: options.fxConfigMode === 'manual' ? 'manual' : 'smart',
    useFissionEngine,
    fissionParams: buildFissionParamsFromOptions(
      options,
      modules,
      outW,
      outH,
      720,
      1280,
    ),
    bgmEnabled: Boolean(options.bgmEnabled ?? false),
    bgmPath: String(options.bgmPath ?? ''),
    bgmVolume: Number(options.bgmVolume ?? 30),
    removeBlackBar: Boolean(options.removeBlackBar ?? true),
    pipWidthPct: Math.min(100, Math.max(5, Number(options.fxPipWidthPct ?? 30))),
    brightness: Number(options.fxBrightness ?? 0),
    namingMode: String(options.fxNamingMode ?? 'effect_suffix'),
    stripMetadata: Boolean(options.fxStripMetadata ?? false),
    fissionProfile: String(options.fxFissionProfile ?? 'default'),
  }
}

function parseTextOverlays(options: Record<string, unknown>): VideoFxOpts['textOverlays'] {
  const raw = options.fxTextOverlays
  if (!Array.isArray(raw)) return []
  const out: VideoFxOpts['textOverlays'] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const text = String(o.text ?? '').trim()
    if (!text) continue
    const position = (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).includes(
      o.position as WatermarkPos,
    )
      ? (o.position as WatermarkPos)
      : 'top-right'
    let norm: VideoFxOpts['textOverlays'][0]['norm'] = null
    if (o.norm && typeof o.norm === 'object') {
      const n = o.norm as Record<string, number>
      norm = {
        x: Number(n.x) || 0,
        y: Number(n.y) || 0,
        w: Number(n.w) || 0.42,
        h: Number(n.h) || 0.12,
      }
    }
    out.push({ text, position, norm })
  }
  return out
}

function overlayCoords(pos: WatermarkPos) {
  const margin = 16
  switch (pos) {
    case 'top-right':
      return { x: `W-w-${margin}`, y: String(margin) }
    case 'bottom-left':
      return { x: String(margin), y: `H-h-${margin}` }
    case 'bottom-right':
      return { x: `W-w-${margin}`, y: `H-h-${margin}` }
    default:
      return { x: String(margin), y: String(margin) }
  }
}

/** 构建视频滤镜链（不含 inpaint / 双输入 overlay / 动态底纹 split 部分） */
export function buildVFilters(
  opts: VideoFxOpts,
  variant: number,
  width: number,
  height: number,
  opts2?: { skipScalePad?: boolean; skipFps?: boolean; skipDifferentiation?: boolean },
): string[] {
  const f = opts.modules
  const filters: string[] = []
  const skipDiff = opts2?.skipDifferentiation

  const wantRemove = opts.removeWatermark || f.removeWm || f.scrub
  const doRemove = !skipDiff && wantRemove && (f.removeWm || f.scrub)
  if (doRemove && opts.watermarkRemoveMode === 'delogo') {
    const y = Math.max(0, Math.floor((height * opts.eraseTop) / 100))
    const h = Math.max(8, Math.floor((height * opts.eraseHeight) / 100))
    const x = Math.max(0, Math.floor((width * opts.delogoLeft) / 100))
    const w = Math.max(8, Math.floor((width * opts.delogoWidth) / 100))
    filters.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0`)
  }

  if (opts.cropEnabled && opts.cropRectNorm) {
    const n = opts.cropRectNorm
    const cw = Math.max(2, Math.round(width * n.w))
    const ch = Math.max(2, Math.round(height * n.h))
    const cx = Math.max(0, Math.round(width * n.x))
    const cy = Math.max(0, Math.round(height * n.y))
    filters.push(`crop=${cw}:${ch}:${cx}:${cy}`)
    filters.push(`scale=${opts.cropW}:${opts.cropH}:flags=lanczos`)
  } else if (opts.cropEnabled) {
    filters.push(
      `scale=${opts.cropW}:${opts.cropH}:force_original_aspect_ratio=increase,crop=${opts.cropW}:${opts.cropH},scale=${opts.cropW}:${opts.cropH}:flags=lanczos`,
    )
  }

  if (!skipDiff) {
    if (f.mirror && (opts.mirrorRandom ? variant % 2 === 0 : true)) filters.push('hflip')
    if (f.mirror && opts.rotateDeg === 90) filters.push('transpose=1')
    else if (f.mirror && opts.rotateDeg === 180) filters.push('hflip,vflip')
    else if (f.mirror && opts.rotateDeg === 270) filters.push('transpose=2')
    if (f.speed) {
      const speedMult = opts.speedRatePct / 100
      filters.push(`setpts=${(1 / speedMult).toFixed(4)}*PTS`)
    }
    if (f.picture) {
      let sat = opts.saturation / 100
      if (opts.saturationJitter) sat *= 0.92 + (variant % 7) * 0.02
      const con = opts.contrast / 100
      let bri = opts.brightness / 100
      if (opts.brightnessJitter) bri += 0.02 + (variant % 5) * 0.01
      filters.push(
        `eq=saturation=${sat.toFixed(3)}:contrast=${con.toFixed(3)}:brightness=${bri.toFixed(3)}`,
      )
    }
    if (f.pixel) {
      const n = Math.max(1, opts.noiseAmount + (variant % 3))
      filters.push(`noise=alls=${n}:allf=t`)
    }
    if (f.mirror && opts.removeBlackBar && !opts.cropEnabled && opts.outW && opts.outH) {
      filters.push(
        `scale=${opts.outW}:${opts.outH}:force_original_aspect_ratio=increase,crop=${opts.outW}:${opts.outH}`,
      )
    }
  }

  if (f.intro && opts.introFadeSec > 0) {
    filters.push(`fade=t=in:st=0:d=${opts.introFadeSec.toFixed(2)}`)
  }

  if (f.textWm && opts.addTextWatermark) {
    const layers =
      opts.textOverlays.length > 0
        ? opts.textOverlays
        : [
            {
              text: opts.watermarkText,
              position: opts.watermarkPos,
              norm: opts.textOverlayNorm,
            },
          ]
    for (const layer of layers) {
      const raw = String(layer.text ?? '').trim()
      if (!raw) continue
      const text = raw.replace(/'/g, "\\'").replace(/:/g, '\\:')
      let x: string
      let y: string
      if (layer.norm) {
        const n = layer.norm
        x = `(w*${n.x.toFixed(4)})`
        y = `(h*${n.y.toFixed(4)})`
      } else {
        const c = overlayCoords(layer.position)
        x = c.x
        y = c.y
      }
      filters.push(
        `drawtext=text='${text}':fontsize=28:fontcolor=white@0.85:x=${x}:y=${y}:shadowcolor=black@0.55:shadowx=1:shadowy=1`,
      )
    }
  }

  const fissionAlreadySized =
    opts.useFissionEngine &&
    opts.fissionProfile !== 'qianchuan' &&
    opts.configMode === 'smart'
  if (
    !opts2?.skipScalePad &&
    !fissionAlreadySized &&
    !f.bg &&
    !(opts.cropEnabled && opts.cropRectNorm) &&
    !(f.mirror && opts.removeBlackBar) &&
    shouldApplyOutputScale(width, height, opts.outW, opts.outH, opts)
  ) {
    filters.push(outputScalePadFilter(opts.outW, opts.outH))
  }

  const skipFps =
    opts2?.skipFps ||
    opts.outFpsOriginal ||
    (opts.useFissionEngine && opts.fissionProfile === 'qianchuan')
  if (!skipFps) filters.push(`fps=${opts.outFps}`)
  return filters
}

function chainDynamicBgFromLabel(v0Label: string, opts: VideoFxOpts): string {
  const w = opts.cropEnabled ? opts.cropW : opts.outW
  const h = opts.cropEnabled ? opts.cropH : opts.outH
  const blur = opts.dynamicBgBlur
  return `${v0Label}split=2[fxbg][fxfg];[fxbg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=${blur}:${Math.max(4, blur / 2)}[fxbg2];[fxfg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fxfg2];[fxbg2][fxfg2]overlay=(W-w)/2:(H-h)/2,fps=${opts.outFps}[vbg]`
}

function buildBgFilterComplex(midChain: string, opts: VideoFxOpts): string {
  const w = opts.cropEnabled ? opts.cropW : opts.outW
  const h = opts.cropEnabled ? opts.cropH : opts.outH
  const blur = opts.dynamicBgBlur
  const pre = midChain ? `[0:v]${midChain}[pre];[pre]` : '[0:v]'
  return `${pre}split=2[fxbg][fxfg];[fxbg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=${blur}:${Math.max(4, blur / 2)}[fxbg2];[fxfg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fxfg2];[fxbg2][fxfg2]overlay=(W-w)/2:(H-h)/2,fps=${opts.outFps}[vout]`
}

function audioFilters(
  opts: VideoFxOpts,
  speedMult: number,
  extra?: { pitch?: number; volume?: number },
): string[] {
  if (!opts.keepOriginalAudio) return []
  const parts: string[] = []
  const vol = extra?.volume ?? (opts.modules.audio ? opts.originalVolume / 100 : 1)
  if (opts.modules.audio || extra?.volume != null) {
    parts.push(`volume=${Math.max(0, Math.min(2, vol)).toFixed(3)}`)
  }
  const pitch = extra?.pitch ?? 1
  if (Math.abs(pitch - 1) > 0.004) {
    parts.push(`asetrate=44100*${pitch.toFixed(4)},aresample=44100`)
  }
  if (opts.modules.speed && Math.abs(speedMult - 1) > 0.01) {
    const atempo = Math.min(2, Math.max(0.5, speedMult))
    parts.push(`atempo=${atempo.toFixed(4)}`)
  }
  if (opts.modules.intro && opts.introFadeSec > 0) {
    parts.push(`afade=t=in:st=0:d=${opts.introFadeSec.toFixed(2)}`)
  }
  if (opts.audioLoudnorm) {
    parts.push('loudnorm=I=-16:TP=-1.5:LRA=11')
  }
  return parts
}

export async function exportCoverFrame(
  input: string,
  outJpg: string,
  atSec: number,
): Promise<void> {
  assertOutputDoesNotReplaceSource(input, outJpg)
  await runFfmpeg([
    '-y',
    '-ss',
    String(Math.max(0, atSec)),
    '-i',
    input,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    outJpg,
  ])
}

async function finishEncodedVideo(
  opts: VideoFxOpts,
  tempOut: string,
  finalOut: string,
): Promise<void> {
  const needsBgm =
    opts.modules.audio &&
    opts.bgmEnabled &&
    Boolean(opts.bgmPath.trim()) &&
    opts.keepOriginalAudio
  if (!needsBgm) {
    if (tempOut !== finalOut) await fs.rename(tempOut, finalOut)
    return
  }
  await mixBackgroundMusic(tempOut, opts.bgmPath, opts.bgmVolume, finalOut)
  if (tempOut !== finalOut) await fs.unlink(tempOut).catch(() => {})
}

export async function renderEffectVideo(
  input: string,
  out: string,
  opts: VideoFxOpts,
  variant: number,
  ss?: number,
  to?: number,
  onProgress?: (r: number, msg: string) => void,
): Promise<void> {
  assertOutputDoesNotReplaceSource(input, out)
  const needsBgm =
    opts.modules.audio &&
    opts.bgmEnabled &&
    Boolean(opts.bgmPath.trim()) &&
    opts.keepOriginalAudio
  const encodeOut = needsBgm ? `${out}.eauto-tmp.mp4` : out

  const vInfo = await probeVideoStream(input)
  const { width, height } = vInfo
  const fullDur = await probeDuration(input)
  opts.fissionParams = buildFissionParamsFromOptions(
    {
      fxFissionProfile: opts.fissionProfile,
      fxConfigMode: opts.configMode,
      fxModuleEnabled: opts.modules,
      fissionCount: opts.fission,
      mirrorRandom: opts.mirrorRandom,
      fxSpeedRate: opts.speedRatePct,
      fxOutFps: opts.outFps,
      fxCropEnabled: opts.cropEnabled,
      fxCropRatio: opts.cropRatio,
      removeWatermark: opts.removeWatermark,
      eraseTop: opts.eraseTop,
      eraseHeight: opts.eraseHeight,
      fxDelogoLeft: opts.delogoLeft,
      fxDelogoWidth: opts.delogoWidth,
      originalVolume: opts.originalVolume,
    },
    opts.modules,
    opts.outW,
    opts.outH,
    width,
    height,
  )

  let planSs = 0
  let speedMult = 1
  let audioExtra: { pitch?: number; volume?: number } | undefined
  let fissionVisual: string[] = []
  if (opts.useFissionEngine) {
    const plan = buildVariantPlan(opts.fissionParams, input, variant, {
      width,
      height,
      duration: fullDur,
    })
    planSs = plan.ss
    if (opts.configMode === 'smart') speedMult = plan.speed
    fissionVisual = plan.visual
    audioExtra = { pitch: plan.audioPitch, volume: plan.audioVolume }
  }
  if (
    opts.modules.speed &&
    (opts.configMode !== 'smart' || opts.fissionProfile === 'qianchuan')
  ) {
    speedMult = opts.speedRatePct / 100
    if (opts.speedJitter) speedMult *= 0.96 + (variant % 9) * 0.01
  }

  const tailVf = buildVFilters(opts, variant, width, height, {
    skipDifferentiation: shouldSkipDifferentiation(opts),
  })
  const vf = [...fissionVisual, ...tailVf]
  const { x, y } = overlayCoords(opts.watermarkPos)

  const startSec = (ss ?? 0) + planSs
  let dur = fullDur
  if (ss != null && to != null) dur = Math.max(0.1, to - ss)
  if (planSs > 0) dur = Math.max(0.1, dur - planSs)

  const baseIn = ['-y', '-i', input]
  if (startSec > 0) baseIn.push('-ss', String(startSec))
  if (to != null && to > startSec + 0.04) baseIn.push('-to', String(to))

  const img =
    opts.modules.imageWm && opts.addImageWatermark && opts.imageWatermarkPath
      ? opts.imageWatermarkPath
      : ''
  const wantPip = opts.modules.pip && opts.addVideoWatermark
  const vidWm =
    wantPip && opts.videoWatermarkPath ? opts.videoWatermarkPath : ''
  const pipScale = (opts.pipWidthPct / 100).toFixed(3)

  const wantRemove =
    opts.removeWatermark || opts.modules.removeWm || opts.modules.scrub
  const doInpaint =
    wantRemove &&
    (opts.modules.scrub || opts.modules.removeWm) &&
    opts.watermarkRemoveMode === 'inpaint'

  const runWithBgComplex = async (extraInputs: string[], tailJoin: string) => {
    const mid = buildVFilters(opts, variant, width, height, {
      skipScalePad: true,
      skipFps: true,
    }).join(',')
    const graph = buildBgFilterComplex(mid, opts)
    await runFfmpeg(
      [...baseIn, ...extraInputs, '-filter_complex', `${graph}${tailJoin}`, '-map', '[vout]', '-map', '0:a?', ...audioArgs(opts, speedMult), ...videoMuxArgs(opts, encodeOut)],
      onProgress,
      dur,
    )
  }

  if (opts.modules.bg && !wantPip && !img && !doInpaint) {
    await runWithBgComplex([], '')
    await finishEncodedVideo(opts, encodeOut, out)
    return
  }

  if (wantPip) {
    const v0Chain = vf.length ? `[0:v]${vf.join(',')}[v0]` : '[0:v]format=yuv420p[v0]'
    const baseChain = opts.modules.bg
      ? [v0Chain, chainDynamicBgFromLabel('[v0]', opts)].join(';')
      : v0Chain
    const pipBase = opts.modules.bg ? '[vbg]' : '[v0]'
    const pipOverlay = `${pipBase}[wm]overlay=${x}:${y}:shortest=1[vout]`
    const filterComplex = vidWm
      ? [
          `[1:v]scale=iw*${pipScale}:-1[wm]`,
          baseChain,
          pipOverlay,
        ].join(';')
      : [
          baseChain,
          `${pipBase}split=2[base][pipsrc]`,
          `[pipsrc]scale=iw*${pipScale}:-1[wm]`,
          `[base][wm]overlay=${x}:${y}:shortest=1[vout]`,
        ].join(';')
    const ffIn = vidWm ? [...baseIn, '-i', vidWm] : baseIn
    await runFfmpeg(
      [
        ...ffIn,
        '-filter_complex',
        filterComplex,
        '-map',
        '[vout]',
        '-map',
        '0:a?',
        ...audioArgs(opts, speedMult, audioExtra),
        ...videoMuxArgs(opts, encodeOut),
      ],
      onProgress,
      dur,
    )
    await finishEncodedVideo(opts, encodeOut, out)
    return
  }

  if (img) {
    await runFfmpeg(
      [
        ...baseIn,
        '-i',
        img,
        '-filter_complex',
        [
          `[1:v]scale=120:-1[wm]`,
          vf.length ? `[0:v]${vf.join(',')}[v0]` : '[0:v]format=yuv420p[v0]',
          `[v0][wm]overlay=${x}:${y}[vout]`,
        ].join(';'),
        '-map',
        '[vout]',
        '-map',
        '0:a?',
        ...audioArgs(opts, speedMult, audioExtra),
        ...videoMuxArgs(opts, encodeOut),
      ],
      onProgress,
      dur,
    )
    await finishEncodedVideo(opts, encodeOut, out)
    return
  }

  if (doInpaint) {
    const inpaint = buildInpaintFilter(
      opts.eraseTop,
      opts.eraseHeight,
      opts.delogoLeft,
      opts.delogoWidth,
      width,
      height,
    )
    const tail = vf.length ? `[wmout]${vf.join(',')}[vout]` : '[wmout]copy[vout]'
    await runFfmpeg(
      [
        ...baseIn,
        '-filter_complex',
        `${inpaint};${tail}`,
        '-map',
        '[vout]',
        '-map',
        '0:a?',
        ...audioArgs(opts, speedMult, audioExtra),
        ...videoMuxArgs(opts, encodeOut),
      ],
      onProgress,
      dur,
    )
    await finishEncodedVideo(opts, encodeOut, out)
    return
  }

  const args = [...baseIn]
  if (vf.length) args.push('-vf', vf.join(','))
  if (opts.keepOriginalAudio) {
    const af = audioFilters(opts, speedMult, audioExtra)
    if (af.length) args.push('-filter:a', af.join(','))
    args.push('-c:a', 'aac', '-b:a', '128k')
  } else {
    args.push('-an')
  }
  args.push(...videoMuxArgs(opts, encodeOut))
  await runFfmpeg(args, onProgress, dur)
  await finishEncodedVideo(opts, encodeOut, out)
}

function audioArgs(
  opts: VideoFxOpts,
  speedMult: number,
  extra?: { pitch?: number; volume?: number },
): string[] {
  const args: string[] = []
  if (!opts.keepOriginalAudio) {
    args.push('-an')
    return args
  }
  const af = audioFilters(opts, speedMult, extra)
  if (af.length) args.push('-filter:a', af.join(','), '-c:a', 'aac', '-b:a', '128k')
  else args.push('-c:a', 'aac', '-b:a', '128k')
  return args
}

export function outputPathFor(
  outputDir: string,
  base: string,
  variant: number,
  part: string | null,
  byFolder: boolean,
  totalVariants = 1,
  namingMode = 'effect_suffix',
): { dir: string; name: string; full: string } {
  const dir = byFolder ? path.join(outputDir, base) : outputDir
  let name: string
  if (part) {
    name = `${base}_v${variant + 1}_${part}.mp4`
  } else if (namingMode === 'prefix_idx') {
    name = `${String(variant + 1).padStart(3, '0')}_${base}.mp4`
  } else if (namingMode === 'timestamp') {
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    name = `${ts}_${base}.mp4`
  } else if (totalVariants <= 1 || namingMode === 'effect_suffix') {
    name = `${base}_effect.mp4`
  } else {
    name = `${base}_裂变${String(variant + 1).padStart(2, '0')}.mp4`
  }
  return { dir, name, full: path.join(dir, name) }
}

export async function ensureOutDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}
