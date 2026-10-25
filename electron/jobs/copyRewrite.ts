import path from 'node:path'
import fs from 'node:fs/promises'
import type { FeatureJobRequest, FeatureJobResult, ProgressReporter } from './types'
import { ensureDir } from '../ffmpeg/util'

export async function runCopyRewriteJob(
  req: FeatureJobRequest,
  report: ProgressReporter,
): Promise<FeatureJobResult> {
  const { rewriteParagraphWithAi } = await import('./rewrite')
  const text = String(req.options.scriptText ?? '')
  const copies = Number(req.options.rewriteCopies ?? 3)
  const prompt = String(req.options.rewritePrompt ?? '')
  const cfg = (await import('../ai/providers')).aiConfigFromJobOptions(req.options)
  if (!text.trim()) return { ok: false, error: '文案为空' }

  await ensureDir(req.outputDir)
  const outputs: string[] = []
  const paragraphs = text.split(/\n{2,}/).filter(Boolean)

  for (let i = 0; i < copies; i++) {
    report({ percent: Math.floor((i / copies) * 90), message: `改写版本 ${i + 1}/${copies}` })
    const parts: string[] = []
    for (let idx = 0; idx < paragraphs.length; idx++) {
      const p = paragraphs[idx]!.trim()
      let body = p
      if (cfg.apiKey || cfg.llmProvider === 'ollama') {
        try {
          body = await rewriteParagraphWithAi(p, prompt, req.options)
        } catch {
          body = `${p}（改写失败，保留原文）`
        }
      } else {
        body = `${p}\n（本地占位：${prompt.slice(0, 40)}… · 版本 ${i + 1}）`
      }
      parts.push(`【版本 ${i + 1}-${idx + 1}】\n${body}`)
    }
    const out = path.join(req.outputDir, `文案改写_v${i + 1}_${Date.now()}.txt`)
    await fs.writeFile(out, parts.join('\n\n'), 'utf8')
    outputs.push(out)
    report({ percent: Math.floor(((i + 1) / copies) * 100), message: `已写入 ${path.basename(out)}` })
  }

  return { ok: true, outputs }
}
