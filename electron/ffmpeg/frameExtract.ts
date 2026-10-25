import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { runFfmpeg, probeDuration } from './util'

/** 在视频某时间点导出 JPEG 帧，供 CLIP / Vision 使用 */
export async function extractVideoFrame(
  videoPath: string,
  ratio = 0.35,
): Promise<string> {
  const dur = await probeDuration(videoPath)
  const ss = Math.max(0, Math.min(dur - 0.1, dur * ratio))
  const out = path.join(
    os.tmpdir(),
    `eauto_frame_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
  )
  await runFfmpeg([
    '-y',
    '-ss',
    String(ss),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    out,
  ])
  await fs.access(out)
  return out
}

export async function readFileBase64(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  return buf.toString('base64')
}
