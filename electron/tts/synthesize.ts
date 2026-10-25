import { EdgeTTS } from 'node-edge-tts'
import { probeDuration } from '../ffmpeg/util'

const VOICE_MAP: Record<string, string> = {
  '小何 2.0': 'zh-CN-YunxiNeural',
  云希: 'zh-CN-YunxiNeural',
  晓晓: 'zh-CN-XiaoxiaoNeural',
  '东北话-老铁': 'zh-CN-liaoning-XiaobeiNeural',
}

const LANG_MAP: Record<string, string> = {
  普通话: 'zh-CN',
  粤语: 'zh-HK',
  四川话: 'zh-CN',
  东北话: 'zh-CN',
}

export function splitScriptToSentences(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const parts = normalized
    .split(/(?<=[。！？!?；;\n])\s*|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts : [normalized]
}

function rateFromMultiplier(rate: number): string {
  const pct = Math.round((rate - 1) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

function volumeFromPercent(vol: number): string {
  const pct = Math.round(vol - 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

export async function synthesizeToFile(
  text: string,
  audioPath: string,
  options: Record<string, unknown>,
): Promise<number> {
  const voiceName = String(options.ttsVoice ?? '小何 2.0')
  const dialect = String(options.ttsDialect ?? '普通话')
  const rate = Number(options.ttsRate ?? 1)
  const volume = Number(options.ttsVolume ?? 100)

  const tts = new EdgeTTS({
    voice: VOICE_MAP[voiceName] ?? 'zh-CN-YunxiNeural',
    lang: LANG_MAP[dialect] ?? 'zh-CN',
    outputFormat: 'audio-24khz-96kbitrate-mp3',
    rate: rateFromMultiplier(rate),
    volume: volumeFromPercent(volume),
    timeout: 120000,
  })

  await tts.ttsPromise(text, audioPath)
  return probeDuration(audioPath)
}
