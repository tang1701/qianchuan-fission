import fs from 'node:fs/promises'
import path from 'node:path'
import { runFfmpeg } from './util'

export interface SubtitleCue {
  text: string
  startSec: number
  endSec: number
}

function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export async function writeSrt(cues: SubtitleCue[], outPath: string) {
  const body = cues
    .map(
      (c, i) =>
        `${i + 1}\n${formatSrtTime(c.startSec)} --> ${formatSrtTime(c.endSec)}\n${c.text}\n`,
    )
    .join('\n')
  await fs.writeFile(outPath, body, 'utf8')
}

function srtPathForFfmpeg(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:')
}

export async function burnSubtitles(
  inputVideo: string,
  srtPath: string,
  outputVideo: string,
  style: Record<string, unknown>,
) {
  const fontSize = Number(style.fontSize ?? 30)
  const fontName = String(style.fontFamily ?? 'Microsoft YaHei')
  const primary = String(style.textColor ?? '#FFFFFF').replace('#', '&H00')
  const outline = String(style.strokeColor ?? '#000000').replace('#', '&H00')
  const outlineW = Number(style.strokeWidth ?? 2)
  const opacity = Number(style.fontOpacity ?? 100) / 100

  const forceStyle = `FontName=${fontName},FontSize=${fontSize},PrimaryColour=${primary},OutlineColour=${outline},Outline=${outlineW},BorderStyle=1,Alpha=${Math.round((1 - opacity) * 255)}`
  const sub = srtPathForFfmpeg(srtPath)
  await runFfmpeg([
    '-y',
    '-i',
    inputVideo,
    '-vf',
    `subtitles='${sub}':force_style='${forceStyle}'`,
    '-c:a',
    'copy',
    outputVideo,
  ])
}
