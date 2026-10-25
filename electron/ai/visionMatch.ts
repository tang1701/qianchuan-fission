import path from 'node:path'
import fs from 'node:fs/promises'
import { aiConfigFromJobOptions, chatCompletion } from './providers'
import { extractVideoFrame, readFileBase64 } from '../ffmpeg/frameExtract'

/** Vision API：多图选一，最匹配文案的素材 */
export async function pickVideoByVision(
  sentence: string,
  pool: string[],
  options: Record<string, unknown>,
): Promise<string> {
  if (!pool.length) throw new Error('素材池为空')
  const cfg = aiConfigFromJobOptions(options)
  if (!cfg.apiKey && cfg.llmProvider !== 'ollama') {
    throw new Error('Vision 选镜需要配置 API Key（全局设置）')
  }

  const sample = pool.slice(0, 8)
  const frames: { file: string; b64: string; name: string }[] = []

  for (const file of sample) {
    let frame = ''
    try {
      frame = await extractVideoFrame(file, 0.4)
      const b64 = await readFileBase64(frame)
      frames.push({ file, b64, name: path.basename(file) })
    } catch {
      // skip
    } finally {
      if (frame) await fs.unlink(frame).catch(() => {})
    }
  }

  if (!frames.length) return pool[0]!

  const content: unknown[] = [
    {
      type: 'text',
      text:
        `你是短视频剪辑助手。下面 ${frames.length} 张图来自不同素材（编号 0~${frames.length - 1}）。` +
        `口播文案：「${sentence.slice(0, 500)}」` +
        `请只回复最匹配的一位的编号数字，不要解释。`,
    },
  ]

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!
    content.push({ type: 'text', text: `[${i}] ${f.name}` })
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${f.b64}` },
    })
  }

  const raw = await chatCompletion(cfg, [{ role: 'user', content }], 0.2)
  const m = raw.match(/\d+/)
  const idx = m ? Math.min(frames.length - 1, Math.max(0, parseInt(m[0]!, 10))) : 0
  return frames[idx]?.file ?? pool[0]!
}
