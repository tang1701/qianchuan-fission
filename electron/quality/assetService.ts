import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { probeDuration, probeMediaMeta, probeSize } from '../ffmpeg/util'
import {
  RULE_VERSION,
  rightsDecision,
  rollingPlatformRates,
  type AssetRecord,
  type AuditEvent,
  type LibraryFile,
  type SourceType,
  type TaskRecord,
  type TaskStatus,
  SOURCE_TYPES,
} from './domain'
import { loadLibrary, saveLibrary } from './libraryStore'
import { pathKeyOf, sameFilePath } from './paths'

export interface RightsPatch {
  sourceType: SourceType
  voucher: string
  rightsHolder: string
  scope: string
  expiresOn: string
  platforms: string[]
  commercialLicense: boolean | null
  note: string
}

export interface AssetView {
  id: string
  name: string
  path: string
  sourceType: SourceType
  voucher: string
  rightsHolder: string
  scope: string
  expiresOn: string
  platforms: string[]
  commercialLicense: boolean | null
  capturedAt: string
  importedAt: string
  sha256: string
  perceptualHash: null
  note: string
  metadata: AssetRecord['metadata']
  mediaError: string
  badge: string
  reasons: string[]
  duplicateOf: { path: string; name: string }[]
}

export interface PreflightResult {
  ok: boolean
  taskId: string
  error?: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'])
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function shortErr(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/\s+/g, ' ').slice(0, 180)
}

function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

function pushAudit(lib: LibraryFile, event: Omit<AuditEvent, 'id' | 'timestamp'> & { timestamp?: string }) {
  lib.audits.push({
    id: randomUUID(),
    timestamp: event.timestamp ?? new Date().toISOString(),
    actor: event.actor,
    action: event.action,
    entity: event.entity,
    traceId: event.traceId,
    before: event.before,
    after: event.after,
  })
}

function groupOf(asset: AssetRecord, assets: AssetRecord[]): AssetRecord[] {
  if (!asset.sha256) return [asset]
  return assets
    .filter((item) => item.sha256 === asset.sha256)
    .sort((a, b) => a.importedAt.localeCompare(b.importedAt) || a.pathKey.localeCompare(b.pathKey))
}

function isNonCanonical(asset: AssetRecord, assets: AssetRecord[]): boolean {
  const group = groupOf(asset, assets)
  return group.length > 1 && group[0]?.pathKey !== asset.pathKey
}

function toView(asset: AssetRecord, assets: AssetRecord[]): AssetView {
  const decision = rightsDecision(asset)
  const others = groupOf(asset, assets).filter((item) => item.pathKey !== asset.pathKey)
  const duplicate = isNonCanonical(asset, assets)
  const reasons = [...decision.reasons]
  if (duplicate) {
    const canonical = groupOf(asset, assets)[0]
    reasons.push(`与 ${canonical?.path || '已登记文件'} 完全相同（SHA-256 一致），重复文件不会进入处理队列。`)
  }
  let badge = decision.status
  if (decision.allowed && duplicate) badge = '重复'
  if (!decision.allowed && decision.status === '有效') badge = '阻断'
  return {
    id: asset.id,
    name: asset.name,
    path: asset.path,
    sourceType: asset.sourceType,
    voucher: asset.voucher,
    rightsHolder: asset.rightsHolder,
    scope: asset.scope,
    expiresOn: asset.expiresOn,
    platforms: [...asset.platforms],
    commercialLicense: asset.commercialLicense,
    capturedAt: asset.capturedAt,
    importedAt: asset.importedAt,
    sha256: asset.sha256,
    perceptualHash: null,
    note: asset.note,
    metadata: asset.metadata,
    mediaError: asset.mediaError,
    badge,
    reasons,
    duplicateOf: others.map((item) => ({ path: item.path, name: item.name })),
  }
}

function blankAsset(filePath: string, now: string): AssetRecord {
  return {
    id: randomUUID(),
    name: path.basename(filePath),
    path: filePath,
    pathKey: pathKeyOf(filePath),
    sourceType: '待核验',
    voucher: '',
    rightsHolder: '',
    scope: '',
    expiresOn: '',
    platforms: [],
    commercialLicense: null,
    capturedAt: now,
    importedAt: now,
    sha256: '',
    perceptualHash: null,
    note: '',
    size: 0,
    mtimeMs: 0,
    metadata: null,
    mediaError: '',
    updatedAt: now,
  }
}

