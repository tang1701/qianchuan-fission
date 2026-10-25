import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { pickVideoForSentence } from '../ai/semanticMatch'
import { burnSubtitles, writeSrt, type SubtitleCue } from '../ffmpeg/subtitles'
import { splitScriptToSentences, synthesizeToFile } from '../tts/synthesize'
import { ensureDir, probeDuration, scanVideosInDir } from '../ffmpeg/util'
import { pickRandom } from './mixShared'
import {
  applyPostAndBgm,
  concatVideos,
  cutClip,
  mergeAv,
  pickStart,
} from './mixCommon'

async function buildOneCategoryMix(
  req: FeatureJobRequest,
  batchIndex: number,
  tmpDir: string,
  report: ProgressReporter,
): Promise<string> {
  const foldersOrdered = (req.options.folderPaths as string[] | undefined)?.filter(Boolean) ?? []
  if (!foldersOrdered.length) throw new Error('请按分类导入至少一个文件夹')

  const categoryMode = String(req.options.categoryPickMode ?? 'random')
  const script = String(req.options.scriptText ?? '').trim()
  const externalAudio = String(req.options.scriptAudioPath ?? '').trim()
  const sentences = splitScriptToSentences(script)
  const matchMode = (req.options.matchMode as import('../ai/semanticMatch').MatchMode) ?? 'local'
  const ttsOn = Boolean(req.options.ttsEnabled ?? true) && !externalAudio
  const keepAudio = Boolean(req.options.keepOriginalAudio ?? false)
  const vol = Number(req.options.originalVolume ?? 100)
  const clipMin = Number(req.options.clipMinSec ?? 2)
  const clipMax = Number(req.options.clipMaxSec ?? 8)

  const segmentPaths: string[] = []
  const cues: SubtitleCue[] = []
  let timeline = 0

  for (let f = 0; f < foldersOrdered.length; f++) {
    const dir = foldersOrdered[f]!
    const vids = await scanVideosInDir(dir)
    if (!vids.length) {
      report({ percent: 10 + f * 5, message: `跳过空文件夹：${path.basename(dir)}` })
      continue
    }

    const sentence =
      sentences[f] ?? sentences[f % Math.max(1, sentences.length)] ?? `分类镜头 ${f + 1}`
    report({ percent: 12 + f * 6, message: `分类 ${f + 1}/${foldersOrdered.length} · ${path.basename(dir)}` })

    const file =
      categoryMode === 'sequential'
        ? vids[batchIndex % vids.length]!
        : pickRandom(vids)

    const pickFile = script
      ? await pickVideoForSentence(sentence, vids, matchMode, req.options)
      : file

    const audioPath = path.join(tmpDir, `cat_tts_${batchIndex}_${f}.mp3`)
    let segDur = Math.min(clipMax, Math.max(clipMin, 4))

    if (ttsOn && script) {
      segDur = await synthesizeToFile(sentence, audioPath, req.options)
    }

    const vDur = await probeDuration(pickFile)
    const clipPath = path.join(tmpDir, `cat_clip_${batchIndex}_${f}.mp4`)
    await cutClip(
      pickFile,
      pickStart(vDur, segDur),
      segDur,
      clipPath,
      keepAudio && !ttsOn,
      vol,
    )

    const segOut = path.join(tmpDir, `cat_seg_${batchIndex}_${f}.mp4`)
    if (ttsOn && script) await mergeAv(clipPath, audioPath, segOut)
    else await fs.copyFile(clipPath, segOut)

    segmentPaths.push(segOut)
    const actual = await probeDuration(segOut)
    cues.push({ text: sentence, startSec: timeline, endSec: timeline + actual })
    timeline += actual
  }

  if (!segmentPaths.length) throw new Error('所有分类文件夹均无视频')

  const merged = path.join(tmpDir, `cat_merged_${batchIndex}.mp4`)
  await concatVideos(segmentPaths, merged)

  let working = merged
  if (externalAudio) {
    const dubbed = path.join(tmpDir, `cat_dub_${batchIndex}.mp4`)
    await mergeAv(merged, externalAudio, dubbed)
    working = dubbed
  }

  if (script && ttsOn) {
    const srt = path.join(tmpDir, `cat_${batchIndex}.srt`)
    await writeSrt(cues, srt)
    const subbed = path.join(tmpDir, `cat_sub_${batchIndex}.mp4`)
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

export async function runCategoryMixJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  const folders = (req.options.folderPaths as string[] | undefined)?.filter(Boolean) ?? []
  if (!folders.length) {
    return { ok: false, error: '请导入分类文件夹并调整顺序（拖拽或按钮）' }
  }

  const batchCount = Number(req.options.batchCount ?? 1)
  await ensureDir(req.outputDir)
  const tmpDir = path.join(os.tmpdir(), `eauto_cat_mix_${Date.now()}`)
  await ensureDir(tmpDir)
  const outputs: string[] = []

  for (let i = 0; i < batchCount; i++) {
    report({
      percent: Math.floor((i / batchCount) * 85),
      message: `分类混剪 ${i + 1}/${batchCount}`,
    })
    const final = await buildOneCategoryMix(req, i, tmpDir, report)
    const dest = path.join(req.outputDir, `分类混剪_${Date.now()}_${i + 1}.mp4`)
    await fs.copyFile(final, dest)
    outputs.push(dest)
  }

  report({ percent: 100, message: '分类混剪完成' })
  return { ok: true, outputs }
}
