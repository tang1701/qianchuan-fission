import path from 'node:path'
import fs from 'node:fs/promises'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { detectSceneTimes } from '../ffmpeg/scenes'
import { ensureDir, probeDuration, safeBaseName } from '../ffmpeg/util'
import {
  ensureOutDir,
  exportCoverFrame,
  outputPathFor,
  parseVideoFxOpts,
  renderEffectVideo,
  type VideoFxOpts,
} from './videoEffectsPipeline'

function buildTimeSegments(dur: number, interval: number): { start: number; end: number }[] {
  const segs: { start: number; end: number }[] = []
  let t = 0
  while (t < dur - 0.05) {
    const end = Math.min(dur, t + interval)
    if (end - t >= 0.3) segs.push({ start: t, end })
    t = end
  }
  return segs
}

function splitLongSegments(
  segs: { start: number; end: number }[],
  maxLen: number,
  minLen: number,
): { start: number; end: number }[] {
  if (maxLen <= 0) return segs
  const out: { start: number; end: number }[] = []
  for (const s of segs) {
    let t = s.start
    while (t < s.end - 0.05) {
      const end = Math.min(s.end, t + maxLen)
      if (end - t >= minLen) out.push({ start: t, end })
      t = end
    }
  }
  return out.length ? out : segs
}

function mergeShortSegments(
  segs: { start: number; end: number }[],
  minLen: number,
): { start: number; end: number }[] {
  if (segs.length < 2) return segs
  const out: { start: number; end: number }[] = []
  let cur = { ...segs[0]! }
  for (let i = 1; i < segs.length; i++) {
    const s = segs[i]!
    if (s.end - s.start < minLen) {
      cur.end = s.end
    } else {
      out.push(cur)
      cur = { ...s }
    }
  }
  out.push(cur)
  return out
}

function aiSceneThreshold(sensitivity: number) {
  const t = Math.max(0, Math.min(100, sensitivity))
  return 0.55 - (t / 100) * 0.4
}

function buildSceneSegments(
  dur: number,
  sceneTimes: number[],
  minLen: number,
): { start: number; end: number }[] {
  const cuts = [0, ...sceneTimes.filter((t) => t > 0.2 && t < dur - 0.2), dur]
  const uniq = [...new Set(cuts.map((t) => Math.round(t * 100) / 100))].sort((a, b) => a - b)
  const segs: { start: number; end: number }[] = []
  const min = Math.max(0.35, minLen)
  for (let i = 0; i < uniq.length - 1; i++) {
    const start = uniq[i]!
    const end = uniq[i + 1]!
    if (end - start >= min) segs.push({ start, end })
  }
  if (!segs.length && dur > 0) segs.push({ start: 0, end: dur })
  return segs
}

