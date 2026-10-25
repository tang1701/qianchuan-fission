/** 裂变差异化滤镜（对齐 ECutAuto / 工作台参考实现的随机扰动逻辑） */

export interface FissionDelogoRegion {
  x: number
  y: number
  w: number
  h: number
  refW?: number
  refH?: number
}

export interface FissionParams {
  seed: string
  delogo: {
    enabled: boolean
    regions: FissionDelogoRegion[]
    timeStart: number | null
    timeEnd: number | null
  }
  video: {
    zoom: { enabled: boolean; min: number; max: number }
    cropEdge: { enabled: boolean; min: number; max: number }
    rotate: { enabled: boolean; min: number; max: number }
    brightness: { enabled: boolean; min: number; max: number }
    contrast: { enabled: boolean; min: number; max: number }
    saturation: { enabled: boolean; min: number; max: number }
    hue: { enabled: boolean; min: number; max: number }
    noise: { enabled: boolean; min: number; max: number }
    blur: { enabled: boolean; min: number; max: number }
    speed: { enabled: boolean; min: number; max: number }
    trimStart: { enabled: boolean; max: number }
    fps: { enabled: boolean; values: number[] }
    mirror: { enabled: boolean; probability: number }
    resolution: string
  }
  audio: {
    pitch: { enabled: boolean; min: number; max: number }
    volume: { enabled: boolean; min: number; max: number }
  }
}

function hashSeed(text: string) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rangeOf(rng: () => number, min: number, max: number) {
  let a = min
  let b = max
  if (a > b) [a, b] = [b, a]
  return a + (b - a) * rng()
}

function clampRegion(region: FissionDelogoRegion, width: number, height: number) {
  const margin = 1
  let x = Math.round(region.x)
  let y = Math.round(region.y)
  let w = Math.round(region.w)
  let h = Math.round(region.h)
  if (x < margin) {
    w -= margin - x
    x = margin
  }
  if (y < margin) {
    h -= margin - y
    y = margin
  }
  w = Math.min(w, width - margin - x)
  h = Math.min(h, height - margin - y)
  if (w < 2 || h < 2) return null
  return { x, y, w, h }
}

function scaleRegion(region: FissionDelogoRegion, width: number, height: number) {
  const refW = region.refW || 0
  const refH = region.refH || 0
  if (refW > 0 && refH > 0 && width && height) {
    return {
      x: (region.x / refW) * width,
      y: (region.y / refH) * height,
      w: (region.w / refW) * width,
      h: (region.h / refH) * height,
    }
  }
  return region
}

function delogoEnable(params: FissionParams, ss: number) {
  const start = params.delogo.timeStart
  const end = params.delogo.timeEnd
  if (start == null || end == null || !(end > start)) return ''
  const from = Math.max(0, start - ss)
  const to = end - ss
  if (!(to > from)) return null
  return `:enable='between(t\\,${from.toFixed(2)}\\,${to.toFixed(2)})'`
}

export interface VariantPlan {
  ss: number
  speed: number
  visual: string[]
  audioPitch: number
  audioVolume: number
}

