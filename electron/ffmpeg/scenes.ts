import { spawn } from 'node:child_process'
import { getFfmpegPath } from './util'

/** 基于 FFmpeg scene 分数检测切点（秒） */
export function detectSceneTimes(videoPath: string, threshold = 0.35): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      getFfmpegPath(),
      [
        '-hide_banner',
        '-i',
        videoPath,
        '-filter:v',
        `select='gt(scene,${threshold})',showinfo`,
        '-f',
        'null',
        '-',
      ],
      { windowsHide: true },
    )
    let stderr = ''
    proc.stderr.on('data', (d) => {
      stderr += String(d)
    })
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error('AI 镜头分析超时，请改用「不启用」或「自定义间隔」分割'))
    }, 600_000)
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0 && !stderr.includes('showinfo')) {
        reject(new Error(stderr.slice(-400)))
        return
      }
      const times = new Set<number>()
      const re = /pts_time:([\d.]+)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(stderr))) {
        times.add(parseFloat(m[1]!))
      }
      resolve([...times].sort((a, b) => a - b))
    })
    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}