async function processOneVariant(
  input: string,
  base: string,
  opts: VideoFxOpts,
  variant: number,
  outputDir: string,
  byFolder: boolean,
  trimStart: number,
  dur: number,
  aiSplit: boolean,
  splitInterval: number,
  filterMin: number,
  splitMaxSec: number,
  mergeShort: boolean,
  aiSensitivity: number,
  namingMode: string,
  report: ProgressReporter,
  pctBase: number,
  totalUnits: number,
): Promise<string[]> {
  const outputs: string[] = []
  const wantSplit = aiSplit || splitInterval > 0
  let segments: { start: number; end: number }[] = []

  if (wantSplit) {
    if (aiSplit) {
      report({ percent: pctBase + 1, message: `AI 镜头分析 ${base}…` })
      const scenes = await detectSceneTimes(input, aiSceneThreshold(aiSensitivity))
      let built = buildSceneSegments(dur, scenes, filterMin)
      built = splitLongSegments(built, splitMaxSec, Math.max(0.35, filterMin))
      if (mergeShort) built = mergeShortSegments(built, Math.max(0.35, filterMin))
      segments = built.map((s) => ({
        start: s.start + trimStart,
        end: s.end + trimStart,
      }))
    } else {
      segments = buildTimeSegments(dur, Math.max(1, splitInterval)).map((s) => ({
        start: s.start + trimStart,
        end: s.end + trimStart,
      }))
    }
  }

  if (segments.length) {
    const segDir = byFolder
      ? path.join(outputDir, base, `_seg_v${variant + 1}`)
      : path.join(outputDir, `${base}_v${variant + 1}_seg`)
    await ensureOutDir(segDir)
    for (let s = 0; s < segments.length; s++) {
      const { start, end } = segments[s]!
      const out = path.join(segDir, `part_${String(s + 1).padStart(3, '0')}.mp4`)
      await renderEffectVideo(input, out, opts, variant, start, end, (r, msg) =>
        report({
          percent: pctBase + Math.floor(((s + r) / segments.length) * (95 / totalUnits)),
          message: msg,
        }),
      )
      outputs.push(out)
    }
  } else {
    const { dir, full } = outputPathFor(
      outputDir,
      base,
      variant,
      null,
      byFolder,
      opts.fission,
      namingMode,
    )
    await ensureOutDir(dir)
    await renderEffectVideo(
      input,
      full,
      opts,
      variant,
      trimStart || undefined,
      trimStart + dur,
      (r, msg) =>
        report({
          percent: pctBase + Math.floor(r * (95 / totalUnits)),
          message: msg,
        }),
    )
    outputs.push(full)
  }

  if (opts.modules.cover) {
    const coverDir = byFolder ? path.join(outputDir, base) : outputDir
    await ensureOutDir(coverDir)
    const jpg = path.join(coverDir, `${base}_cover_v${variant + 1}.jpg`)
    await exportCoverFrame(input, jpg, trimStart + opts.coverAtSec)
    outputs.push(jpg)
  }

  return outputs
}

export async function runVideoEffectsJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  const { inputs, outputDir, options } = req
  if (!inputs.length) return { ok: false, error: '请先导入视频' }

  report({ percent: 1, message: '校验素材与导出目录…' })
  for (const input of inputs) {
    try {
      await fs.access(input)
    } catch {
      return {
        ok: false,
        error: `找不到视频文件，请用「导入视频」重新选择：\n${input}`,
      }
    }
  }

  const opts = parseVideoFxOpts(options as Record<string, unknown>)
  const aiSplit = Boolean(options.aiSplitEnabled)
  const splitInterval = Number(options.splitIntervalSec ?? 0)
  const byFolder = Boolean(options.fxExportByFolder ?? true)
  const filterMin = Number(options.fxFilterMinSegmentSec ?? 0)
  const splitMaxSec = Number(options.fxSplitMaxSec ?? 0)
  const mergeShort = Boolean(options.fxMergeShortSegments ?? false)
  const aiSensitivity = Number(options.fxAiSceneSensitivity ?? 50)
  const namingMode = String(options.fxNamingMode ?? 'effect_suffix')

  await ensureDir(outputDir)
  const outputs: string[] = []
  const totalUnits = inputs.length * opts.fission
  let unit = 0

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!
    const base = safeBaseName(input)
    report({
      percent: Math.floor((i / inputs.length) * 8),
      message: `分析 ${base}（${i + 1}/${inputs.length}）…`,
    })
    const fullDur = await probeDuration(input)
    const trimStart = Math.max(0, opts.trimIntro)
    const trimOutro = Math.max(0, opts.trimOutro)
    if (trimStart + trimOutro >= fullDur - 0.2) {
      report({
        percent: Math.floor((i / inputs.length) * 90),
        message: `跳过 ${base}：片头片尾裁剪过长`,
      })
      continue
    }
    const dur = fullDur - trimStart - trimOutro

    for (let c = 0; c < opts.fission; c++) {
      unit++
      const pctBase = Math.floor(((unit - 1) / totalUnits) * 95)
      report({ percent: pctBase, message: `效果处理 ${base} · 裂变 ${c + 1}/${opts.fission}` })
      const batch = await processOneVariant(
        input,
        base,
        opts,
        c,
        outputDir,
        byFolder,
        trimStart,
        dur,
        aiSplit,
        splitInterval,
        filterMin,
        splitMaxSec,
        mergeShort,
        aiSensitivity,
        namingMode,
        report,
        pctBase,
        totalUnits,
      )
      outputs.push(...batch)
    }
  }

  report({ percent: 100, message: `效果处理完成，共 ${outputs.length} 个文件` })
  return { ok: true, outputs }
}
