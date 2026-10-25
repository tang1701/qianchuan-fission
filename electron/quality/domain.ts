/**
 * 优质 / 首发的运营口径。
 * 这两个比例只在巨量千川回填明确标记后计算，不能由裂变参数或内部状态冒充。
 */
export const QUALITY_BADGE_TARGET = 0.7
export const ORIGINAL_BADGE_TARGET = 0.2
export const METRIC_WINDOW_DAYS = 30
export const LIBRARY_SCHEMA_VERSION = 1
export const RULE_VERSION = 'p0-rights-1'

export const SOURCE_TYPES = ['自有拍摄', '已授权', '购买授权', '平台允许使用', '待核验'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export interface AssetMedia {
  durationSec: number
  width: number
  height: number
  fps: number
  videoCodec: string
  audioCodec: string
  hasAudio: boolean
  container: string
}

export interface AssetRecord {
  id: string
  name: string
  path: string
  pathKey: string
  sourceType: SourceType
  voucher: string
  rightsHolder: string
  scope: string
  /** 到期日 YYYY-MM-DD，空字符串表示未填写 */
  expiresOn: string
  platforms: string[]
  commercialLicense: boolean | null
  capturedAt: string
  importedAt: string
  sha256: string
  /** P0 不计算感知哈希，读入库时一律清空，避免被当成相似检测结果 */
  perceptualHash: null
  note: string
  size: number
  mtimeMs: number
  metadata: AssetMedia | null
  mediaError: string
  updatedAt: string
}

export type TaskStatus =
  | '待处理'
  | '处理中'
  | '待人工复核'
  | '阻断'
  | '完成'
  | '失败'
  | '已提交'
  | '平台结果已回填'

export interface TaskRecord {
  id: string
  featureId: string
  status: TaskStatus
  ruleVersion: string
  inputPaths: string[]
  outputDir: string
  outputPaths: string[]
  outputHashes: { path: string; sha256: string }[]
  error: string
  blockers: string[]
  createdAt: string
  updatedAt: string
}

export interface AuditEvent {
  id: string
  actor: 'system' | 'user'
  action: string
  entity: string
  timestamp: string
  traceId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}

export type ReviewStatus = '未知' | '待审核' | '已出结果' | '驳回'

/** 只有明确的平台回填才能进入统计。本地没有“标成优质”的入口。 */
export interface SubmissionMark {
  id: string
  submittedAt: string
  reviewStatus: ReviewStatus
  qualityBadge: boolean | null
  originalBadge: boolean | null
  inOriginalScope: boolean
}

export interface LibraryFile {
  schemaVersion: number
  assets: AssetRecord[]
  tasks: TaskRecord[]
  audits: AuditEvent[]
  submissions: SubmissionMark[]
}

export interface RightsDecision {
  allowed: boolean
  status: '未核验' | '有效' | '已过期' | '范围不符' | '无商用许可' | '商用许可未确认' | '媒体不可读' | '阻断'
  reasons: string[]
}

export interface PlatformRateSnapshot {
  targets: { qualityRate: number; originalRate: number }
  windowDays: number
  asOf: string
  insufficient: boolean
  originalInsufficient: boolean
  qualityRate: number | null
  originalRate: number | null
  denominator: number
  originalDenominator: number
  qualityCount: number
  originalCount: number
  pending: number
  rejected: number
  notice: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const QIANCHUAN = /千川|巨量|qianchuan|ocean/i

export function localDateISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyLibrary(): LibraryFile {
  return { schemaVersion: LIBRARY_SCHEMA_VERSION, assets: [], tasks: [], audits: [], submissions: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function reqString(raw: Record<string, unknown>, key: string, label: string): string {
  const value = raw[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`素材库记录无效：${label}`)
  return value
}

function optString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key]
  return typeof value === 'string' ? value : ''
}

function coerceMedia(value: unknown): AssetMedia | null {
  if (value == null) return null
  if (!isRecord(value)) throw new Error('素材库记录无效：媒体参数')
  const durationSec = Number(value.durationSec)
  const width = Number(value.width)
  const height = Number(value.height)
  const fps = Number(value.fps)
  if (![durationSec, width, height, fps].every((n) => Number.isFinite(n))) {
    throw new Error('素材库记录无效：媒体参数')
  }
  return {
    durationSec,
    width,
    height,
    fps,
    videoCodec: typeof value.videoCodec === 'string' ? value.videoCodec : '',
    audioCodec: typeof value.audioCodec === 'string' ? value.audioCodec : '',
    hasAudio: value.hasAudio === true,
    container: typeof value.container === 'string' ? value.container : '',
  }
}

function coerceAsset(value: unknown): AssetRecord {
  if (!isRecord(value)) throw new Error('素材库记录无效')
  const sourceType = value.sourceType
  if (typeof sourceType !== 'string' || !SOURCE_TYPES.includes(sourceType as SourceType)) {
    throw new Error('素材库记录无效：来源类型')
  }
  const platforms = value.platforms
  if (!Array.isArray(platforms) || platforms.some((p) => typeof p !== 'string')) {
    throw new Error('素材库记录无效：可用平台')
  }
  let commercialLicense: boolean | null = null
  if (value.commercialLicense === true) commercialLicense = true
  else if (value.commercialLicense === false) commercialLicense = false
  else if (value.commercialLicense != null) throw new Error('素材库记录无效：商用许可')
  const size = Number(value.size)
  const mtimeMs = Number(value.mtimeMs)
  if (!Number.isFinite(size) || !Number.isFinite(mtimeMs)) throw new Error('素材库记录无效：文件信息')
  return {
    id: reqString(value, 'id', '编号'),
    name: optString(value, 'name'),
    path: reqString(value, 'path', '路径'),
    pathKey: reqString(value, 'pathKey', '路径键'),
    sourceType: sourceType as SourceType,
    voucher: optString(value, 'voucher'),
    rightsHolder: optString(value, 'rightsHolder'),
    scope: optString(value, 'scope'),
    expiresOn: optString(value, 'expiresOn'),
    platforms,
    commercialLicense,
    capturedAt: optString(value, 'capturedAt'),
    importedAt: optString(value, 'importedAt'),
    sha256: optString(value, 'sha256'),
    perceptualHash: null,
    note: optString(value, 'note'),
    size,
    mtimeMs,
    metadata: coerceMedia(value.metadata),
    mediaError: optString(value, 'mediaError'),
    updatedAt: optString(value, 'updatedAt'),
  }
}

function coerceTask(value: unknown): TaskRecord {
  if (!isRecord(value)) throw new Error('任务记录无效')
  const status = value.status
  const allowed: TaskStatus[] = ['待处理', '处理中', '待人工复核', '阻断', '完成', '失败', '已提交', '平台结果已回填']
  if (typeof status !== 'string' || !allowed.includes(status as TaskStatus)) throw new Error('任务记录无效：状态')
  const outputHashes = Array.isArray(value.outputHashes) ? value.outputHashes : []
  return {
    id: reqString(value, 'id', '任务编号'),
    featureId: optString(value, 'featureId'),
    status: status as TaskStatus,
    ruleVersion: optString(value, 'ruleVersion') || RULE_VERSION,
    inputPaths: Array.isArray(value.inputPaths) ? value.inputPaths.filter((p): p is string => typeof p === 'string') : [],
    outputDir: optString(value, 'outputDir'),
    outputPaths: Array.isArray(value.outputPaths) ? value.outputPaths.filter((p): p is string => typeof p === 'string') : [],
    outputHashes: outputHashes
      .filter((row): row is Record<string, unknown> => isRecord(row))
      .filter((row) => typeof row.path === 'string' && typeof row.sha256 === 'string')
      .map((row) => ({ path: String(row.path), sha256: String(row.sha256) })),
    error: optString(value, 'error'),
    blockers: Array.isArray(value.blockers) ? value.blockers.filter((p): p is string => typeof p === 'string') : [],
    createdAt: optString(value, 'createdAt'),
    updatedAt: optString(value, 'updatedAt'),
  }
}

function coerceAudit(value: unknown): AuditEvent {
  if (!isRecord(value)) throw new Error('审计记录无效')
  const actor = value.actor === 'user' ? 'user' : value.actor === 'system' ? 'system' : null
  if (!actor) throw new Error('审计记录无效')
  return {
    id: reqString(value, 'id', '审计编号'),
    actor,
    action: optString(value, 'action'),
    entity: optString(value, 'entity'),
    timestamp: optString(value, 'timestamp'),
    traceId: optString(value, 'traceId'),
    before: isRecord(value.before) ? value.before : undefined,
    after: isRecord(value.after) ? value.after : undefined,
  }
}

function coerceSubmission(value: unknown): SubmissionMark {
  if (!isRecord(value)) throw new Error('平台回填记录无效')
  const reviewStatus = value.reviewStatus
  const allowed: ReviewStatus[] = ['未知', '待审核', '已出结果', '驳回']
  if (typeof reviewStatus !== 'string' || !allowed.includes(reviewStatus as ReviewStatus)) {
    throw new Error('平台回填记录无效：审核状态')
  }
  const badge = (key: string): boolean | null => {
    const current = value[key]
    if (current == null) return null
    if (typeof current !== 'boolean') throw new Error('平台回填记录无效：标记必须是明确的是或否')
    return current
  }
  return {
    id: reqString(value, 'id', '回填编号'),
    submittedAt: reqString(value, 'submittedAt', '提交时间'),
    reviewStatus: reviewStatus as ReviewStatus,
    qualityBadge: badge('qualityBadge'),
    originalBadge: badge('originalBadge'),
    inOriginalScope: value.inOriginalScope === true,
  }
}

export function migrateLibrary(raw: unknown): LibraryFile {
  if (!isRecord(raw)) throw new Error('素材库文件损坏，已保留原文件，没有覆盖素材')
  if (raw.schemaVersion == null) throw new Error('素材库缺少版本号，已保留原文件')
  if (raw.schemaVersion !== LIBRARY_SCHEMA_VERSION) {
    throw new Error(`不支持的素材库版本 ${String(raw.schemaVersion)}，需要迁移后再打开。原文件已保留`)
  }
  if (!Array.isArray(raw.assets) || !Array.isArray(raw.tasks) || !Array.isArray(raw.audits)) {
    throw new Error('素材库结构无效，已保留原文件')
  }
  const submissions = Array.isArray(raw.submissions) ? raw.submissions : []
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    assets: raw.assets.map(coerceAsset),
    tasks: raw.tasks.map(coerceTask),
    audits: raw.audits.map(coerceAudit),
    submissions: submissions.map(coerceSubmission),
  }
}

function platformAllowsQianchuan(platforms: string[]): boolean {
  return platforms.some((item) => {
    const text = item.trim()
    if (!text) return false
    if (text === '*' || text === '全部' || text === '不限') return true
    return QIANCHUAN.test(text)
  })
}

export function rightsDecision(
  asset: Pick<
    AssetRecord,
    | 'sourceType'
    | 'voucher'
    | 'rightsHolder'
    | 'scope'
    | 'expiresOn'
    | 'platforms'
    | 'commercialLicense'
    | 'metadata'
    | 'mediaError'
  >,
  now = new Date(),
): RightsDecision {
  if (asset.sourceType === '待核验') {
    return {
      allowed: false,
      status: '未核验',
      reasons: ['授权未确认（来源为待核验）。请登记自有拍摄或已获授权后再处理。'],
    }
  }

  const reasons: string[] = []
  if (!asset.rightsHolder.trim()) reasons.push('未填写权利人')
  if (asset.expiresOn) {
    if (!DATE_RE.test(asset.expiresOn)) reasons.push('到期日无效')
    else if (asset.expiresOn < localDateISO(now)) reasons.push('授权已过期')
  }
  if (asset.sourceType !== '自有拍摄') {
    if (!asset.voucher.trim()) reasons.push('缺少来源凭证')
    if (!asset.scope.trim()) reasons.push('授权范围未填写')
    if (!asset.platforms.length) reasons.push('可用平台未填写')
    else if (!platformAllowsQianchuan(asset.platforms)) reasons.push('授权范围不含巨量千川')
    if (asset.commercialLicense == null) reasons.push('商用许可未确认')
    else if (asset.commercialLicense === false) reasons.push('未授予商用许可')
  } else if (asset.commercialLicense === false) {
    reasons.push('未授予商用许可')
  }
  if (asset.mediaError) reasons.push(asset.mediaError)
  else if (!asset.metadata) reasons.push('媒体参数尚未核验')

  let status: RightsDecision['status'] = '有效'
  if (reasons.some((r) => r.includes('过期') || r.includes('到期日'))) status = '已过期'
  else if (reasons.some((r) => r.includes('平台') || r.includes('范围'))) status = '范围不符'
  else if (reasons.some((r) => r.includes('未授予商用许可'))) status = '无商用许可'
  else if (reasons.some((r) => r.includes('商用许可未确认'))) status = '商用许可未确认'
  else if (reasons.some((r) => /媒体|无法读取|损坏|找不到/.test(r))) status = '媒体不可读'
  else if (reasons.length) status = '阻断'

  return { allowed: reasons.length === 0, status, reasons }
}

function hasExplicitResult(row: SubmissionMark): boolean {
  return row.reviewStatus === '已出结果' || row.reviewStatus === '驳回'
}

/**
 * 优质率 = 平台明确标为优质的素材数 / 同期已有明确平台结果的素材数。
 * 首发率 = 平台明确标为首发且纳入统计范围的素材数 / 同期纳入范围并已有明确结果的素材数。
 * 未回填、待审核、未知都不算成功，也不进入分母。
 */
export function rollingPlatformRates(
  rows: SubmissionMark[],
  now = new Date(),
  windowDays = METRIC_WINDOW_DAYS,
): PlatformRateSnapshot {
  const start = now.getTime() - windowDays * 24 * 60 * 60 * 1000
  const inWindow = rows.filter((row) => {
    const time = Date.parse(row.submittedAt)
    return Number.isFinite(time) && time >= start && time <= now.getTime()
  })
  const explicit = inWindow.filter(hasExplicitResult)
  const pending = inWindow.filter((row) => row.reviewStatus === '待审核').length
  const rejected = explicit.filter((row) => row.reviewStatus === '驳回').length
  const qualityCount = explicit.filter((row) => row.reviewStatus === '已出结果' && row.qualityBadge === true).length
  const originalPool = explicit.filter((row) => row.inOriginalScope)
  const originalCount = originalPool.filter(
    (row) => row.reviewStatus === '已出结果' && row.originalBadge === true,
  ).length
  const notice =
    '70% 与 20% 是运营目标。只有巨量千川回填的明确标记才会计入；未回填不会被算成优质或首发。授权登记和裂变参数都不是平台标记。'
  return {
    targets: { qualityRate: QUALITY_BADGE_TARGET, originalRate: ORIGINAL_BADGE_TARGET },
    windowDays,
    asOf: now.toISOString(),
    insufficient: explicit.length === 0,
    originalInsufficient: originalPool.length === 0,
    qualityRate: explicit.length ? qualityCount / explicit.length : null,
    originalRate: originalPool.length ? originalCount / originalPool.length : null,
    denominator: explicit.length,
    originalDenominator: originalPool.length,
    qualityCount,
    originalCount,
    pending,
    rejected,
    notice,
  }
}
