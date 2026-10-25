import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { planClipForSentence, poolBasenameSummary } from '../ai/visualMatch'
import { mixBackgroundMusic } from '../ffmpeg/bgm'
import { applyOutputFormat } from '../ffmpeg/postProcess'
import { burnSubtitles, writeSrt, type SubtitleCue } from '../ffmpeg/subtitles'
import { splitScriptToSentences, synthesizeToFile } from '../tts/synthesize'
import { ensureDir, probeDuration, runFfmpeg } from '../ffmpeg/util'
import { resolvePool } from './mixShared'

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
  if (keepAudio) {
    args.push('-filter:a', `volume=${vVol}`, '-c:a', 'aac')
  } else {
    args.push('-an')
  }
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
  const list = path.join(os.tmpdir(), `ai_mix_${Date.now()}.txt`)
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
      '22',
      '-c:a',
      'aac',
      out,
    ])
  } finally {
    await fs.unlink(list).catch(() => {})
  }
}

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

async function buildOneAiMix(
  req: FeatureJobRequest,
  batchIndex: number,
  tmpDir: string,
  report: ProgressReporter,
): Promise<string> {
  const pool = await resolvePool(req)
  const script = String(req.options.scriptText ?? '').trim()
  const externalAudio = String(req.options.scriptAudioPath ?? '').trim()
  const sentences = splitScriptToSentences(script)
  const matchMode = (req.options.matchMode as import('../ai/semanticMatch').MatchMode) ?? 'local'
  const ttsOn = Boolean(req.options.ttsEnabled ?? true) && !externalAudio
  const keepOriginalAudio = Boolean(req.options.keepOriginalAudio ?? false)
  const originalVolume = Number(req.options.originalVolume ?? 100)

  if (!sentences.length && !externalAudio) {
    throw new Error('请填写视频文案或导入配音音频')
  }

  report({ percent: 5, message: `分析素材库（${pool.length} 个视频）…` })
  report({ percent: 8, message: poolBasenameSummary(pool) })

  const lines = sentences.length ? sentences : ['【配音驱动】']
  const segmentPaths: string[] = []
  const cues: SubtitleCue[] = []
  const usedStarts = new Map<string, number[]>()
  let timeline = 0

  for (let i = 0; i < lines.length; i++) {
    const sentence = lines[i]!
    report({ percent: 10 + i * 5, message: `视频理解 · 匹配镜头 ${i + 1}/${lines.length}` })

    const audioPath = path.join(tmpDir, `ai_tts_${batchIndex}_${i}.mp3`)
    let segDur = Math.min(
      Number(req.options.clipMaxSec ?? 8),
      Math.max(Number(req.options.clipMinSec ?? 2), 3),
    )

    if (ttsOn && sentence !== '【配音驱动】') {
      report({ percent: 12 + i * 5, message: `语音合成 ${i + 1}/${lines.length}` })
      segDur = await synthesizeToFile(sentence, audioPath, req.options)
    }

    const plan = await planClipForSentence(
      sentence,
      pool,
      segDur,
      matchMode,
      req.options,
      usedStarts,
    )

    const rawClip = path.join(tmpDir, `ai_raw_${batchIndex}_${i}.mp4`)
    await cutClip(
      plan.file,
      plan.start,
      plan.duration,
      rawClip,
      keepOriginalAudio && !ttsOn,
      originalVolume,
    )

    const segOut = path.join(tmpDir, `ai_seg_${batchIndex}_${i}.mp4`)
    if (ttsOn && sentence !== '【配音驱动】') {
      await mergeAv(rawClip, audioPath, segOut)
    } else {
      await fs.copyFile(rawClip, segOut)
    }

    segmentPaths.push(segOut)
    const dur = await probeDuration(segOut)
    cues.push({ text: sentence, startSec: timeline, endSec: timeline + dur })
    timeline += dur
  }

  const merged = path.join(tmpDir, `ai_merged_${batchIndex}.mp4`)
  await concatVideos(segmentPaths, merged)

  let working = merged
  if (externalAudio) {
    report({ percent: 75, message: '合并导入配音…' })
    const dubbed = path.join(tmpDir, `ai_dub_${batchIndex}.mp4`)
    await mergeAv(merged, externalAudio, dubbed)
    working = dubbed
  }

  const srt = path.join(tmpDir, `ai_${batchIndex}.srt`)
  await writeSrt(cues, srt)
  const subbed = path.join(tmpDir, `ai_sub_${batchIndex}.mp4`)
  report({ percent: 85, message: '烧录字幕…' })
  await burnSubtitles(working, srt, subbed, {
    fontSize: req.options.fontSize,
    fontFamily: req.options.fontFamily,
    textColor: req.options.textColor,
    strokeColor: req.options.strokeColor,
    strokeWidth: req.options.strokeWidth,
    fontOpacity: req.options.fontOpacity,
  }).catch(async () => {
    await fs.copyFile(working, subbed)
  })
  working = subbed

  if (Boolean(req.options.bgmEnabled) && req.options.bgmPath) {
    report({ percent: 90, message: '混入背景音乐…' })
    const withBgm = path.join(tmpDir, `ai_bgm_${batchIndex}.mp4`)
    await mixBackgroundMusic(
      working,
      String(req.options.bgmPath),
      Number(req.options.bgmVolume ?? 30),
      withBgm,
    ).catch(async () => fs.copyFile(working, withBgm))
    working = withBgm
  }

  const { width, height } = outputSize(req.options)
  const finalPath = path.join(tmpDir, `ai_final_${batchIndex}.mp4`)
  report({ percent: 95, message: '成片输出格式…' })
  if (width && height) {
    await applyOutputFormat(working, finalPath, {
      width,
      height,
      fps: Number(req.options.outputFps ?? 30),
      brightness: Number(req.options.outputBrightness ?? 100),
      removeBlackBar: Boolean(req.options.removeBlackBar ?? true),
    })
  } else {
    await fs.copyFile(working, finalPath)
  }

  return finalPath
}

export async function runAiMixJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  if (!(await resolvePool(req)).length) {
    return { ok: false, error: '素材库为空，请先导入文件夹' }
  }

  const batchCount = Number(req.options.batchCount ?? 1)
  await ensureDir(req.outputDir)
  const tmpDir = path.join(os.tmpdir(), `eauto_ai_mix_${Date.now()}`)
  await ensureDir(tmpDir)
  const outputs: string[] = []

  for (let i = 0; i < batchCount; i++) {
    report({
      percent: Math.floor((i / batchCount) * 80),
      message: `批量成片 ${i + 1}/${batchCount}`,
    })
    const final = await buildOneAiMix(req, i, tmpDir, report)
    const name = `AI智能混剪_${Date.now()}_${i + 1}.mp4`
    const dest = path.join(req.outputDir, name)
    await fs.copyFile(final, dest)
    outputs.push(dest)
  }

  report({ percent: 100, message: 'AI 智能混剪完成' })
  return { ok: true, outputs }
}
