import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { runBatchToolJob } from './batchTools'
import { runVideoEffectsJob } from './videoEffects'
import { runAiMixJob } from './aiMix'
import { runVideoMixJob } from './videoMix'
import { runCategoryMixJob } from './categoryMix'
import { runContentExtractJob } from './contentExtract'
import { runCopyRewriteJob } from './copyRewrite'
import { runDramaMixJob } from './dramaMix'

const BATCH_TOOLS = new Set([
  'batch-crop',
  'audio-extract',
  'subtitle-erase',
  'md5-diff',
])

export async function runFeatureJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  if (BATCH_TOOLS.has(req.featureId)) return runBatchToolJob(req, report)
  if (req.featureId === 'video-effects') return runVideoEffectsJob(req, report)
  if (req.featureId === 'ai-mix') return runAiMixJob(req, report)
  if (req.featureId === 'video-mix') return runVideoMixJob(req, report)
  if (req.featureId === 'category-mix') return runCategoryMixJob(req, report)
  if (req.featureId === 'content-extract') return runContentExtractJob(req, report)
  if (req.featureId === 'drama-mix') return runDramaMixJob(req, report)
  if (req.featureId === 'copy-rewrite') return runCopyRewriteJob(req, report)
  return { ok: false, error: `未实现的任务类型: ${req.featureId}` }
}
