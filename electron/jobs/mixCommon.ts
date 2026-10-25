import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { FeatureJobRequest, ProgressReporter } from './types'
import { mixBackgroundMusic } from '../ffmpeg/bgm'
import { applyOutputFormat } from '../ffmpeg/postProcess'
import { runFfmpeg } from '../ffmpeg/util'

export function outputSize(options: Record<string, unknown>) {
  const preset = String(options.outputPreset ?? '9:16')
  if (preset === '16:9') return { width: 1920, height: 1080 }
  if (preset === '1:1') return { width: 1080, height: 1080 }
  if (preset === 'original') return { width: 0, height: 0 }
  return {
    width: Number(options.outputWidth ?? 1080),
    height: Number(options.outputHeight ?? 1920),
  }
}

export async function cutClip(
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

export async function mergeAv(video: string, audio: string, out: string): Promise<void> {
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

export async function concatVideos(clips: string[], out: string): Promise<void> {
  const list = path.join(os.tmpdir(), `mix_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`)
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

export function pickStart(duration: number, clipLen: number): number {
  return Math.max(0, Math.random() * Math.max(0.1, duration - clipLen))
}

export async function applyPostAndBgm(
  req: FeatureJobRequest,
  working: string,
  tmpDir: string,
  batchIndex: number,
  report: ProgressReporter,
): Promise<string> {
  let current = working

  if (Boolean(req.options.bgmEnabled) && req.options.bgmPath) {
    report({ percent: 92, message: '混入背景音乐…' })
    const withBgm = path.join(tmpDir, `mix_bgm_${batchIndex}.mp4`)
    await mixBackgroundMusic(
      current,
      String(req.options.bgmPath),
      Number(req.options.bgmVolume ?? 30),
      withBgm,
    ).catch(async () => fs.copyFile(current, withBgm))
    current = withBgm
  }

  const { width, height } = outputSize(req.options)
  const finalPath = path.join(tmpDir, `mix_fmt_${batchIndex}.mp4`)
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
