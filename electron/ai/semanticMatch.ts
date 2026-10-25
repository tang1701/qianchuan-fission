import path from 'node:path'
import { pickVideoByClip } from './clipMatch'
import { pickVideoByVision } from './visionMatch'
import { aiConfigFromJobOptions, createEmbedding } from './providers'

export type MatchMode = 'local' | 'cloud' | 'clip' | 'vision'

const CN_STOP = new Set(['的', '了', '是', '在', '和', '与', '就', '也', '还', '这', '那', '一个', '我们', '你们'])

function tokens(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const chars = [...text.replace(/\s+/g, '')].filter((c) => !CN_STOP.has(c))
  return [...new Set([...words, ...chars.filter((c) => c.length > 1), ...chars])]
}

function scoreByFilename(sentence: string, filePath: string): number {
  const name = path.basename(filePath, path.extname(filePath)).toLowerCase()
  const keys = tokens(sentence)
  let score = 0
  for (const k of keys) {
    if (k.length < 2 && !/^\p{Script=Han}$/u.test(k)) continue
    if (name.includes(k.toLowerCase())) score += k.length
  }
  return score + Math.random() * 0.01
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8)
}

export async function pickVideoForSentence(
  sentence: string,
  pool: string[],
  mode: MatchMode,
  jobOptions: Record<string, unknown> = {},
): Promise<string> {
  if (!pool.length) throw new Error('素材池为空')

  if (mode === 'clip') {
    try {
      return await pickVideoByClip(sentence, pool)
    } catch {
      // 回退文件名
    }
  }

  if (mode === 'vision') {
    try {
      return await pickVideoByVision(sentence, pool, jobOptions)
    } catch {
      // 回退
    }
  }

  const cfg = aiConfigFromJobOptions(jobOptions)

  if (mode === 'cloud' && cfg.apiKey) {
    try {
      const sentenceEmb = await createEmbedding(cfg, sentence)
      let best = pool[0]!
      let bestScore = -1
      for (const file of pool.slice(0, 40)) {
        const label = path.basename(file)
        const emb = await createEmbedding(cfg, `${label}. ${sentence.slice(0, 200)}`)
        const sim = cosine(sentenceEmb, emb)
        if (sim > bestScore) {
          bestScore = sim
          best = file
        }
      }
      return best
    } catch {
      // 回退启发式
    }
  }

  let best = pool[0]!
  let bestScore = -1
  for (const file of pool) {
    const s = scoreByFilename(sentence, file)
    if (s > bestScore) {
      bestScore = s
      best = file
    }
  }
  return best
}
