import path from 'node:path'
import { getFfmpegPath, probeMediaMeta, type MediaProbe } from '../ffmpeg/util'
import { spawn } from 'node:child_process'

export interface QualityCheckItem {
  id: string
  ok: boolean
  detail: string
}

/** 内部制作质量分，用于挑选更可能过审的裂变条；不是巨量千川「优质」标签。 */
export interface OutputQualityReport {
  path: string
  name: string
  score: number
  grade: '优先上传' | '可上传' | '建议重制'
  warnings: string[]
  checks: QualityCheckItem[]
}

function spawnStderr(exe: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(exe, args, { windowsHide: true })
    let stderr = ''
    proc.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error('分析超时'))
    }, timeoutMs)
    proc.on('error', reject)
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 || stderr.length > 0) resolve(stderr)
      else reject(new Error('ffmpeg 分析失败'))
    })
  })
}

async function leadingBlackSec(file: string, scanSec = 4): Promise<number> {
  const stderr = await spawnStderr(
    getFfmpegPath(),
    [
      '-hide_banner',
      '-t',
      String(scanSec),
      '-i',
      file,
      '-vf',
      'blackdetect=d=0.12:pix_th=0.08',
      '-an',
      '-f',
      'null',
      '-',
    ],
    90_000,
  )
  let maxDur = 0
  for (const line of stderr.split('\n')) {
    const m = line.match(/black_duration:([\d.]+)/)
    if (m) maxDur = Math.max(maxDur, Number(m[1]))
  }
  return maxDur
}

async function meanLumaAt(file: string, atSec: number): Promise<number | null> {
  const stderr = await spawnStderr(
    getFfmpegPath(),
    [
      '-hide_banner',
      '-ss',
      String(Math.max(0, atSec)),
      '-i',
      file,
      '-frames:v',
      '1',
      '-vf',
      'signalstats,metadata=mode=print',
      '-an',
      '-f',
      'null',
      '-',
    ],
    90_000,
  )
  const m = stderr.match(/lavfi\.signalstats\.YAVG=([\d.]+)/)
  return m ? Number(m[1]) : null
}

async function blurLikelySoft(file: string): Promise<boolean> {
  const stderr = await spawnStderr(
    getFfmpegPath(),
    [
      '-hide_banner',
      '-t',
      '8',
      '-i',
      file,
      '-vf',
      'blurdetect=block=16:block_pct=0.82',
      '-an',
      '-f',
      'null',
      '-',
    ],
    120_000,
  )
  return /blur detected/i.test(stderr)
}

async function leadingSilenceSec(file: string, scanSec = 6): Promise<number> {
  const stderr = await spawnStderr(
    getFfmpegPath(),
    [
      '-hide_banner',
      '-t',
      String(scanSec),
      '-i',
      file,
      '-af',
      'silencedetect=noise=-32dB:d=0.4',
      '-f',
      'null',
      '-',
    ],
    90_000,
  )
  let start = 0
  for (const line of stderr.split('\n')) {
    const m = line.match(/silence_start:\s*([\d.]+)/)
    if (m) {
      const value = Number(m[1])
      if (value < 1.5) start = value
      break
    }
  }
  return start
}

