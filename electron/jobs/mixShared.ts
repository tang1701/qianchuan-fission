import type { FeatureJobRequest } from './types'
import { scanVideosInDir } from '../ffmpeg/util'

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export async function resolvePool(req: FeatureJobRequest): Promise<string[]> {
  const folderPaths = (req.options.folderPaths as string[] | undefined) ?? []
  const pool: string[] = [...req.inputs]
  for (const dir of folderPaths) {
    if (dir) pool.push(...(await scanVideosInDir(dir)))
  }
  return [...new Set(pool)]
}

export function shouldUseRichPipeline(req: FeatureJobRequest): boolean {
  const script = String(req.options.scriptText ?? '').trim()
  const audio = String(req.options.scriptAudioPath ?? '').trim()
  const tts = Boolean(req.options.ttsEnabled ?? false)
  if (audio) return true
  if (!script) return false
  if (req.featureId === 'ai-mix') return true
  if (req.featureId === 'category-mix') return true
  if (tts && ['video-mix', 'drama-mix'].includes(req.featureId)) return true
  return false
}
