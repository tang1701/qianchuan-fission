import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { pickVideoForSentence } from '../ai/semanticMatch'
import { mixBackgroundMusic } from '../ffmpeg/bgm'
import { applyOutputFormat } from '../ffmpeg/postProcess'
import { burnSubtitles, writeSrt, type SubtitleCue } from '../ffmpeg/subtitles'
import { splitScriptToSentences, synthesizeToFile } from '../tts/synthesize'
import { ensureDir, probeDuration, runFfmpeg } from '../ffmpeg/util'
import { pickRandom, resolvePool } from './mixShared'

function outputSize(options: Record<string, unknown>) {
  const preset = String(options.outputPreset ?? '9:16')
  if (preset === '16:9') return { width: 1920, height: 1080 }
  if (preset === '1:1') return { width: 1080, height: 1080 }
  if (preset === 'original') return { width: 0, height: 0 }
  return {
    width: Number(options.outputWidth ?? 1080),
    height: Number(options.outputHeight ?? 1920),
  }
}

async function cutClip(
  input: string,
  start: number,
  duration: number,
  out: string,
  keepAudio: boolean,
  vol: number,
): Promise<void> {
  const vVol = Math.max(0, Math.min(2, vol / 100))
  const args = [
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
    'veryfast',
    '-crf',
    '23',
  ]
  if (keepAudio) args.push('-filter:a', `volume=${vVol}`, '-c:a', 'aac')
  else args.push('-an')
  args.push(out)
  await runFfmpeg(args)
}

async function mergeAv(video: string, audio: string, out: string): Promise<void> {
  await runFfmpeg([
    '-y',
    '-i',
    video,
    '-i',
    audio,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-shortest',
    out,
  ])
}

async function concatVideos(clips: string[], out: string): Promise<void> {
  const list = path.join(os.tmpdir(), `vmix_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`)
  await fs.writeFile(
    list,
    clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8',
  )
  try {
    await runFfmpeg([
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      out,
    ])
  } finally {
    await fs.unlink(list).catch(() => {})
  }
}