async function refreshFileFacts(asset: AssetRecord): Promise<void> {
  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(asset.path)
  } catch {
    asset.mediaError = '找不到素材文件'
    asset.metadata = null
    asset.updatedAt = new Date().toISOString()
    return
  }
  if (!stat.isFile()) {
    asset.mediaError = '路径不是视频文件'
    asset.metadata = null
    asset.updatedAt = new Date().toISOString()
    return
  }
  const changed = stat.size !== asset.size || Math.abs(stat.mtimeMs - asset.mtimeMs) > 1 || !asset.sha256
  asset.size = stat.size
  asset.mtimeMs = stat.mtimeMs
  asset.name = path.basename(asset.path)
  if (changed) {
    try {
      asset.sha256 = await sha256File(asset.path)
    } catch (error) {
      asset.sha256 = ''
      asset.mediaError = `无法计算文件哈希：${shortErr(error)}`
      asset.metadata = null
      asset.updatedAt = new Date().toISOString()
      return
    }
  }
  if (changed || (!asset.metadata && !asset.mediaError)) {
    try {
      asset.metadata = await probeMediaMeta(asset.path)
      asset.mediaError = ''
    } catch (error) {
      asset.metadata = null
      asset.mediaError = shortErr(error)
    }
  }
  asset.updatedAt = new Date().toISOString()
}

function findAsset(lib: LibraryFile, filePath: string): AssetRecord | undefined {
  const key = pathKeyOf(filePath)
  return lib.assets.find((asset) => asset.pathKey === key)
}

function assertPatch(patch: RightsPatch): void {
  if (!SOURCE_TYPES.includes(patch.sourceType)) throw new Error('来源类型无效')
  if (patch.rightsHolder.length > 80) throw new Error('权利人过长')
  if (patch.voucher.length > 300) throw new Error('来源凭证过长')
  if (patch.scope.length > 200) throw new Error('授权范围过长')
  if (patch.note.length > 500) throw new Error('备注过长')
  if (patch.expiresOn && !DATE_RE.test(patch.expiresOn)) throw new Error('到期日无效')
  if (patch.platforms.length > 12 || patch.platforms.some((item) => item.length > 40)) {
    throw new Error('可用平台过多或某一项过长')
  }
}

function applyPatch(asset: AssetRecord, patch: RightsPatch) {
  const before = {
    sourceType: asset.sourceType,
    rightsHolder: asset.rightsHolder,
    expiresOn: asset.expiresOn,
    commercialLicense: asset.commercialLicense,
  }
  asset.sourceType = patch.sourceType
  asset.voucher = patch.voucher.trim()
  asset.rightsHolder = patch.rightsHolder.trim()
  asset.scope = patch.scope.trim()
  asset.expiresOn = patch.expiresOn
  asset.platforms = patch.platforms.map((item) => item.trim()).filter(Boolean)
  asset.commercialLicense = patch.commercialLicense
  asset.note = patch.note.trim()
  asset.updatedAt = new Date().toISOString()
  return before
}

async function ensureAsset(lib: LibraryFile, filePath: string): Promise<{ asset: AssetRecord; created: boolean }> {
  let asset = findAsset(lib, filePath)
  const created = !asset
  if (!asset) {
    asset = blankAsset(filePath, new Date().toISOString())
    lib.assets.push(asset)
  } else if (asset.path !== filePath) {
    asset.path = filePath
  }
  await refreshFileFacts(asset)
  return { asset, created }
}

function newTask(featureId: string, inputs: string[], outputDir: string, status: TaskStatus, error = ''): TaskRecord {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    featureId,
    status,
    ruleVersion: RULE_VERSION,
    inputPaths: inputs,
    outputDir,
    outputPaths: [],
    outputHashes: [],
    error,
    blockers: error ? [error] : [],
    createdAt: now,
    updatedAt: now,
  }
}

export async function validateJobOutputs(
  inputs: string[],
  outputs: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!outputs.length) return { ok: false, error: '没有生成可播放的输出，任务记为失败。原素材仍保留。' }
  const problems: string[] = []
  for (const out of outputs) {
    if (inputs.some((input) => sameFilePath(input, out))) {
      problems.push(`输出与原素材是同一文件，已拒绝：${out}`)
      continue
    }
    try {
      const stat = await fs.stat(out)
      if (!stat.isFile() || stat.size <= 0) {
        problems.push(`输出文件为空或不可用：${out}`)
        continue
      }
      const ext = path.extname(out).toLowerCase()
      if (IMAGE_EXT.has(ext)) await probeSize(out)
      else if (VIDEO_EXT.has(ext) || ext === '.mp4') await probeDuration(out)
      else await probeDuration(out)
    } catch (error) {
      problems.push(`输出无法读取：${path.basename(out)}（${shortErr(error)}）`)
    }
  }
  if (problems.length) return { ok: false, error: problems.join('\n') }
  return { ok: true }
}

