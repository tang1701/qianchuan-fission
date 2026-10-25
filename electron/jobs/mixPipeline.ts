import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { FeatureJobRequest, ProgressReporter } from './types'
import { pickVideoForSentence } from '../ai/semanticMatch'
import { mixBackgroundMusic } from '../ffmpeg/bgm'
import { burnSubtitles, writeSrt, type SubtitleCue } from '../ffmpeg/subtitles'
import { splitScriptToSentences, synthesizeToFile } from '../tts/synthesize'
import {
  ensureDir,
  probeDuration,
  runFfmpeg,
  scanVideosInDir,
} from '../ffmpeg/util'
import { pickRandom, resolvePool } from './mixShared'

async function cutClipEncoded(
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
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-an',
    out,
  ])
}

async function mergeVideoAudio(
  videoPath: string,
  audioPath: string,
  out: string,
  _originalVolume: number,
): Promise<void> {
  await runFfmpeg([
    '-y',
    '-i',
    videoPath,
    '-i',
    audioPath,
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

async function concatReencode(clips: string[], out: string): Promise<void> {
  const listFile = path.join(os.tmpdir(), `eauto_rich_${Date.now()}.txt`)
  const content = clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join('\n')
  await fs.writeFile(listFile, content, 'utf8')
  try {
    await runFfmpeg([
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
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
    await fs.unlink(listFile).catch(() => {})
  }
}

function pickStart(duration: number, clipLen: number): number {
  return Math.max(0, Math.random() * Math.max(0.1, duration - clipLen))
}

export async function buildRichMixVideo(
  req: FeatureJobRequest,
  out: string,
  tmpDir: string,
  batchIndex: number,
  report: ProgressReporter,
): Promise<void> {
  const pool = await resolvePool(req)
  const script = String(req.options.scriptText ?? '').trim()
  const sentences = splitScriptToSentences(script)
  const matchMode = (req.options.matchMode as 'local' | 'cloud') ?? 'local'
  const externalAudio = String(req.options.scriptAudioPath ?? '').trim()
  const ttsEnabled = Boolean(req.options.ttsEnabled ?? true) && !externalAudio
  const originalVolume = Number(req.options.originalVolume ?? 100)
  const useAiMatch =
    req.featureId === 'ai-mix' ||
    matchMode === 'cloud' ||
    matchMode === 'clip' ||
    matchMode === 'vision'

  const segmentPaths: string[] = []
  const cues: SubtitleCue[] = []
  let timeline = 0

  const foldersOrdered = (req.options.folderPaths as string[] | undefined) ?? []
  const categoryMode = req.options.categoryPickMode as string | undefined

  if (req.featureId === 'category-mix' && foldersOrdered.length > 1 && categoryMode) {
    for (let f = 0; f < foldersOrdered.length; f++) {
      const dir = foldersOrdered[f]!
      const vids = await scanVideosInDir(dir)
      if (!vids.length) continue
      const sentence = sentences[f % sentences.length] ?? sentences[0] ?? '片段'
      const file =
        categoryMode === 'sequential'
          ? vids[batchIndex % vids.length]!
          : pickRandom(vids)
      const audioPath = path.join(tmpDir, `cat_tts_${batchIndex}_${f}.mp3`)
      let segDur = 3
      if (ttsEnabled && sentence) {
        segDur = await synthesizeToFile(sentence, audioPath, req.options)
      }
      const vDur = await probeDuration(file)
      const clipPath = path.join(tmpDir, `cat_v_${batchIndex}_${f}.mp4`)
      await cutClipEncoded(file, pickStart(vDur, segDur), segDur, clipPath)
      const segOut = path.join(tmpDir, `cat_seg_${batchIndex}_${f}.mp4`)
      if (ttsEnabled) await mergeVideoAudio(clipPath, audioPath, segOut, originalVolume)
      else await fs.copyFile(clipPath, segOut)
      segmentPaths.push(segOut)
      cues.push({ text: sentence, startSec: timeline, endSec: timeline + segDur })
      timeline += segDur
    }
  } else {
    const lines = sentences.length ? sentences : ['混剪片段']
    for (let i = 0; i < lines.length; i++) {
      const sentence = lines[i]!
      report({ percent: 10 + i * 2, message: `匹配素材：${sentence.slice(0, 12)}…` })
      const file = useAiMatch
        ? await pickVideoForSentence(sentence, pool, matchMode, req.options)
        : pickRandom(pool)
      const audioPath = path.join(tmpDir, `tts_${batchIndex}_${i}.mp3`)
      let segDur = Math.min(
        Number(req.options.clipMaxSec ?? 5),
        Math.max(Number(req.options.clipMinSec ?? 2), 3),
      )
      if (ttsEnabled) {
        report({ percent: 15 + i * 3, message: `语音合成 ${i + 1}/${lines.length}` })
        segDur = await synthesizeToFile(sentence, audioPath, req.options)
      }
      const vDur = await probeDuration(file)
      const clipPath = path.join(tmpDir, `v_${batchIndex}_${i}.mp4`)
      await cutClipEncoded(file, pickStart(vDur, segDur), segDur, clipPath)
      const segOut = path.join(tmpDir, `seg_${batchIndex}_${i}.mp4`)
      if (ttsEnabled) await mergeVideoAudio(clipPath, audioPath, segOut, originalVolume)
      else await fs.copyFile(clipPath, segOut)
      segmentPaths.push(segOut)
      cues.push({ text: sentence, startSec: timeline, endSec: timeline + segDur })
      timeline += segDur
    }
  }

  if (!segmentPaths.length) throw new Error('未生成任何片段')

  const merged = path.join(tmpDir, `merged_${batchIndex}.mp4`)
  await concatReencode(segmentPaths, merged)

  const srtPath = path.join(tmpDir, `subs_${batchIndex}.srt`)
  await writeSrt(cues, srtPath)

  const preset = {
    fontSize: req.options.fontSize,
    fontFamily: req.options.fontFamily,
    textColor: req.options.textColor,
    strokeColor: req.options.strokeColor,
    strokeWidth: req.options.strokeWidth,
    fontOpacity: req.options.fontOpacity,
  }

  const withSubs = path.join(tmpDir, `subs_burned_${batchIndex}.mp4`)
  report({ percent: 92, message: '烧录字幕…' })
  await burnSubtitles(merged, srtPath, withSubs, preset).catch(async () => {
    await fs.copyFile(merged, withSubs)
  })

  const bgmEnabled = Boolean(req.options.bgmEnabled ?? false)
  const bgmPath = String(req.options.bgmPath ?? '')
  if (bgmEnabled && bgmPath) {
    report({ percent: 96, message: '混入背景音乐…' })
    await mixBackgroundMusic(
      withSubs,
      bgmPath,
      Number(req.options.bgmVolume ?? 30),
      out,
    ).catch(async () => {
      await fs.copyFile(withSubs, out)
    })
  } else {
    await fs.copyFile(withSubs, out)
  }

  if (externalAudio) {
    report({ percent: 98, message: '替换为导入配音…' })
    const dubbed = path.join(tmpDir, `dub_${batchIndex}.mp4`)
    await mergeVideoAudio(out, externalAudio, dubbed, originalVolume)
    await fs.copyFile(dubbed, out)
  }
}

export async function runRichMixJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<{ outputs: string[] }> {
  const pool = await resolvePool(req)
  if (!pool.length) throw new Error('素材库为空')

  const batchCount = Number(req.options.batchCount ?? 1)
  await ensureDir(req.outputDir)
  const tmpDir = path.join(os.tmpdir(), `eauto_rich_${Date.now()}`)
  await ensureDir(tmpDir)
  const outputs: string[] = []

  for (let i = 0; i < batchCount; i++) {
    report({
      percent: Math.floor((i / batchCount) * 85),
      message: `生成成片 ${i + 1}/${batchCount}`,
    })
    const out = path.join(req.outputDir, `mix_${Date.now()}_${i + 1}.mp4`)
    await buildRichMixVideo(req, out, tmpDir, i, report)
    outputs.push(out)
  }

  report({ percent: 100, message: '混剪完成' })
  return { outputs }
}
