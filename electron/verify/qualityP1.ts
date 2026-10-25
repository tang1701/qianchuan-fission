/**
 * P1：导出后质检含亮度/模糊项；千川预设含片头淡入与 loudnorm。
 * 用法：npm run test:quality-p1
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg } from '../ffmpeg/util'
import { inspectOutputVideo } from '../quality/outputInspect'
import { parseVideoFxOpts, shouldSkipDifferentiation } from '../jobs/videoEffectsPipeline'
import { qianchuanPresetPatch } from '../../src/features/video-effects/fxQianchuanPreset'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

async function makeBrightVideo(file: string) {
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=gray:s=320x320:d=1.2:r=25',
    '-f',
    'lavfi',
    '-i',
    'sine=f=440:d=1.2',
    '-shortest',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    file,
  ])
}

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eauto-p1-'))
  const bright = path.join(dir, 'bright.mp4')
  try {
    await makeBrightVideo(bright)
    const report = await inspectOutputVideo(bright)
    assert.ok(report.checks.some((c) => c.id === 'luma'))
    assert.ok(report.score >= 68, `expected decent score, got ${report.score}`)

    const patch = qianchuanPresetPatch()
    const opts = parseVideoFxOpts({
      ...patch,
      fxModuleEnabled: patch.fxModuleEnabled,
      fissionCount: patch.fissionCount,
    })
    assert.equal(opts.introFadeSec, 0.3)
    assert.equal(opts.audioLoudnorm, true)
    assert.equal(opts.modules.intro, true)

    const qBase = parseVideoFxOpts({
      ...patch,
      fxModuleEnabled: patch.fxModuleEnabled,
      fissionCount: patch.fissionCount,
    })
    assert.equal(shouldSkipDifferentiation(qBase), true)
    const qPicture = parseVideoFxOpts({
      ...patch,
      fxModuleEnabled: { ...patch.fxModuleEnabled, picture: true },
      fissionCount: patch.fissionCount,
    })
    assert.equal(shouldSkipDifferentiation(qPicture), false)

    const pipeline = await fs.readFile(path.join(root, 'electron/jobs/videoEffectsPipeline.ts'), 'utf8')
    assert.match(pipeline, /loudnorm=I=-16/)
    assert.match(pipeline, /afade=t=in/)

    console.log('quality P1 ok')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