function scoreFromMeta(
  meta: MediaProbe,
  blackSec: number,
  silenceStart: number,
  luma: { avg: number | null; min: number | null },
  blurSoft: boolean | null,
): OutputQualityReport {
  const checks: QualityCheckItem[] = []
  const warnings: string[] = []
  let score = 70

  const shortSide = Math.min(meta.width, meta.height)
  if (shortSide >= 720) {
    score += 8
    checks.push({ id: 'resolution', ok: true, detail: `${meta.width}×${meta.height}` })
  } else if (shortSide >= 540) {
    score += 3
    checks.push({ id: 'resolution', ok: true, detail: `${meta.width}×${meta.height}（可用但偏糊风险）` })
    warnings.push('分辨率偏低，优质素材更偏好 720p 以上短边')
  } else {
    score -= 12
    checks.push({ id: 'resolution', ok: false, detail: `${meta.width}×${meta.height}` })
    warnings.push('分辨率过低，建议换更高清母版')
  }

  if (meta.durationSec >= 5 && meta.durationSec <= 120) {
    score += 5
    checks.push({ id: 'duration', ok: true, detail: `${meta.durationSec.toFixed(1)} 秒` })
  } else {
    score -= 5
    checks.push({ id: 'duration', ok: false, detail: `${meta.durationSec.toFixed(1)} 秒` })
    warnings.push('时长过短或过长，投放素材常见为 5～120 秒')
  }

  if (meta.hasAudio) {
    score += 6
    checks.push({ id: 'audio', ok: true, detail: meta.audioCodec || '有音轨' })
  } else {
    score -= 8
    checks.push({ id: 'audio', ok: false, detail: '无音轨' })
    warnings.push('无音轨，千川素材常见为有声口播或 BGM')
  }

  if (blackSec < 0.35) {
    score += 5
    checks.push({ id: 'black_start', ok: true, detail: '片头无明显黑屏' })
  } else {
    score -= 10
    checks.push({ id: 'black_start', ok: false, detail: `片头黑屏约 ${blackSec.toFixed(2)} 秒` })
    warnings.push('片头黑屏过长，建议裁头或换封面帧')
  }

  if (silenceStart < 0.5 || !meta.hasAudio) {
    if (meta.hasAudio) {
      score += 4
      checks.push({ id: 'silence_start', ok: true, detail: '片头无明显长静音' })
    }
  } else {
    score -= 8
    checks.push({ id: 'silence_start', ok: false, detail: `片头静音从 ${silenceStart.toFixed(2)} 秒开始` })
    warnings.push('片头静音过长，口播/BGM 建议更早进入')
  }

  if (meta.fps >= 24 && meta.fps <= 60) {
    score += 3
    checks.push({ id: 'fps', ok: true, detail: `${meta.fps} fps` })
  } else {
    checks.push({ id: 'fps', ok: false, detail: `${meta.fps || '?'} fps` })
  }

  if (luma.avg != null) {
    if (luma.avg >= 55 && luma.avg <= 210) {
      score += 4
      checks.push({ id: 'luma', ok: true, detail: `平均亮度 Y≈${luma.avg.toFixed(0)}` })
    } else if (luma.avg >= 40) {
      score -= 4
      checks.push({ id: 'luma', ok: false, detail: `偏暗 Y≈${luma.avg.toFixed(0)}` })
      warnings.push('画面整体偏暗，优质素材更偏好明亮清晰')
    } else {
      score -= 10
      checks.push({ id: 'luma', ok: false, detail: `过暗 Y≈${luma.avg.toFixed(0)}` })
      warnings.push('画面过暗，建议补光或提高曝光后再裂变')
    }
    if (luma.min != null && luma.min < 35) {
      score -= 4
      warnings.push('部分片段亮度过低，可能存在死黑区域')
    }
  }

  if (blurSoft === true) {
    score -= 8
    checks.push({ id: 'blur', ok: false, detail: '检测到较多模糊帧' })
    warnings.push('画面偏糊，建议使用更高清母版或避免多次压缩')
  } else if (blurSoft === false) {
    score += 3
    checks.push({ id: 'blur', ok: true, detail: '清晰度正常' })
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  let grade: OutputQualityReport['grade'] = '建议重制'
  if (score >= 82) grade = '优先上传'
  else if (score >= 68) grade = '可上传'

  return {
    path: '',
    name: '',
    score,
    grade,
    warnings,
    checks,
  }
}

export async function inspectOutputVideo(filePath: string): Promise<OutputQualityReport> {
  const meta = await probeMediaMeta(filePath)
  let blackSec = 0
  let silenceStart = 0
  try {
    blackSec = await leadingBlackSec(filePath)
  } catch {
    /* 忽略单项失败 */
  }
  if (meta.hasAudio) {
    try {
      silenceStart = await leadingSilenceSec(filePath)
    } catch {
      /* ignore */
    }
  }
  const t1 = Math.min(Math.max(0.2, meta.durationSec * 0.12), meta.durationSec - 0.2)
  const t2 = Math.min(Math.max(0.5, meta.durationSec * 0.45), meta.durationSec - 0.2)
  let luma1: number | null = null
  let luma2: number | null = null
  try {
    luma1 = await meanLumaAt(filePath, t1)
    luma2 = await meanLumaAt(filePath, t2)
  } catch {
    /* ignore */
  }
  const avgLuma = luma1 != null && luma2 != null ? (luma1 + luma2) / 2 : luma1 ?? luma2
  const minLuma = luma1 != null && luma2 != null ? Math.min(luma1, luma2) : luma1 ?? luma2
  let blurSoft: boolean | null = null
  try {
    blurSoft = await blurLikelySoft(filePath)
  } catch {
    blurSoft = null
  }
  const report = scoreFromMeta(meta, blackSec, silenceStart, { avg: avgLuma, min: minLuma }, blurSoft)
  report.path = filePath
  report.name = path.basename(filePath)
  return report
}

const VIDEO_OUT = /\.(mp4|mov|m4v|webm)$/i

export async function inspectJobOutputs(
  outputs: string[],
  onProgress?: (message: string) => void,
): Promise<{ reports: OutputQualityReport[]; recommendation: string }> {
  const videos = outputs.filter((p) => VIDEO_OUT.test(p))
  const reports: OutputQualityReport[] = []
  for (let i = 0; i < videos.length; i++) {
    const file = videos[i]!
    onProgress?.(`制作质量分析 ${path.basename(file)}（${i + 1}/${videos.length}）…`)
    try {
      reports.push(await inspectOutputVideo(file))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reports.push({
        path: file,
        name: path.basename(file),
        score: 0,
        grade: '建议重制',
        warnings: [message],
        checks: [{ id: 'readable', ok: false, detail: message }],
      })
    }
  }
  reports.sort((a, b) => b.score - a.score)
  if (!reports.length) {
    return { reports, recommendation: '未生成可分析的 MP4，请检查导出设置。' }
  }
  const top = reports.filter((r) => r.grade === '优先上传')
  const lines = reports.map((r) => `${r.name} · 内部 ${r.score} 分 · ${r.grade}`)
  const hint =
    top.length > 0
      ? `建议上传顺序（内部制作分，非平台「优质」）：\n${lines.join('\n')}\n\n优先传：${top.map((r) => r.name).join(' → ')}`
      : `建议上传顺序（内部制作分，非平台「优质」）：\n${lines.join('\n')}\n\n暂无「优先上传」条，可先传得分最高的一条试投。`
  return { reports, recommendation: hint }
}