export function createQualityService(dataDir: string) {
  const file = path.join(dataDir, 'library.json')
  let chain: Promise<void> = Promise.resolve()
  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const job = chain.then(fn, fn)
    chain = job.then(
      () => undefined,
      () => undefined,
    )
    return job
  }

  async function withLibrary<T>(fn: (lib: LibraryFile) => Promise<{ save: boolean; value: T }>): Promise<T> {
    await fs.mkdir(dataDir, { recursive: true })
    const lib = await loadLibrary(file)
    const result = await fn(lib)
    if (result.save) await saveLibrary(file, lib)
    return result.value
  }

  return {
    inspect(paths: string[]) {
      return run(() =>
        withLibrary(async (lib) => {
          const views: AssetView[] = []
          for (const filePath of paths) {
            const { asset, created } = await ensureAsset(lib, filePath)
            if (!created) continue
            pushAudit(lib, {
              actor: 'system',
              action: 'asset.register',
              entity: asset.id,
              traceId: asset.id,
              after: { path: asset.path, sha256: asset.sha256, sourceType: asset.sourceType },
            })
          }
          for (const filePath of paths) {
            const asset = findAsset(lib, filePath)
            if (asset) views.push(toView(asset, lib.assets))
          }
          return { save: true, value: views }
        }),
      )
    },

    updateRights(filePath: string, patch: RightsPatch) {
      return run(() =>
        withLibrary(async (lib) => {
          assertPatch(patch)
          const { asset } = await ensureAsset(lib, filePath)
          if (asset.mediaError === '找不到素材文件') throw new Error(`找不到素材文件：${filePath}`)
          const before = applyPatch(asset, patch)
          pushAudit(lib, {
            actor: 'user',
            action: 'asset.rights_update',
            entity: asset.id,
            traceId: asset.id,
            before,
            after: {
              sourceType: asset.sourceType,
              rightsHolder: asset.rightsHolder,
              expiresOn: asset.expiresOn,
              commercialLicense: asset.commercialLicense,
            },
          })
          return { save: true, value: toView(asset, lib.assets) }
        }),
      )
    },

    applyOwnFootage(paths: string[]) {
      return run(() =>
        withLibrary(async (lib) => {
          const touched: AssetRecord[] = []
          for (const filePath of paths) {
            const { asset } = await ensureAsset(lib, filePath)
            if (asset.mediaError === '找不到素材文件') throw new Error(`找不到素材文件：${filePath}`)
            const before = applyPatch(asset, {
              sourceType: '自有拍摄',
              voucher: asset.voucher.trim() || '本人拍摄',
              rightsHolder: asset.rightsHolder.trim() || '本人',
              scope: asset.scope.trim() || '巨量千川投放',
              expiresOn: asset.expiresOn,
              platforms: asset.platforms.length ? asset.platforms : ['巨量千川'],
              commercialLicense: true,
              note: asset.note,
            })
            pushAudit(lib, {
              actor: 'user',
              action: 'asset.rights_update',
              entity: asset.id,
              traceId: asset.id,
              before,
              after: { sourceType: asset.sourceType, rightsHolder: asset.rightsHolder },
            })
            touched.push(asset)
          }
          return { save: true, value: touched.map((asset) => toView(asset, lib.assets)) }
        }),
      )
    },

    summary() {
      return run(async () => {
        const lib = await loadLibrary(file).catch((error: unknown) => {
          throw error
        })
        return rollingPlatformRates(lib.submissions)
      })
    },

    preflight(
      input: { featureId: string; inputs: string[]; outputDir: string; enforceRights?: boolean },
      onProgress?: (message: string) => void,
    ): Promise<PreflightResult> {
      return run(() =>
        withLibrary(async (lib) => {
          const blockers: string[] = []
          if (!input.outputDir.trim()) blockers.push('请先选择导出目录')
          else {
            try {
              const stat = await fs.stat(input.outputDir)
              if (!stat.isDirectory()) blockers.push('导出路径不是文件夹，已阻止覆盖原素材')
            } catch (error) {
              const code = (error as NodeJS.ErrnoException).code
              if (code !== 'ENOENT') blockers.push('导出目录无法使用')
            }
            for (const filePath of input.inputs) {
              if (sameFilePath(input.outputDir, filePath)) {
                blockers.push(`导出路径指向原素材文件，已阻止覆盖：${filePath}`)
              }
            }
          }

          for (let index = 0; index < input.inputs.length; index++) {
            const filePath = input.inputs[index]!
            onProgress?.(`正在核验 ${path.basename(filePath)}（${index + 1}/${input.inputs.length}）`)
            const { asset, created } = await ensureAsset(lib, filePath)
            if (created) {
              pushAudit(lib, {
                actor: 'system',
                action: 'asset.register',
                entity: asset.id,
                traceId: asset.id,
                after: { path: asset.path, sha256: asset.sha256, sourceType: asset.sourceType },
              })
            }
            if (input.enforceRights) {
              const view = toView(asset, lib.assets)
              if (!view.reasons.length && view.badge === '有效') continue
              const why = view.reasons.length ? view.reasons.join('；') : view.badge
              blockers.push(`${asset.name}：${why}`)
              continue
            }
            if (isNonCanonical(asset, lib.assets)) {
              blockers.push(`${asset.name}：与已登记文件完全相同（SHA-256），本批请只保留一条`)
            }
            if (asset.mediaError) {
              blockers.push(`${asset.name}：${asset.mediaError}`)
            }
          }

          if (blockers.length) {
            const error = ['已阻断，没有进入处理。', ...blockers].join('\n')
            const task = newTask(input.featureId, input.inputs, input.outputDir, '阻断', error)
            task.blockers = blockers
            lib.tasks.push(task)
            pushAudit(lib, {
              actor: 'system',
              action: 'task.block',
              entity: task.id,
              traceId: task.id,
              after: { status: '阻断', error },
            })
            return { save: true, value: { ok: false as const, taskId: task.id, error } }
          }

          const task = newTask(input.featureId, input.inputs, input.outputDir, '待处理')
          lib.tasks.push(task)
          pushAudit(lib, {
            actor: 'system',
            action: 'task.accept',
            entity: task.id,
            traceId: task.id,
            after: { status: '待处理', inputs: input.inputs.length },
          })
          return { save: true, value: { ok: true as const, taskId: task.id } }
        }),
      )
    },

    markRunning(taskId: string) {
      return run(() =>
        withLibrary(async (lib) => {
          const task = lib.tasks.find((item) => item.id === taskId)
          if (!task) throw new Error('找不到任务记录')
          task.status = '处理中'
          task.updatedAt = new Date().toISOString()
          pushAudit(lib, {
            actor: 'system',
            action: 'task.start',
            entity: task.id,
            traceId: task.id,
            after: { status: task.status },
          })
          return { save: true, value: undefined }
        }),
      )
    },

    async finish(taskId: string, status: '完成' | '失败', error: string, outputs: string[]) {
      const hashes: { path: string; sha256: string }[] = []
      for (const output of outputs) {
        try {
          const stat = await fs.stat(output)
          if (stat.isFile() && stat.size > 0) hashes.push({ path: output, sha256: await sha256File(output) })
        } catch {
          /* 失败任务可能没有完整输出，哈希能算多少算多少 */
        }
      }
      return run(() =>
        withLibrary(async (lib) => {
          const task = lib.tasks.find((item) => item.id === taskId)
          if (!task) throw new Error('找不到任务记录')
          task.status = status
          task.error = error
          task.outputPaths = outputs
          task.outputHashes = hashes
          task.updatedAt = new Date().toISOString()
          if (error) task.blockers = [error]
          pushAudit(lib, {
            actor: 'system',
            action: status === '完成' ? 'task.complete' : 'task.fail',
            entity: task.id,
            traceId: task.id,
            after: { status, error },
          })
          return { save: true, value: undefined }
        }),
      )
    },

    snapshot() {
      return run(async () => loadLibrary(file))
    },
  }
}

