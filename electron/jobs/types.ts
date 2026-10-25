export interface JobProgress {
  percent: number
  message: string
}

export interface FeatureJobRequest {
  featureId: string
  inputs: string[]
  outputDir: string
  options: Record<string, unknown>
}

export interface OutputQualityReport {
  path: string
  name: string
  score: number
  grade: '优先上传' | '可上传' | '建议重制'
  warnings: string[]
  checks: { id: string; ok: boolean; detail: string }[]
}

export interface FeatureJobResult {
  ok: boolean
  error?: string
  outputs?: string[]
  /** 导出后内部制作质量分析，用于提高过审/优质概率的选片参考，不是平台标签 */
  qualityReports?: OutputQualityReport[]
  uploadRecommendation?: string
}

export type ProgressReporter = (p: JobProgress) => void
