/**
 * 本地 FFmpeg 自测：不启动 Electron UI，直接跑 videoEffects Job。
 * 用法：npx tsx electron/verify/videoEffectsVerify.ts
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getFfmpegPath, runFfmpeg, probeDuration } from '../ffmpeg/util'
import { runVideoEffectsJob } from '../jobs/videoEffects'
import { smartFxModuleEnabled } from '../../src/features/video-effects/effectModules'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../..')
const workDir = path.join(root, '.tmp', 'fx-verify')
const inputPath = path.join(workDir, 'sample.mp4')
const outRoot = path.join(workDir, 'out')

type Case = {
  name: string
  options: Record<string, unknown>
  expectMinOutputs?: number
}

async function ensureSampleVideo() {
  await fs.mkdir(workDir, { recursive: true })
  try {
    const st = await fs.stat(inputPath)
    if (st.size > 1000) return
  } catch {
    /* create */
  }
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=720x1280:rate=30',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=4',
    '-t',
    '4',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    inputPath,
  ])
  const dur = await probeDuration(inputPath)
  if (dur < 3) throw new Error('测试片源时长异常')
}

function baseOpts(): Record<string, unknown> {
  const off = Object.fromEntries(
    Object.keys(smartFxModuleEnabled()).map((k) => [k, false]),
  )
  return {
    fissionCount: 1,
    fxConfigMode: 'manual',
    fxModuleEnabled: { ...off, fission: true },
    fxOutResolution: '1080P',
    fxOutFps: 30,
    fxCrf: 23,
    fxSplitMode: 'none',
    fxTrimIntroSec: 0,
    fxTrimOutroSec: 0,
    fxExportByFolder: false,
    keepOriginalAudio: true,
    originalVolume: 100,
  }
}

function mod(...ids: string[]): Record<string, unknown> {
  const m = baseOpts().fxModuleEnabled as Record<string, boolean>
  const fxModuleEnabled = { ...m }
  for (const id of ids) fxModuleEnabled[id] = true
  return { fxModuleEnabled }
}

