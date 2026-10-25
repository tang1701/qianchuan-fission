import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import {
  ensureDir,
  probeDuration,
  runFfmpeg,
  safeBaseName,
  scanVideosInDir,
} from '../ffmpeg/util'
import { runRichMixJob } from './mixPipeline'
import { pickRandom, resolvePool, shouldUseRichPipeline } from './mixShared'

async function cutClip(
  input: string,
  start: number,
  duration: number,
  out: string,
): Promise<void> {
  await runFfmpeg([
    '-y',
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    input,
    '-c',
    'copy',
    out,
  ])
}

async function concatClips(clips: string[], out: string): Promise<void> {
  const listFile = path.join(os.tmpdir(), `eauto_concat_${Date.now()}.txt`)
  const content = clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n')
  await fs.writeFile(listFile, content, 'utf8')
  try {
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', out])
  } finally {
    await fs.unlink(listFile).catch(() => {})
  }
}

async function buildMixedVideo(
  pool: string[],
  options: Record<string, unknown>,
  out: string,
  tmpDir: string,
  index: number,
): Promise<void> {
  const clipMin = Number(options.clipMinSec ?? 2)
  const clipMax = Number(options.clipMaxSec ?? 5)
  const clipCount = Number(options.clipsPerVideo ?? 8)
  const foldersOrdered = (options.folderPaths as string[] | undefined) ?? []
  const categoryMode = options.categoryPickMode as string | undefined

  const clips: string[] = []

  if (categoryMode && foldersOrdered.length > 1) {
    for (let f = 0; f < foldersOrdered.length; f++) {
      const dir = foldersOrdered[f]
      const vids = await scanVideosInDir(dir!)
      if (!vids.length) continue
      const file = categoryMode === 'sequential' ? vids[index % vids.length]! : pickRandom(vids)
      const dur = await probeDuration(file)
      const len = Math.min(clipMax, Math.max(clipMin, dur * 0.2))
      const start = Math.max(0, Math.random() * Math.max(0.1, dur - len))
      const clipPath = path.join(tmpDir, `c_${index}_${f}.mp4`)
      await cutClip(file, start, len, clipPath)
      clips.push(clipPath)
    }
  } else {
    for (let c = 0; c < clipCount; c++) {
      const file = pickRandom(pool)
      const dur = await probeDuration(file)
      const len = Math.min(clipMax, Math.max(clipMin, dur * 0.25))
      const start = Math.max(0, Math.random() * Math.max(0.1, dur - len))
      const clipPath = path.join(tmpDir, `c_${index}_${c}.mp4`)
      await cutClip(file, start, len, clipPath)
      clips.push(clipPath)
    }
  }

  if (!clips.length) throw new Error('没有可用素材片段')
  await concatClips(clips, out)
}

export async function runMixJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  if (shouldUseRichPipeline(req)) {
    try {
      const { outputs } = await runRichMixJob(req, report)
      return { ok: true, outputs }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  const pool = await resolvePool(req)
  if (!pool.length) return { ok: false, error: '素材库为空，请先导入文件夹或视频' }

  const batchCount = Number(req.options.batchCount ?? 1)
  await ensureDir(req.outputDir)
  const tmpDir = path.join(os.tmpdir(), `eauto_mix_${Date.now()}`)
  await ensureDir(tmpDir)
  const outputs: string[] = []

  for (let i = 0; i < batchCount; i++) {
    report({
      percent: Math.floor((i / batchCount) * 90),
      message: `生成成片 ${i + 1}/${batchCount}`,
    })
    const out = path.join(req.outputDir, `mix_${Date.now()}_${i + 1}.mp4`)
    await buildMixedVideo(pool, req.options, out, tmpDir, i)
    outputs.push(out)
  }

  report({ percent: 100, message: '混剪完成' })
  return { ok: true, outputs }
}

export { runCopyRewriteJob } from './copyRewrite'
export { runContentExtractJob as runExtractJob } from './contentExtract'
export { runDramaMixJob as runDramaJob } from './dramaMix'
