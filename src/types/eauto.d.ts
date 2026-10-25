export interface EautoFolderPickResult {
  name: string
  path: string
  files: { name: string; path: string }[]
}

export interface EautoVideoPickResult {
  name: string
  path: string
  size: number
  duration?: number
}

export interface EautoJobProgress {
  percent: number
  message: string
}

export interface OutputQualityReport {
  path: string
  name: string
  score: number
  grade: '优先上传' | '可上传' | '建议重制'
  warnings: string[]
  checks: { id: string; ok: boolean; detail: string }[]
}

export interface EautoJobResult {
  ok: boolean
  error?: string
  outputs?: string[]
  qualityReports?: OutputQualityReport[]
  uploadRecommendation?: string
}

export interface EautoSettingsPatch {
  openaiApiKey?: string
  deepseekApiKey?: string
  ollamaBaseUrl?: string
  ollamaApiKey?: string
  customApiBaseUrl?: string
  customApiKey?: string
  llmProvider?: 'openai' | 'deepseek' | 'ollama' | 'custom'
  chatModel?: string
  visionModel?: string
  embedModel?: string
  lastExportDir?: string
}

export interface EautoSettingsView {
  hasOpenAiKey?: boolean
  hasDeepseekKey?: boolean
  hasCustomKey?: boolean
  llmProvider?: string
  ollamaBaseUrl?: string
  chatModel?: string
  visionModel?: string
  embedModel?: string
  lastExportDir?: string
}

export type QualitySourceType = '自有拍摄' | '已授权' | '购买授权' | '平台允许使用' | '待核验'

export interface QualityAssetView {
  id: string
  name: string
  path: string
  sourceType: QualitySourceType
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
  metadata: {
    durationSec: number
    width: number
    height: number
    fps: number
    videoCodec: string
    audioCodec: string
    hasAudio: boolean
    container: string
  } | null
  mediaError: string
  badge: string
  reasons: string[]
  duplicateOf: { path: string; name: string }[]
}

export interface QualityRightsPatch {
  sourceType: QualitySourceType
  voucher: string
  rightsHolder: string
  scope: string
  expiresOn: string
  platformsText: string
  commercialLicense: 'unset' | 'yes' | 'no'
  note: string
}

export interface QualitySummary {
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

export interface QualityInspectResult {
  ok: boolean
  error?: string
  assets: QualityAssetView[]
}

export interface QualityUpdateResult {
  ok: boolean
  error?: string
  asset?: QualityAssetView
}

export interface QualitySummaryResult {
  ok: boolean
  error?: string
  summary?: QualitySummary
}

export interface EautoLicenseStatus {
  machineCode: string
  mode: 'trial' | 'licensed' | 'expired'
  trialUsed: number
  trialLimit: number
  trialRemaining: number
  expiresAt: number | null
  enforce: boolean
}

export interface EautoLicenseStatusResult {
  ok: boolean
  error?: string
  status?: EautoLicenseStatus
}

export interface EautoLicenseActivateResult {
  ok: boolean
  error?: string
  expiresAt?: number
  status?: EautoLicenseStatus
}

export interface EautoDesktopApi {
  isDesktop: boolean
  toMediaUrl: (filePath: string) => string
  pickFolder: () => Promise<EautoFolderPickResult | null>
  pickVideos: () => Promise<EautoVideoPickResult[]>
  pickExportDir: () => Promise<string | null>
  pickAudio: () => Promise<string | null>
  pickImage: () => Promise<string | null>
  getSettings: () => Promise<EautoSettingsView>
  setSettings: (patch: EautoSettingsPatch) => Promise<EautoSettingsView & { ok?: boolean }>
  openPath: (targetPath: string) => Promise<{ ok?: boolean; error?: string }>
  checkMediaPreview: (filePath: string) => Promise<{ ok: boolean; reason?: string }>
  licenseStatus: () => Promise<EautoLicenseStatusResult>
  licenseActivate: (code: string) => Promise<EautoLicenseActivateResult>
  qualityInspect: (paths: string[]) => Promise<QualityInspectResult>
  qualityUpdate: (filePath: string, patch: QualityRightsPatch) => Promise<QualityUpdateResult>
  qualityApplyOwn: (paths: string[]) => Promise<QualityInspectResult>
  qualitySummary: () => Promise<QualitySummaryResult>
  runJob: (
    payload: unknown,
    onProgress?: (p: EautoJobProgress) => void,
  ) => Promise<EautoJobResult>
  onJobProgress: (cb: (p: EautoJobProgress) => void) => () => void
}

declare global {
  interface Window {
    eauto?: EautoDesktopApi
  }
}

export {}
