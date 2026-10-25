import { probeSize } from './util'

/** 模糊填充式「智能去水印」（非深度学习，比 delogo 更柔和） */
export function buildInpaintFilter(
  topPct: number,
  heightPct: number,
  leftPct: number,
  widthPct: number,
  width: number,
  height: number,
  blur = 14,
): string {
  const y = Math.max(0, Math.floor((height * topPct) / 100))
  const h = Math.max(8, Math.floor((height * heightPct) / 100))
  const x = Math.max(0, Math.floor((width * leftPct) / 100))
  const w = Math.max(8, Math.floor((width * widthPct) / 100))
  const bx = Math.min(blur, 24)
  return (
    `[0:v]split=2[base][src];` +
    `[src]crop=${w}:${h}:${x}:${y},boxblur=${bx}:${Math.max(4, bx / 2)}[patch];` +
    `[base][patch]overlay=${x}:${y}[wmout]`
  )
}

export async function inpaintFilterForVideo(
  videoPath: string,
  topPct: number,
  heightPct: number,
  leftPct: number,
  widthPct: number,
): Promise<string> {
  const { width, height } = await probeSize(videoPath)
  return buildInpaintFilter(topPct, heightPct, leftPct, widthPct, width, height)
}