const cases: Case[] = [
  { name: 'baseline-scale', options: baseOpts(), expectMinOutputs: 1 },
  {
    name: 'mirror-hflip',
    options: { ...baseOpts(), ...mod('mirror'), mirrorRandom: false },
  },
  {
    name: 'speed-110',
    options: { ...baseOpts(), ...mod('speed'), fxSpeedRate: 110, speedJitter: false },
  },
  {
    name: 'qianchuan-profile',
    options: {
      ...baseOpts(),
      fxConfigMode: 'smart',
      fxFissionProfile: 'qianchuan',
      fxModuleEnabled: { ...(baseOpts().fxModuleEnabled as object), fission: true, cover: true },
      fissionCount: 3,
      fxOutResolution: '1080x1920',
      fxStripMetadata: true,
      fxNamingMode: 'fission_idx',
    },
    expectMinOutputs: 6,
  },
  {
    name: 'pip-self-speed',
    options: {
      ...baseOpts(),
      ...mod('pip', 'speed'),
      fxAddVideoWatermark: true,
      fxVideoWatermarkPath: '',
      fxSpeedRate: 110,
      fissionCount: 5,
      speedJitter: false,
    },
  },
  {
    name: 'intro-fade',
    options: { ...baseOpts(), ...mod('intro'), fxIntroFadeSec: 0.8 },
  },
  {
    name: 'picture-eq',
    options: {
      ...baseOpts(),
      ...mod('picture'),
      fxSaturation: 120,
      fxContrast: 110,
    },
  },
  {
    name: 'pixel-noise',
    options: { ...baseOpts(), ...mod('pixel'), fxNoiseAmount: 4 },
  },
  {
    name: 'dynamic-bg',
    options: { ...baseOpts(), ...mod('bg'), fxDynamicBgBlur: 12 },
  },
  {
    name: 'crop-16x9',
    options: { ...baseOpts(), fxCropEnabled: true, fxCropRatio: '16:9' },
  },
  {
    name: 'trim-head-tail',
    options: {
      ...baseOpts(),
      fxTrimIntroSec: 0.5,
      fxTrimOutroSec: 0.5,
    },
  },
  {
    name: 'split-interval',
    options: {
      ...baseOpts(),
      aiSplitEnabled: false,
      splitIntervalSec: 2,
      fxFilterMinSegmentSec: 0.3,
    },
    expectMinOutputs: 2,
  },
  {
    name: 'cover-jpg',
    options: { ...baseOpts(), ...mod('cover'), fxCoverAtSec: 1 },
    expectMinOutputs: 2,
  },
  {
    name: 'audio-volume',
    options: { ...baseOpts(), ...mod('audio'), originalVolume: 50 },
  },
  {
    name: 'fission-x2',
    options: {
      ...baseOpts(),
      ...mod('mirror', 'speed'),
      fissionCount: 2,
      mirrorRandom: true,
      speedJitter: true,
    },
    expectMinOutputs: 2,
  },
  {
    name: 'smart-all-modules',
    options: {
      ...baseOpts(),
      fxConfigMode: 'smart',
      fxModuleEnabled: smartFxModuleEnabled(),
      fissionCount: 3,
      speedJitter: false,
      mirrorRandom: false,
      addTextWatermark: false,
    },
    expectMinOutputs: 3,
  },
  {
    name: 'rotate-90',
    options: { ...baseOpts(), ...mod('mirror'), fxRotateDeg: 90, mirrorRandom: false },
  },
  {
    name: 'delogo-region',
    options: {
      ...baseOpts(),
      ...mod('scrub'),
      removeWatermark: true,
      watermarkRemoveMode: 'delogo',
      eraseTop: 5,
      eraseHeight: 10,
      fxDelogoLeft: 10,
      fxDelogoWidth: 30,
    },
  },
  {
    name: 'ai-scene-split',
    options: {
      ...baseOpts(),
      aiSplitEnabled: true,
      splitIntervalSec: 0,
      fxFilterMinSegmentSec: 0.5,
    },
    expectMinOutputs: 1,
  },
  {
    name: 'export-by-folder',
    options: { ...baseOpts(), fxExportByFolder: true },
  },
  {
    name: 'text-watermark',
    options: {
      ...baseOpts(),
      ...mod('text-wm'),
      addTextWatermark: true,
      watermarkText: 'ECutAuto',
      fxWatermarkPosition: 'top-right',
    },
  },
]

async function runCase(c: Case): Promise<{ ok: boolean; detail: string }> {
  const dir = path.join(outRoot, c.name)
  await fs.rm(dir, { force: true, recursive: true })
  await fs.mkdir(dir, { recursive: true })

  const res = await runVideoEffectsJob(
    {
      featureId: 'video-effects',
      inputs: [inputPath],
      outputDir: dir,
      options: c.options,
    },
    () => {},
  )

  if (!res.ok) return { ok: false, detail: res.error ?? 'job failed' }
  const outputs = res.outputs ?? []
  const min = c.expectMinOutputs ?? 1
  if (outputs.length < min) {
    return { ok: false, detail: `输出数量 ${outputs.length} < ${min}` }
  }
  for (const f of outputs) {
    const st = await fs.stat(f)
    if (st.size < 500) return { ok: false, detail: `文件过小: ${f}` }
  }
  return { ok: true, detail: `${outputs.length} 个文件` }
}

async function main() {
  console.log('ffmpeg:', getFfmpegPath())
  await ensureSampleVideo()
  console.log('样片:', inputPath)

  const results: { name: string; ok: boolean; detail: string }[] = []
  for (const c of cases) {
    process.stdout.write(`· ${c.name} … `)
    try {
      const r = await runCase(c)
      results.push({ name: c.name, ...r })
      console.log(r.ok ? `OK (${r.detail})` : `FAIL: ${r.detail}`)
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      results.push({ name: c.name, ok: false, detail })
      console.log(`FAIL: ${detail}`)
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log('\n========== 汇总 ==========')
  console.log(`通过 ${results.length - failed.length}/${results.length}`)
  if (failed.length) {
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`)
    process.exitCode = 1
  } else {
    console.log('全部通过')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
