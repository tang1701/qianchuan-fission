/**
 * 模拟桌面版「开始处理」完整任务（不经过 IPC），用于 CI/本地自测。
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runVideoEffectsJob } from '../jobs/videoEffects'
import { smartFxModuleEnabled } from '../../src/features/video-effects/effectModules'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.join(root, '.tmp', 'fx-job-smoke')
const sample = path.join(root, '.tmp', 'fx-verify', 'sample.mp4')

async function ensureSample() {
  try {
    await fs.access(sample)
    return
  } catch {
    /* created by verify:fx */
  }
  const { execSync } = await import('node:child_process')
  execSync('npm run verify:fx', { cwd: root, stdio: 'inherit' })
}

async function main() {
  await ensureSample()
  await fs.mkdir(outDir, { recursive: true })

  const logs: { t: number; percent: number; message: string }[] = []
  const t0 = Date.now()
  const report = (p: { percent: number; message: string }) => {
    logs.push({ t: Date.now() - t0, ...p })
    process.stdout.write(`\r[${p.percent}%] ${p.message}`.padEnd(72))
  }

  const result = await runVideoEffectsJob(
    {
      featureId: 'video-effects',
      inputs: [sample],
      outputDir: outDir,
      options: {
        fxConfigMode: 'smart',
        fxModuleEnabled: smartFxModuleEnabled(),
        fissionCount: 3,
        fxCropEnabled: true,
        fxCropRatio: '9:16',
        fxCropRectNorm: { x: 0.1, y: 0.12, w: 0.55, h: 0.72 },
        fxOutResolution: '1080P',
        fxOutFps: 30,
        aiSplitEnabled: false,
        splitIntervalSec: 0,
        fxExportByFolder: true,
        addTextWatermark: false,
        mirrorRandom: true,
        speedJitter: true,
        fxSaturation: 102,
        fxIntroFadeSec: 0.6,
        keepOriginalAudio: true,
        originalVolume: 100,
      },
    },
    report,
  )

  console.log('\n')
  if (!result.ok) {
    console.error('FAIL:', result.error)
    process.exit(1)
  }
  const first = logs[0]
  if (!first || first.t > 5000) {
    console.error('FAIL: 首条进度上报过晚', first)
    process.exit(1)
  }
  if (logs.every((l) => l.message.includes('准备'))) {
    console.error('FAIL: 进度文案未更新')
    process.exit(1)
  }
  console.log(`OK: ${result.outputs?.length ?? 0} 个输出, ${Date.now() - t0}ms, 进度条 ${logs.length} 次`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