export function parseRightsPatch(input: unknown): RightsPatch {
  if (!input || typeof input !== 'object') throw new Error('授权信息不完整')
  const raw = input as Record<string, unknown>
  const sourceType = raw.sourceType
  if (typeof sourceType !== 'string' || !SOURCE_TYPES.includes(sourceType as SourceType)) {
    throw new Error('来源类型无效')
  }
  const platforms = Array.isArray(raw.platforms)
    ? raw.platforms.filter((item): item is string => typeof item === 'string')
    : typeof raw.platformsText === 'string'
      ? raw.platformsText.split(/[,，、]/)
      : []
  let commercialLicense: boolean | null = null
  if (raw.commercialLicense === true || raw.commercialLicense === 'yes') commercialLicense = true
  else if (raw.commercialLicense === false || raw.commercialLicense === 'no') commercialLicense = false
  else if (raw.commercialLicense === 'unset' || raw.commercialLicense == null) commercialLicense = null
  else throw new Error('商用许可无效')
  return {
    sourceType: sourceType as SourceType,
    voucher: typeof raw.voucher === 'string' ? raw.voucher : '',
    rightsHolder: typeof raw.rightsHolder === 'string' ? raw.rightsHolder : '',
    scope: typeof raw.scope === 'string' ? raw.scope : '',
    expiresOn: typeof raw.expiresOn === 'string' ? raw.expiresOn : '',
    platforms,
    commercialLicense,
    note: typeof raw.note === 'string' ? raw.note : '',
  }
}
