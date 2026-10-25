import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { burnSubtitles, writeSrt, type SubtitleCue } from '../ffmpeg/subtitles'
import { splitScriptToSentences, synthesizeToFile } from '../tts/synthesize'
import { ensureDir, probeDuration } from '../ffmpeg/util'
import { resolvePool } from './mixShared'
import {
  applyPostAndBgm,
  concatVideos,
  cutClip,
  mergeAv,
  pickStart,
} from './mixCommon'

function sortEpisodes(pool: string[], order: string): string[] {
  const list = [...pool]
  if (order === 'shuffle') {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j]!, list[i]!]
    }
    return list
  }
  return list.sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'zh-CN'))
}

async function buildDramaLine(
  req: FeatureJobRequest,
  lineIndex: number,
  tmpDir: string,
  report: ProgressReporter,
): Promise<string> {
  const pool = await resolvePool(req)
  const ordered = sortEpisodes(pool, String(req.options.episodeOrder ?? 'asc'))
  const mode = String(req.options.dramaMode ?? 'highlight')
  const clipCount = mode === 'plot' ? 12 : 6
  const clipMin = mode === 'plot' ? 4 : 2
  const clipMax = mode === 'plot' ? 10 : 5

  const script = String(req.options.scriptText ?? '').trim()
  const sentences = splitScriptToSentences(script)
  const ttsOn = Boolean(req.options.ttsEnabled ?? true) && script.length > 0
  const vol = Number(req.options.originalVolume ?? 100)
  const keepAudio = Boolean(req.options.keepOriginalAudio ?? false)

  const clips: string[] = []
  const cues: SubtitleCue[] = []
  let timeline = 0

  for (let c = 0; c < clipCount; c++) {
    const file = ordered[c % ordered.length]!
    const sentence = sentences[c % Math.max(1, sentences.length)] ?? `第 ${c + 1} 镜`
    const vDur = await probeDuration(file)
    const len = Math.min(clipMax, Math.max(clipMin, clipMin + Math.random() * (clipMax - clipMin)))
    const clipPath = path.join(tmpDir, `drama_${lineIndex}_${c}.mp4`)

    if (ttsOn) {
      const audioPath = path.join(tmpDir, `drama_tts_${lineIndex}_${c}.mp3`)
      const segDur = await synthesizeToFile(sentence, audioPath, req.options)
      await cutClip(file, pickStart(vDur, segDur), segDur, clipPath, false, vol)
      const segOut = path.join(tmpDir, `drama_seg_${lineIndex}_${c}.mp4`)
      await mergeAv(clipPath, audioPath, segOut)
      clips.push(segOut)
      cues.push({ text: sentence, startSec: timeline, endSec: timeline + segDur })
      timeline += segDur
    } else {
      await cutClip(file, pickStart(vDur, len), len, clipPath, keepAudio, vol)
      clips.push(clipPath)
      cues.push({ text: sentence, startSec: timeline, endSec: timeline + len })
      timeline += len
    }
    report({
      percent: 15 + Math.floor((c / clipCount) * 55),
      message: `剧情线 ${lineIndex + 1} · 镜头 ${c + 1}/${clipCount}`,
    })
  }

  const merged = path.join(tmpDir, `drama_m_${lineIndex}.mp4`)
  await concatVideos(clips, merged)

  let working = merged
  if (script && ttsOn) {
    const srt = path.join(tmpDir, `drama_${lineIndex}.srt`)
    await writeSrt(cues, srt)
    const subbed = path.join(tmpDir, `drama_sub_${lineIndex}.mp4`)
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

  return applyPostAndBgm(req, working, tmpDir, lineIndex, report)
}

export async function runDramaMixJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  if (!(await resolvePool(req)).length) {
    return { ok: false, error: '请导入短剧视频或文件夹' }
  }

  const lines = Number(req.options.dramaLines ?? 3)
  await ensureDir(req.outputDir)
  const tmpDir = path.join(os.tmpdir(), `eauto_drama_${Date.now()}`)
  await ensureDir(tmpDir)
  const outputs: string[] = []

  for (let i = 0; i < lines; i++) {
    report({
      percent: Math.floor((i / lines) * 85),
      message: `生成剧情线 ${i + 1}/${lines}`,
    })
    const final = await buildDramaLine(req, i, tmpDir, report)
    const dest = path.join(req.outputDir, `短剧混剪_线${i + 1}_${Date.now()}.mp4`)
    await fs.copyFile(final, dest)
    outputs.push(dest)
  }

  report({ percent: 100, message: '短剧混剪完成' })
  return { ok: true, outputs }
}
