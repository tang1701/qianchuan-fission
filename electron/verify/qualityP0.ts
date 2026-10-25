/**
 * P0 验收：未核验可阻断、完全重复可识别、失败有原因、原素材不被覆盖。
 * 优质 70% / 首发 20% 只按平台回填计算，没有回填时必须是数据不足。
 * 用法：npm run test:quality-p0
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg } from '../ffmpeg/util'
import { createQualityService, validateJobOutputs, type RightsPatch } from '../quality/assetService'
import { rightsDecision, rollingPlatformRates, type AssetMedia, type SubmissionMark } from '../quality/domain'
import { assertOutputDoesNotReplaceSource } from '../quality/paths'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const media: AssetMedia = {
  durationSec: 1,
  width: 160,
  height: 160,
  fps: 25,
  videoCodec: 'h264',
  audioCodec: 'aac',
  hasAudio: true,
  container: 'mp4',
}

const own: RightsPatch = {
  sourceType: '自有拍摄',
  voucher: '本人拍摄',
  rightsHolder: '本人',
  scope: '巨量千川投放',
  expiresOn: '',
  platforms: ['巨量千川'],
  commercialLicense: true,
  note: '',
}

async function makeVideo(file: string) {
  await runFfmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=160x160:d=0.4:r=25',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=mono:sample_rate=44100',
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

function mark(partial: Partial<SubmissionMark> & Pick<SubmissionMark, 'id' | 'reviewStatus' | 'submittedAt'>): SubmissionMark {
  return {
    qualityBadge: null,
    originalBadge: null,
    inOriginalScope: false,
    ...partial,
  }
}

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eauto-p0-'))
  const svc = createQualityService(path.join(dir, 'quality'))
  const video = path.join(dir, 'clip-a.mp4')
  const copy = path.join(dir, 'clip-b.mp4')
  const broken = path.join(dir, 'broken.mp4')
  const exportDir = path.join(dir, 'out')
  await fs.mkdir(exportDir)
  try {
    const empty = await svc.summary()
    assert.equal(empty.insufficient, true)
    assert.equal(empty.qualityRate, null)
    assert.equal(empty.originalRate, null)
    assert.equal(empty.targets.qualityRate, 0.7)
    assert.equal(empty.targets.originalRate, 0.2)
    assert.match(empty.notice, /不是平台标记/)

    const today = new Date(2026, 9, 25, 12, 0, 0)
    const baseRights = {
      sourceType: '自有拍摄' as const,
      voucher: '本人拍摄',
      rightsHolder: '本人',
      scope: '巨量千川投放',
      expiresOn: '2026-10-25',
      platforms: ['巨量千川'],
      commercialLicense: true as boolean | null,
      metadata: media,
      mediaError: '',
    }
    assert.equal(rightsDecision(baseRights, today).allowed, true)
    assert.equal(rightsDecision({ ...baseRights, expiresOn: '2026-10-24' }, today).status, '已过期')
    assert.equal(rightsDecision({ ...baseRights, sourceType: '待核验' }, today).status, '未核验')

    const now = new Date('2026-10-25T08:00:00.000Z')
    const rates = rollingPlatformRates(
      [
        mark({ id: '1', submittedAt: '2026-10-01T00:00:00.000Z', reviewStatus: '已出结果', qualityBadge: true, originalBadge: true, inOriginalScope: true }),
        mark({ id: '2', submittedAt: '2026-10-02T00:00:00.000Z', reviewStatus: '已出结果', qualityBadge: true, originalBadge: false, inOriginalScope: true }),
        mark({ id: '3', submittedAt: '2026-10-03T00:00:00.000Z', reviewStatus: '已出结果', qualityBadge: false, originalBadge: false, inOriginalScope: true }),
        mark({ id: '4', submittedAt: '2026-10-04T00:00:00.000Z', reviewStatus: '驳回', qualityBadge: true, originalBadge: true, inOriginalScope: true }),
        mark({ id: '5', submittedAt: '2026-10-05T00:00:00.000Z', reviewStatus: '待审核', qualityBadge: true, originalBadge: true, inOriginalScope: true }),
        mark({ id: '6', submittedAt: '2026-10-06T00:00:00.000Z', reviewStatus: '未知', qualityBadge: true, originalBadge: true, inOriginalScope: true }),
        mark({ id: '7', submittedAt: '2026-08-01T00:00:00.000Z', reviewStatus: '已出结果', qualityBadge: true, originalBadge: true, inOriginalScope: true }),
        mark({ id: '8', submittedAt: '2026-10-07T00:00:00.000Z', reviewStatus: '已出结果', qualityBadge: true, originalBadge: true, inOriginalScope: false }),
      ],
      now,
    )
    assert.equal(rates.denominator, 5)
    assert.equal(rates.qualityCount, 3)
    assert.equal(rates.originalDenominator, 4)
    assert.equal(rates.originalCount, 1)
    assert.equal(rates.rejected, 1)
    assert.equal(rates.pending, 1)
    assert.equal(rates.insufficient, false)

    const targetShape = rollingPlatformRates(
      [
        ...Array.from({ length: 7 }, (_, i) =>
          mark({ id: `q${i}`, submittedAt: '2026-10-10T00:00:00.000Z', reviewStatus: '已出结果', qualityBadge: true, inOriginalScope: i === 0 }),
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          mark({ id: `n${i}`, submittedAt: '2026-10-11T00:00:00.000Z', reviewStatus: '已出结果', qualityBadge: false }),
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          mark({ id: `o${i}`, submittedAt: '2026-10-12T00:00:00.000Z', reviewStatus: '已出结果', qualityBadge: false, originalBadge: false, inOriginalScope: true }),
        ),
      ],
      now,
    )
    assert.equal(targetShape.qualityCount, 7)
    assert.equal(targetShape.denominator, 14)
    assert.equal(targetShape.originalCount, 0)
    const achieved = rollingPlatformRates(
      [
        ...Array.from({ length: 7 }, (_, i) =>
          mark({
            id: `good${i}`,
            submittedAt: '2026-10-10T00:00:00.000Z',
            reviewStatus: '已出结果',
            qualityBadge: true,
            originalBadge: i === 0,
            inOriginalScope: i < 5,
          }),
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          mark({ id: `bad${i}`, submittedAt: '2026-10-11T00:00:00.000Z', reviewStatus: '驳回', inOriginalScope: false }),
        ),
      ],
      now,
    )
    assert.equal(achieved.qualityRate, 0.7)
    assert.equal(achieved.originalDenominator, 5)
    assert.equal(achieved.originalCount, 1)
    assert.equal(achieved.originalRate, 0.2)

    await makeVideo(video)
    await fs.copyFile(video, copy)
    await fs.writeFile(broken, 'not a video')
    const before = await fs.stat(video)

    const pending = await svc.preflight({
      featureId: 'video-effects',
      inputs: [video],
      outputDir: exportDir,
      enforceRights: true,
    })
    assert.equal(pending.ok, false)
    assert.match(pending.error || '', /授权未确认/)
    const pendingSnap = await svc.snapshot()
    assert.equal(pendingSnap.tasks.at(-1)?.status, '阻断')

    await svc.updateRights(video, { ...own, expiresOn: '2000-01-01' })
    const expired = await svc.preflight({
      featureId: 'video-effects',
      inputs: [video],
      outputDir: exportDir,
      enforceRights: true,
    })
    assert.match(expired.error || '', /授权已过期/)

    await svc.updateRights(video, {
      ...own,
      sourceType: '已授权',
      voucher: '合同-1',
      rightsHolder: '品牌方',
      scope: '仅视频号',
      platforms: ['微信视频号'],
      commercialLicense: true,
    })
    const scoped = await svc.preflight({
      featureId: 'video-effects',
      inputs: [video],
      outputDir: exportDir,
      enforceRights: true,
    })
    assert.match(scoped.error || '', /不含巨量千川/)

    await svc.updateRights(broken, own)
    const unreadable = await svc.preflight({
      featureId: 'video-effects',
      inputs: [broken],
      outputDir: exportDir,
      enforceRights: true,
    })
    assert.match(unreadable.error || '', /无法读取|损坏/)
    assert.equal(await fs.readFile(broken, 'utf8'), 'not a video')

    await svc.applyOwnFootage([video, copy])
    const dup = await svc.preflight({ featureId: 'video-effects', inputs: [video, copy], outputDir: exportDir })
    assert.equal(dup.ok, false)
    assert.match(dup.error || '', /clip-b\.mp4：/)
    assert.match(dup.error || '', /完全相同/)

    const pendingLoose = await svc.preflight({
      featureId: 'video-effects',
      inputs: [video],
      outputDir: exportDir,
    })
    assert.equal(pendingLoose.ok, true)

    const dup2 = await svc.preflight({ featureId: 'video-effects', inputs: [video, copy], outputDir: exportDir })
    assert.equal(dup2.ok, false)
    assert.match(dup2.error || '', /clip-b\.mp4：/)
    assert.match(dup2.error || '', /完全相同/)
    assert.doesNotMatch(dup2.error || '', /clip-a\.mp4：/)

    const sameFolder = await svc.preflight({
      featureId: 'video-effects',
      inputs: [video],
      outputDir: path.dirname(video),
    })
    assert.equal(sameFolder.ok, true)
    await svc.markRunning(sameFolder.taskId)
    await svc.finish(sameFolder.taskId, '失败', '编码失败：测试原因', [])
    const failed = (await svc.snapshot()).tasks.find((task) => task.id === sameFolder.taskId)
    assert.equal(failed?.status, '失败')
    assert.match(failed?.error || '', /编码失败：测试原因/)

    const overwrite = await svc.preflight({ featureId: 'video-effects', inputs: [video], outputDir: video })
    assert.equal(overwrite.ok, false)
    assert.match(overwrite.error || '', /不是文件夹|阻止覆盖/)
    const after = await fs.stat(video)
    assert.equal(after.size, before.size)

    assert.equal((await validateJobOutputs([path.join(dir, 'other.mp4')], [video])).ok, true)
    const replaced = await validateJobOutputs([video], [video])
    assert.equal(replaced.ok, false)
    assert.throws(() => assertOutputDoesNotReplaceSource(video, video), /已阻止覆盖原素材/)

    const views = await svc.inspect([video])
    assert.equal(Object.hasOwn(views[0] || {}, 'qualityBadge'), false)
    const libraryFile = path.join(dir, 'quality', 'library.json')
    const raw = JSON.parse(await fs.readFile(libraryFile, 'utf8')) as { assets: { perceptualHash: string | null }[] }
    raw.assets[0]!.perceptualHash = 'forged'
    await fs.writeFile(libraryFile, JSON.stringify(raw))
    const cleared = await svc.inspect([video])
    assert.equal(cleared[0]?.perceptualHash, null)

    await fs.writeFile(libraryFile, '{')
    await assert.rejects(() => svc.summary(), /无法读取/)
    assert.equal(await fs.readFile(libraryFile, 'utf8'), '{')
    await fs.writeFile(libraryFile, JSON.stringify({ schemaVersion: 2, assets: [], tasks: [], audits: [], submissions: [] }))
    await assert.rejects(() => svc.inspect([video]), /不支持的素材库版本/)
    assert.match(await fs.readFile(libraryFile, 'utf8'), /"schemaVersion":2/)

    const pipeline = await fs.readFile(path.join(root, 'electron/jobs/videoEffectsPipeline.ts'), 'utf8')
    assert.match(pipeline, /assertOutputDoesNotReplaceSource\(input, out\)/)
    assert.match(pipeline, /assertOutputDoesNotReplaceSource\(input, outJpg\)/)

    console.log('quality P0 ok')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