function pickStart(duration: number, clipLen: number): number {
  return Math.max(0, Math.random() * Math.max(0.1, duration - clipLen))
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

async function applyPostAndBgm(
  req: FeatureJobRequest,
  working: string,
  tmpDir: string,
  batchIndex: number,
  report: ProgressReporter,
): Promise<string> {
  let current = working

  if (Boolean(req.options.bgmEnabled) && req.options.bgmPath) {
    report({ percent: 92, message: '混入背景音乐…' })
    const withBgm = path.join(tmpDir, `vmix_bgm_${batchIndex}.mp4`)
    await mixBackgroundMusic(
      current,
      String(req.options.bgmPath),
      Number(req.options.bgmVolume ?? 30),
      withBgm,
    ).catch(async () => fs.copyFile(current, withBgm))
    current = withBgm
  }

  const { width, height } = outputSize(req.options)
  const finalPath = path.join(tmpDir, `vmix_fmt_${batchIndex}.mp4`)
  report({ percent: 96, message: '成片输出格式…' })
  if (width && height) {
    await applyOutputFormat(current, finalPath, {
      width,
      height,
      fps: Number(req.options.outputFps ?? 30),
      brightness: Number(req.options.outputBrightness ?? 100),
      removeBlackBar: Boolean(req.options.removeBlackBar ?? true),
    })
  } else {
    await fs.copyFile(current, finalPath)
  }
  return finalPath
}

async function buildRandomMix(
  req: FeatureJobRequest,
  batchIndex: number,
  tmpDir: string,
  report: ProgressReporter,
): Promise<string> {
  const pool = await resolvePool(req)
  const clipMin = Number(req.options.clipMinSec ?? 2)
  const clipMax = Number(req.options.clipMaxSec ?? 5)
  const clipCount = Number(req.options.clipsPerVideo ?? 8)
  const shuffle = Boolean(req.options.shuffleClips ?? true)
  const keepAudio = Boolean(req.options.keepOriginalAudio ?? false)
  const vol = Number(req.options.originalVolume ?? 100)
  const externalAudio = String(req.options.scriptAudioPath ?? '').trim()

  const clipPaths: string[] = []
  let targetDur = 0
  if (externalAudio) {
    targetDur = await probeDuration(externalAudio)
    report({ percent: 12, message: `导入配音时长 ${targetDur.toFixed(1)}s，抽取镜头…` })
  }

  let accumulated = 0
  const maxClips = externalAudio ? Math.min(40, Math.ceil(targetDur / clipMin) + 2) : clipCount

  for (let c = 0; c < maxClips; c++) {
    if (externalAudio && accumulated >= targetDur - 0.2 && clipPaths.length >= 1) break
    if (!externalAudio && c >= clipCount) break

    const file = pickRandom(pool)
    const dur = await probeDuration(file)
    const len = Math.min(clipMax, Math.max(clipMin, clipMin + Math.random() * (clipMax - clipMin)))
    const start = pickStart(dur, len)
    const clipPath = path.join(tmpDir, `vmix_r_${batchIndex}_${c}.mp4`)
    const useAudio = keepAudio && !externalAudio
    await cutClip(file, start, len, clipPath, useAudio, vol)
    clipPaths.push(clipPath)
    accumulated += len
    report({
      percent: 15 + Math.floor((c / maxClips) * 50),
      message: `随机片段 ${c + 1}/${maxClips}`,
    })
  }

  if (!clipPaths.length) throw new Error('未能抽取任何片段')

  if (shuffle) shuffleInPlace(clipPaths)

  const merged = path.join(tmpDir, `vmix_rand_${batchIndex}.mp4`)
  await concatVideos(clipPaths, merged)

  let working = merged
  if (externalAudio) {
    report({ percent: 72, message: '合并导入配音…' })
    const dubbed = path.join(tmpDir, `vmix_dub_${batchIndex}.mp4`)
    await mergeAv(merged, externalAudio, dubbed)
    working = dubbed
  }

  return applyPostAndBgm(req, working, tmpDir, batchIndex, report)
}

async function buildScriptMix(
  req: FeatureJobRequest,
  batchIndex: number,
  tmpDir: string,
  report: ProgressReporter,
): Promise<string> {
  const pool = await resolvePool(req)
  const script = String(req.options.scriptText ?? '').trim()
  const externalAudio = String(req.options.scriptAudioPath ?? '').trim()
  const sentences = splitScriptToSentences(script)
  const lines = sentences.length ? sentences : ['混剪片段']
  const matchMode = (req.options.matchMode as import('../ai/semanticMatch').MatchMode) ?? 'local'
  const ttsOn = Boolean(req.options.ttsEnabled ?? true) && !externalAudio
  const keepAudio = Boolean(req.options.keepOriginalAudio ?? false)
  const vol = Number(req.options.originalVolume ?? 100)
  const clipMin = Number(req.options.clipMinSec ?? 2)
  const clipMax = Number(req.options.clipMaxSec ?? 5)

  const segmentPaths: string[] = []
  const cues: SubtitleCue[] = []
  let timeline = 0

  for (let i = 0; i < lines.length; i++) {
    const sentence = lines[i]!
    report({ percent: 10 + i * 4, message: `匹配素材 ${i + 1}/${lines.length}` })

    const preferName = req.options.mixPreferFilenameMatch !== false
    const file = preferName
      ? await pickVideoForSentence(sentence, pool, matchMode, req.options)
      : pickRandom(pool)

    const audioPath = path.join(tmpDir, `vmix_tts_${batchIndex}_${i}.mp3`)
    let segDur = Math.min(clipMax, Math.max(clipMin, 3))

    if (ttsOn) {
      report({ percent: 12 + i * 4, message: `语音合成 ${i + 1}/${lines.length}` })
      segDur = await synthesizeToFile(sentence, audioPath, req.options)
    }

    const vDur = await probeDuration(file)
    const clipPath = path.join(tmpDir, `vmix_v_${batchIndex}_${i}.mp4`)
    await cutClip(
      file,
      pickStart(vDur, segDur),
      segDur,
      clipPath,
      keepAudio && !ttsOn,
      vol,
    )

    const segOut = path.join(tmpDir, `vmix_seg_${batchIndex}_${i}.mp4`)
    if (ttsOn) await mergeAv(clipPath, audioPath, segOut)
    else await fs.copyFile(clipPath, segOut)

    segmentPaths.push(segOut)
    const actualDur = await probeDuration(segOut)
    cues.push({ text: sentence, startSec: timeline, endSec: timeline + actualDur })
    timeline += actualDur
  }

  const merged = path.join(tmpDir, `vmix_merged_${batchIndex}.mp4`)
  await concatVideos(segmentPaths, merged)

  let working = merged
  if (externalAudio) {
    report({ percent: 70, message: '合并导入配音…' })
    const dubbed = path.join(tmpDir, `vmix_ext_${batchIndex}.mp4`)
    await mergeAv(merged, externalAudio, dubbed)
    working = dubbed
  }

  if (script) {
    const srt = path.join(tmpDir, `vmix_${batchIndex}.srt`)
    await writeSrt(cues, srt)
    const subbed = path.join(tmpDir, `vmix_sub_${batchIndex}.mp4`)
    report({ percent: 82, message: '烧录字幕…' })
    await burnSubtitles(working, srt, subbed, {
      fontSize: req.options.fontSize,
      fontFamily: req.options.fontFamily,
      textColor: req.options.textColor,
      strokeColor: req.options.strokeColor,
      strokeWidth: req.options.strokeWidth,
      fontOpacity: req.options.fontOpacity,
    }).catch(async () => fs.copyFile(working, subbed))
    working = subbed
  }

  return applyPostAndBgm(req, working, tmpDir, batchIndex, report)
}

function useScriptPipeline(req: FeatureJobRequest): boolean {
  return Boolean(String(req.options.scriptText ?? '').trim())
}

export async function runVideoMixJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  if (!(await resolvePool(req)).length) {
    return { ok: false, error: '素材库为空，请先导入文件夹或视频' }
  }

  const batchCount = Number(req.options.batchCount ?? 1)
  await ensureDir(req.outputDir)
  const tmpDir = path.join(os.tmpdir(), `eauto_video_mix_${Date.now()}`)
  await ensureDir(tmpDir)
  const outputs: string[] = []

  const scriptMode = useScriptPipeline(req)

  for (let i = 0; i < batchCount; i++) {
    report({
      percent: Math.floor((i / batchCount) * 85),
      message: `批量混剪 ${i + 1}/${batchCount} · ${scriptMode ? '文案驱动' : '随机重组'}`,
    })
    const final = scriptMode
      ? await buildScriptMix(req, i, tmpDir, report)
      : await buildRandomMix(req, i, tmpDir, report)
    const dest = path.join(req.outputDir, `视频混剪_${Date.now()}_${i + 1}.mp4`)
    await fs.copyFile(final, dest)
    outputs.push(dest)
  }

  report({ percent: 100, message: '视频混剪完成' })
  return { ok: true, outputs }
}
