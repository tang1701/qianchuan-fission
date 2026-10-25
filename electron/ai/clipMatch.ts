import path from 'node:path'
import fs from 'node:fs/promises'
import { app } from 'electron'
import { extractVideoFrame } from '../ffmpeg/frameExtract'

type ClipPipeline = (
  image: string,
  labels: string[],
) => Promise<{ label: string; score: number }[]>

let classifierPromise: Promise<ClipPipeline> | null = null

async function getClassifier(): Promise<ClipPipeline> {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers')
      env.cacheDir = path.join(app.getPath('userData'), 'transformers-cache')
      env.allowLocalModels = true
      const clf = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32')
      return (image, labels) => clf(image, labels) as Promise<{ label: string; score: number }[]>
    })()
  }
  return classifierPromise
}

/** 本地 CLIP：对素材池抽帧，与文案句做 zero-shot 相似度 */
export async function pickVideoByClip(sentence: string, pool: string[]): Promise<string> {
  if (!pool.length) throw new Error('素材池为空')
  const label = sentence.slice(0, 220).trim() || '短视频画面'
  const negative = '无关的随机画面'
  const classifier = await getClassifier()

  let best = pool[0]!
  let bestScore = -1
  const sample = pool.slice(0, 16)

  for (const file of sample) {
    let frame = ''
    try {
      frame = await extractVideoFrame(file, 0.35)
      const scores = await classifier(frame, [label, negative])
      const hit = scores.find((s) => s.label === label)?.score ?? scores[0]?.score ?? 0
      if (hit > bestScore) {
        bestScore = hit
        best = file
      }
    } catch {
      // 单文件失败跳过
    } finally {
      if (frame) await fs.unlink(frame).catch(() => {})
    }
  }

  return best
}
