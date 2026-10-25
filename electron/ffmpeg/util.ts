import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)

export const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'])

export function getFfmpegPath(): string {
  const ffmpegPath = require('ffmpeg-static') as string | null
  if (!ffmpegPath) throw new Error('未找到 ffmpeg 可执行文件')
  return ffmpegPath
}

export function getFfprobePath(): string {
  const ffprobe = require('ffprobe-static') as { path: string }
  return ffprobe.path
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function scanVideosInDir(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string) {
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (VIDEO_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full)
    }
  }
  await walk(dir)
  return out.sort()
}

const FFPROBE_FAST = ['-probesize', '32M', '-analyzeduration', '5M'] as const

function spawnCollect(
  exe: string,
  args: string[],
  timeoutMs: number,
  label: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(exe, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => {
      stdout += String(d)
    })
    proc.stderr?.on('data', (d) => {
      stderr += String(d)
    })
    proc.on('error', (err) => reject(err))
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error(`${label} 超时（${Math.round(timeoutMs / 1000)}s），请检查视频文件是否损坏或路径是否正确`))
    }, timeoutMs)
    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, code })
    })
  })
}

export async function probeDuration(filePath: string): Promise<number> {
  const { stdout, stderr, code } = await spawnCollect(
    getFfprobePath(),
    [
      ...FFPROBE_FAST,
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    90_000,
    'ffprobe 读取时长',
  )
  if (code !== 0) {
    throw new Error(`ffprobe 失败: ${path.basename(filePath)} — ${stderr.slice(-200) || code}`)
  }
  const dur = parseFloat(stdout.trim())
  if (!Number.isFinite(dur) || dur <= 0) {
    throw new Error(`无法读取视频时长: ${path.basename(filePath)}`)
  }
  return dur
}

export interface VideoStreamInfo {
  width: number
  height: number
  /** bits/s；探测不到时为 0 */
  bitRate: number
}

export async function probeVideoStream(filePath: string): Promise<VideoStreamInfo> {
  const { stdout, stderr, code } = await spawnCollect(
    getFfprobePath(),
    [
      ...FFPROBE_FAST,
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,bit_rate',
      '-show_entries',
      'format=bit_rate',
      '-of',
      'json',
      filePath,
    ],
    90_000,
    'ffprobe 读取视频流',
  )
  if (code !== 0) {
    throw new Error(`ffprobe 失败: ${path.basename(filePath)} — ${stderr.slice(-200) || code}`)
  }
  let width = 1920
  let height = 1080
  let bitRate = 0
  try {
    const j = JSON.parse(stdout) as {
      streams?: { width?: number; height?: number; bit_rate?: string }[]
      format?: { bit_rate?: string }
    }
    const s = j.streams?.[0]
    if (s?.width) width = s.width
    if (s?.height) height = s.height
    const streamBr = Number(s?.bit_rate)
    const formatBr = Number(j.format?.bit_rate)
    if (Number.isFinite(streamBr) && streamBr > 0) bitRate = streamBr
    else if (Number.isFinite(formatBr) && formatBr > 0) bitRate = formatBr
  } catch {
    /* fallback below */
  }
  if (!bitRate) {
    try {
      const st = await fs.stat(filePath)
      const dur = await probeDuration(filePath)
      if (dur > 0 && st.size > 0) {
        bitRate = Math.round((st.size * 8 * 0.92) / dur)
      }
    } catch {
      /* ignore */
    }
  }
  return { width, height, bitRate }
}

export interface MediaProbe {
  durationSec: number
  width: number
  height: number
  fps: number
  videoCodec: string
  audioCodec: string
  hasAudio: boolean
  container: string
}

function parseFps(rate: unknown): number {
  const text = String(rate ?? '')
  if (text.includes('/')) {
    const [num, den] = text.split('/').map(Number)
    if (den) return Math.round((num / den) * 1000) / 1000
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : 0
}

export async function probeMediaMeta(filePath: string): Promise<MediaProbe> {
  const { stdout, code } = await spawnCollect(
    getFfprobePath(),
    [...FFPROBE_FAST, '-v', 'error', '-show_format', '-show_streams', '-of', 'json', filePath],
    90_000,
    'ffprobe 读取媒体信息',
  )
  if (code !== 0) {
    throw new Error(`无法读取视频参数，文件可能已损坏：${path.basename(filePath)}`)
  }
  let parsed: {
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string; duration?: string }[]
    format?: { duration?: string; format_name?: string }
  }
  try {
    parsed = JSON.parse(stdout) as typeof parsed
  } catch {
    throw new Error(`无法读取视频参数，文件可能已损坏：${path.basename(filePath)}`)
  }
  const video = parsed.streams?.find((stream) => stream.codec_type === 'video')
  const audio = parsed.streams?.find((stream) => stream.codec_type === 'audio')
  const durationSec = Number(parsed.format?.duration || video?.duration || 0)
  const width = Number(video?.width || 0)
  const height = Number(video?.height || 0)
  if (!video || !width || !height || !Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`无法读取视频参数，文件可能已损坏：${path.basename(filePath)}`)
  }
  return {
    durationSec,
    width,
    height,
    fps: parseFps(video.avg_frame_rate || video.r_frame_rate),
    videoCodec: video.codec_name || '',
    audioCodec: audio?.codec_name || '',
    hasAudio: Boolean(audio),
    container: parsed.format?.format_name || '',
  }
}

export async function probeSize(filePath: string): Promise<{ width: number; height: number }> {
  const { stdout, stderr, code } = await spawnCollect(
    getFfprobePath(),
    [
      ...FFPROBE_FAST,
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0:s=x',
      filePath,
    ],
    90_000,
    'ffprobe 读取分辨率',
  )
  if (code !== 0) {
    throw new Error(`ffprobe 失败: ${path.basename(filePath)} — ${stderr.slice(-200) || code}`)
  }
  const [w, h] = stdout.trim().split('x').map(Number)
  return { width: w || 1920, height: h || 1080 }
}

export function runFfmpeg(
  args: string[],
  onProgress?: (ratio: number, message: string) => void,
  durationHint?: number,
  timeoutMs = 3_600_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getFfmpegPath(), args, { windowsHide: true })
    let stderr = ''
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      finish(() => reject(new Error('ffmpeg 编码超时，请减少效果或缩短素材后重试')))
    }, timeoutMs)
    proc.stderr.on('data', (chunk) => {
      const text = String(chunk)
      stderr += text
      if (onProgress && durationHint && durationHint > 0) {
        const m = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/)
        if (m) {
          const sec =
            Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
          onProgress(Math.min(0.99, sec / durationHint), `编码中 ${m[0]}`)
        }
      }
    })
    proc.on('error', (err) => finish(() => reject(err)))
    proc.on('close', (code) => {
      if (code === 0) finish(() => resolve())
      else finish(() => reject(new Error(stderr.slice(-800) || `ffmpeg 退出码 ${code}`)))
    })
  })
}

export function safeBaseName(filePath: string) {
  return path.parse(filePath).name
}
