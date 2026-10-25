import { aiConfigFromJobOptions, chatCompletion } from '../ai/providers'

export async function rewriteParagraphWithAi(
  paragraph: string,
  prompt: string,
  jobOptions: Record<string, unknown>,
): Promise<string> {
  const cfg = aiConfigFromJobOptions(jobOptions)
  if (!cfg.apiKey && cfg.llmProvider !== 'ollama') {
    throw new Error('未配置 API Key')
  }
  return chatCompletion(
    cfg,
    [
      {
        role: 'system',
        content: prompt || '你是短视频文案编辑，保持原意，改写为口语化、适合口播的文案。',
      },
      { role: 'user', content: paragraph },
    ],
    0.85,
  )
}
