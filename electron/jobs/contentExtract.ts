import path from 'node:path'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { detectSceneTimes } from '../ffmpeg/scenes'
import {
  ensureDir,
  probeDuration,
  runFfmpeg,
  safeBaseName,
} from '../ffmpeg/util'

async function cutClip(input: string, start: number, duration: number, out: string): Promise<void> {
  await runFfmpeg([
    '-y',
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    input,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    out,
  ])
}

export async function runContentExtractJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  const sliceMin = Number(req.options.sliceMinSec ?? 5)
  const sliceMax = Number(req.options.sliceMaxSec ?? 30)
  const perVideo = Number(req.options.batchCount ?? 3)
  const extractMode = String(req.options.extractMode ?? 'ai')
  const minSceneGap = Number(req.options.extractMinSceneSec ?? 3)

  if (!req.inputs.length) return { ok: false, error: '请先导入视频' }
  await ensureDir(req.outputDir)
  const outputs: string[] = []

  for (let i = 0; i < req.inputs.length; i++) {
    const input = req.inputs[i]!
    const base = safeBaseName(input)
    const dur = await probeDuration(input)
    report({ percent: Math.floor((i / req.inputs.length) * 85), message: `提炼 ${base}` })

    if (extractMode === 'ai') {
      let scenes: number[] = []
      try {
        scenes = await detectSceneTimes(input, 0.33)
      } catch {
        scenes = []
      }
      if (scenes.length >= 1) {
        const segments: { start: number; end: number }[] = []
        const cuts = [0, ...scenes.filter((t) => t > 0.3 && t < dur - 0.3), dur]
        for (let s = 0; s < cuts.length - 1; s++) {
          const start = cuts[s]!
          let end = cuts[s + 1]!
          let len = end - start
          if (len < minSceneGap) continue
          if (len > sliceMax) {
            end = start + sliceMax
            len = sliceMax
          }
          if (len >= sliceMin) segments.push({ start, end })
        }
        const take = segments.slice(0, Math.max(perVideo, segments.length > 0 ? perVideo : 0))
        const list = take.length ? take : [{ start: 0, end: Math.min(dur, sliceMax) }]
        for (let s = 0; s < Math.min(perVideo, list.length); s++) {
          const { start, end } = list[s]!
          const len = end - start
          const out = path.join(req.outputDir, `${base}_highlight_${s + 1}.mp4`)
          await cutClip(input, start, len, out)
          outputs.push(out)
        }
        continue
      }
    }

    for (let s = 0; s < perVideo; s++) {
      const len = sliceMin + Math.random() * (sliceMax - sliceMin)
      const start = Math.random() * Math.max(0.5, dur - len)
      const out = path.join(req.outputDir, `${base}_slice_${s + 1}.mp4`)
      await cutClip(input, start, len, out)
      outputs.push(out)
    }
  }

  report({ percent: 100, message: `切片完成，共 ${outputs.length} 个文件` })
  return { ok: true, outputs }
}