export function buildVariantPlan(
  params: FissionParams,
  filePath: string,
  variantIndex: number,
  meta: { width: number; height: number; duration: number },
): VariantPlan {
  const rng = mulberry32(hashSeed(`${params.seed}|${filePath}|${variantIndex}`))
  const visual: string[] = []
  let ss = 0
  let speed = 1
  const { width, height } = meta

  if (params.video.trimStart.enabled && meta.duration > 1) {
    const maxTrim = Math.min(params.video.trimStart.max, Math.max(0, meta.duration - 0.5))
    ss = rangeOf(rng, 0, maxTrim)
    if (ss <= 0.03) ss = 0
  }

  if (params.delogo.enabled) {
    const enable = delogoEnable(params, ss)
    if (enable !== null) {
      for (const region of params.delogo.regions) {
        const scaled = scaleRegion(region, width, height)
        const box = clampRegion(scaled, width, height)
        if (box) visual.push(`delogo=x=${box.x}:y=${box.y}:w=${box.w}:h=${box.h}${enable}`)
      }
    }
  }

  if (params.video.speed.enabled) {
    speed = rangeOf(rng, params.video.speed.min, params.video.speed.max)
  }

  if (params.video.cropEdge.enabled && width && height) {
    const maxCrop = Math.max(0, Math.floor(Math.min(width, height) / 8))
    const px = Math.round(rangeOf(rng, params.video.cropEdge.min, params.video.cropEdge.max))
    const crop = Math.max(0, Math.min(px, maxCrop))
    if (crop >= 2) {
      // 仅裁边改像素指纹，勿 scale 回原尺寸（二次插值会明显发糊）
      visual.push(`crop=iw-${crop * 2}:ih-${crop * 2}:${crop}:${crop}`)
    }
  }

  if (params.video.zoom.enabled && width && height) {
    const zoom = rangeOf(rng, params.video.zoom.min, params.video.zoom.max)
    if (zoom > 1.005) {
      const zw = Math.max(width + 2, Math.round(width * zoom))
      const zh = Math.max(height + 2, Math.round(height * zoom))
      const x = Math.max(0, Math.floor((zw - width) / 2))
      const y = Math.max(0, Math.floor((zh - height) / 2))
      visual.push(`scale=${zw}:${zh}:flags=lanczos`)
      visual.push(`crop=${width}:${height}:${x}:${y}`)
    }
  }

  if (params.video.rotate.enabled) {
    const deg = rangeOf(rng, params.video.rotate.min, params.video.rotate.max)
    if (Math.abs(deg) > 0.05) {
      const rad = ((deg * Math.PI) / 180).toFixed(5)
      visual.push(`rotate=a=${rad}:ow=iw:oh=ih:fillcolor=black`)
    }
  }

  if (params.video.mirror.enabled && rng() * 100 < params.video.mirror.probability) {
    visual.push('hflip')
  }

  const eq: string[] = []
  if (params.video.brightness.enabled) {
    eq.push(`brightness=${rangeOf(rng, params.video.brightness.min, params.video.brightness.max).toFixed(4)}`)
  }
  if (params.video.contrast.enabled) {
    eq.push(`contrast=${rangeOf(rng, params.video.contrast.min, params.video.contrast.max).toFixed(4)}`)
  }
  if (params.video.saturation.enabled) {
    eq.push(`saturation=${rangeOf(rng, params.video.saturation.min, params.video.saturation.max).toFixed(4)}`)
  }
  if (eq.length) visual.push(`eq=${eq.join(':')}`)

  if (params.video.hue.enabled) {
    const value = rangeOf(rng, params.video.hue.min, params.video.hue.max)
    if (Math.abs(value) > 0.2) visual.push(`hue=h=${value.toFixed(2)}`)
  }

  if (params.video.noise.enabled) {
    const amount = Math.round(rangeOf(rng, params.video.noise.min, params.video.noise.max))
    if (amount > 0) visual.push(`noise=alls=${amount}:allf=t+u`)
  }

  if (params.video.blur.enabled) {
    const sigma = rangeOf(rng, params.video.blur.min, params.video.blur.max)
    if (sigma >= 0.15) visual.push(`gblur=sigma=${sigma.toFixed(2)}`)
  }

  if (params.video.fps.enabled && params.video.fps.values.length) {
    const fps = params.video.fps.values[Math.floor(rng() * params.video.fps.values.length)]!
    visual.push(`fps=${fps}`)
  }

  if (params.video.resolution && params.video.resolution !== 'original') {
    const [targetW, targetH] = params.video.resolution.split('x').map(Number)
    if (targetW && targetH) {
      visual.push(
        `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease:flags=lanczos`,
      )
      visual.push(`pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`)
    }
  }

  if (Math.abs(speed - 1) > 0.004) {
    visual.push(`setpts=PTS/${speed.toFixed(4)}`)
  }

  let audioPitch = 1
  let audioVolume = 1
  if (params.audio.pitch.enabled) {
    audioPitch = rangeOf(rng, params.audio.pitch.min, params.audio.pitch.max)
  }
  if (params.audio.volume.enabled) {
    audioVolume = rangeOf(rng, params.audio.volume.min, params.audio.volume.max)
  }

  return { ss, speed, visual, audioPitch, audioVolume }
}

/**
 * 千川过审向：画面几乎不变，但时间轴裁头、微缩放裁边、轻变速/调色/噪点、重编码改指纹。
 * 对齐竞品「_裂变01/02/03」类输出。
 */
export function qianchuanFissionParams(): FissionParams {
  return {
    seed: '',
    delogo: { enabled: false, regions: [], timeStart: null, timeEnd: null },
    video: {
      // 不做放大/旋转/噪点/二次缩放（易产生底部糊屏、竖条）；改指纹靠裁头+微裁边+轻变速+重编码
      zoom: { enabled: false, min: 1, max: 1 },
      cropEdge: { enabled: true, min: 1, max: 1 },
      rotate: { enabled: false, min: 0, max: 0 },
      // 调色走 eq 会多一代处理；千川改指纹靠裁头/1px 裁边/变速/高码率重编码
      brightness: { enabled: false, min: 0, max: 0 },
      contrast: { enabled: false, min: 1, max: 1 },
      saturation: { enabled: false, min: 1, max: 1 },
      hue: { enabled: false, min: 0, max: 0 },
      noise: { enabled: false, min: 0, max: 0 },
      blur: { enabled: false, min: 0, max: 0 },
      speed: { enabled: true, min: 0.992, max: 1.018 },
      trimStart: { enabled: true, max: 0.28 },
      fps: { enabled: false, values: [30] },
      mirror: { enabled: false, probability: 0 },
      resolution: 'original',
    },
    audio: {
      pitch: { enabled: true, min: 0.993, max: 1.015 },
      volume: { enabled: true, min: 0.985, max: 1.015 },
    },
  }
}

export function smartFissionParams(): FissionParams {
  return {
    seed: '',
    delogo: { enabled: false, regions: [], timeStart: null, timeEnd: null },
    video: {
      zoom: { enabled: true, min: 1.03, max: 1.08 },
      cropEdge: { enabled: true, min: 4, max: 16 },
      rotate: { enabled: true, min: -0.6, max: 0.6 },
      brightness: { enabled: true, min: -0.04, max: 0.04 },
      contrast: { enabled: true, min: 0.96, max: 1.08 },
      saturation: { enabled: true, min: 0.92, max: 1.12 },
      hue: { enabled: true, min: -6, max: 6 },
      noise: { enabled: true, min: 2, max: 8 },
      blur: { enabled: false, min: 0.2, max: 0.5 },
      speed: { enabled: true, min: 0.97, max: 1.04 },
      trimStart: { enabled: false, max: 0.4 },
      fps: { enabled: true, values: [25, 30] },
      mirror: { enabled: true, probability: 30 },
      resolution: 'original',
    },
    audio: {
      pitch: { enabled: true, min: 0.98, max: 1.03 },
      volume: { enabled: true, min: 0.92, max: 1.08 },
    },
  }
}
