import { runFfmpeg } from './util'

export async function applyOutputFormat(
  input: string,
  output: string,
  options: {
    width?: number
    height?: number
    fps?: number
    brightness?: number
    removeBlackBar?: boolean
  },
): Promise<void> {
  const w = Number(options.width ?? 0)
  const h = Number(options.height ?? 0)
  const fps = Number(options.fps ?? 0)
  const brightness = Number(options.brightness ?? 100) / 100
  const filters: string[] = []

  if (options.removeBlackBar && w > 0 && h > 0) {
    filters.push(`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`)
  } else if (w > 0 && h > 0) {
    filters.push(
      `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
    )
  }

  if (brightness !== 1) filters.push(`eq=brightness=${(brightness - 1).toFixed(3)}`)

  const args = ['-y', '-i', input]
  if (filters.length) args.push('-vf', filters.join(','))
  if (fps > 0) args.push('-r', String(fps))
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-c:a', 'aac', output)

  await runFfmpeg(args)
}
