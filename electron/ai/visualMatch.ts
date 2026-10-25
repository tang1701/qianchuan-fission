import path from 'node:path'
import { detectSceneTimes } from '../ffmpeg/scenes'
import { probeDuration } from '../ffmpeg/util'
import { pickVideoForSentence } from './semanticMatch'

export interface ClipPlan {
  file: string
  start: number
  duration: number
}

function shotsFromScenes(duration: number, scenes: number[]): Array<{ start: number; end: number }> {
  if (!scenes.length) return [{ start: 0, end: duration }]
  const pts = [0, ...scenes.filter((t) => t > 0 && t < duration), duration]
  const shots: Array<{ start: number; end: number }> = []
  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i]!
    const end = pts[i + 1]!
    if (end - start > 0.3) shots.push({ start, end })
  }
  return shots.length ? shots : [{ start: 0, end: duration }]
}

/** 为单句文案选择视频与起止点（镜头级，贴近「视频理解」选片） */
export async function planClipForSentence(
  sentence: string,
  pool: string[],
  targetDuration: number,
  mode: import('./semanticMatch').MatchMode,
  jobOptions: Record<string, unknown>,
  usedStarts: Map<string, number[]>,
): Promise<ClipPlan> {
  const file = await pickVideoForSentence(sentence, pool, mode, jobOptions)
  const duration = await probeDuration(file)
  let scenes: number[] = []
  try {
    scenes = await detectSceneTimes(file, 0.32)
  } catch {
    scenes = []
  }
  const shots = shotsFromScenes(duration, scenes)
  const used = usedStarts.get(file) ?? []

  let best: ClipPlan = { file, start: 0, duration: Math.min(targetDuration, duration) }
  let bestScore = -Infinity

  for (const shot of shots) {
    const shotLen = shot.end - shot.start
    const clipLen = Math.min(targetDuration, shotLen, duration)
    if (clipLen < 0.5) continue

    const maxStart = Math.max(shot.start, shot.end - clipLen)
    const candidates = [
      shot.start,
      shot.start + (shotLen - clipLen) / 2,
      maxStart,
    ]

    for (const start of candidates) {
      const overlapPenalty = used.filter((s) => Math.abs(s - start) < 1.5).length * 0.5
      const fitScore = -Math.abs(shotLen - targetDuration)
      const score = fitScore - overlapPenalty
      if (score > bestScore) {
        bestScore = score
        best = { file, start, duration: clipLen }
      }
    }
  }

  used.push(best.start)
  usedStarts.set(file, used)
  return best
}

export function poolBasenameSummary(pool: string[]): string {
  return pool.slice(0, 3).map((p) => path.basename(p)).join(', ')
}
