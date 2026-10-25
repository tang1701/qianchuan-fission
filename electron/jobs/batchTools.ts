import path from 'node:path'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { buildInpaintFilter } from '../ffmpeg/inpaintWatermark'
import {
  ensureDir,
  probeDuration,
  probeSize,
  runFfmpeg,
  safeBaseName,
} from '../ffmpeg/util'

function cropFilter(width: number, height: number): string {
  return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
}

export async function runBatchToolJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  const { featureId, inputs, outputDir, options } = req
  await ensureDir(outputDir)
  const outputs: string[] = []
  const total = inputs.length

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]
    const base = safeBaseName(input)
    const stepBase = ((i / total) * 100) | 0

    report({ percent: stepBase, message: `处理 ${i + 1}/${total}: ${base}` })

    try {
      if (featureId === 'batch-crop') {
        const w = Number(options.cropWidth ?? 1080)
        const h = Number(options.cropHeight ?? 1920)
        const out = path.join(outputDir, `${base}_crop_${w}x${h}.mp4`)
        const dur = await probeDuration(input)
        await runFfmpeg(
          ['-y', '-i', input, '-vf', cropFilter(w, h), '-c:a', 'copy', out],
          (r, msg) =>
            report({
              percent: stepBase + Math.floor(r * (100 / total)),
              message: msg,
            }),
          dur,
        )
        outputs.push(out)
      } else if (featureId === 'audio-extract') {
        const fmt = String(options.audioFormat ?? 'mp3')
        const br = Number(options.audioBitrate ?? 192)
        const out = path.join(outputDir, `${base}.${fmt}`)
        const dur = await probeDuration(input)
        const codec = fmt === 'wav' ? 'pcm_s16le' : fmt === 'aac' ? 'aac' : 'libmp3lame'
        const args = ['-y', '-i', input, '-vn', '-acodec', codec, out]
        if (fmt === 'mp3' || fmt === 'aac') args.splice(6, 0, '-b:a', `${br}k`)
        await runFfmpeg(
          args,
          (r, msg) =>
            report({
              percent: stepBase + Math.floor(r * (100 / total)),
              message: msg,
            }),
          dur,
        )
        outputs.push(out)
      } else if (featureId === 'subtitle-erase') {
        const { width, height } = await probeSize(input)
        const topPct = Number(options.eraseTop ?? 82) / 100
        const heightPct = Number(options.eraseHeight ?? 14) / 100
        const y = Math.max(0, Math.floor(height * topPct))
        const h = Math.max(8, Math.floor(height * heightPct))
        const out = path.join(outputDir, `${base}_erase.mp4`)
        const useInpaint = options.eraseRemoveMode === 'inpaint'
        const dur = await probeDuration(input)
        const ffArgs = ['-y', '-i', input]
        if (useInpaint) {
          const fc = buildInpaintFilter(
            Number(options.eraseTop ?? 82),
            Number(options.eraseHeight ?? 14),
            0,
            100,
            width,
            height,
          )
          ffArgs.push('-filter_complex', `${fc};[wmout]copy[vout]`, '-map', '[vout]', '-map', '0:a?')
          ffArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'copy', out)
        } else {
          const delogo = `delogo=x=0:y=${y}:w=${width}:h=${h}:show=0`
          ffArgs.push('-vf', delogo, '-c:a', 'copy', out)
        }
        await runFfmpeg(
          ffArgs,
          (r, msg) =>
            report({
              percent: stepBase + Math.floor(r * (100 / total)),
              message: msg,
            }),
          dur,
        )
        outputs.push(out)
      } else if (featureId === 'md5-diff') {
        const versions = Number(options.batchCount ?? 3)
        const mirror = Boolean(options.md5Mirror ?? true)
        const dropFrame = Boolean(options.md5DropFrame ?? true)
        const brightness = Number(options.md5Brightness ?? 102) / 100
        for (let v = 0; v < versions; v++) {
          const out = path.join(outputDir, `${base}_v${v + 1}.mp4`)
          const filters: string[] = []
          if (mirror && v % 2 === 0) filters.push('hflip')
          if (dropFrame) filters.push(`select='not(mod(n,${2 + (v % 3)}))'`, 'setpts=N/FRAME_RATE/TB')
          filters.push(`eq=brightness=${(brightness - 1).toFixed(3)}`)
          const vf = filters.join(',')
          const dur = await probeDuration(input)
          await runFfmpeg(
            ['-y', '-i', input, '-vf', vf, '-c:a', 'copy', out],
            (r, msg) =>
              report({
                percent: stepBase + Math.floor(r * (100 / total / versions)),
                message: msg,
              }),
            dur,
          )
          outputs.push(out)
        }
      } else {
        return { ok: false, error: `未知效率工具: ${featureId}` }
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), outputs }
    }
  }

  report({ percent: 100, message: '完成' })
  return { ok: true, outputs }
}
