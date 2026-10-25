import type { AppSettings } from '../config/settings'

export type LlmProvider = 'openai' | 'deepseek' | 'ollama' | 'custom'

export interface AiRuntimeConfig {
  llmProvider: LlmProvider
  baseUrl: string
  apiKey: string
  chatModel: string
  visionModel: string
  embedModel: string
  ollamaBaseUrl: string
}

const DEFAULTS = {
  chatModel: 'gpt-4o-mini',
  visionModel: 'gpt-4o-mini',
  embedModel: 'text-embedding-3-small',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
}

export function aiConfigFromSettings(s: AppSettings): AiRuntimeConfig {
  const llmProvider = (s.llmProvider ?? 'openai') as LlmProvider
  const ollamaBaseUrl = (s.ollamaBaseUrl ?? DEFAULTS.ollamaBaseUrl).replace(/\/$/, '')

  let baseUrl = 'https://api.openai.com/v1'
  let apiKey = (s.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '').trim()

  if (llmProvider === 'deepseek') {
    baseUrl = 'https://api.deepseek.com/v1'
    apiKey = (s.deepseekApiKey ?? apiKey).trim()
  } else if (llmProvider === 'ollama') {
    baseUrl = `${ollamaBaseUrl}/v1`
    apiKey = (s.ollamaApiKey ?? 'ollama').trim()
  } else if (llmProvider === 'custom') {
    baseUrl = (s.customApiBaseUrl ?? baseUrl).replace(/\/$/, '')
    if (!baseUrl.endsWith('/v1')) baseUrl = `${baseUrl}/v1`
    apiKey = (s.customApiKey ?? apiKey).trim()
  }

  return {
    llmProvider,
    baseUrl,
    apiKey,
    chatModel: s.chatModel?.trim() || DEFAULTS.chatModel,
    visionModel: s.visionModel?.trim() || s.chatModel?.trim() || DEFAULTS.visionModel,
    embedModel: s.embedModel?.trim() || DEFAULTS.embedModel,
    ollamaBaseUrl,
  }
}

export function aiConfigFromJobOptions(options: Record<string, unknown>): AiRuntimeConfig {
  const patch: AppSettings = {
    llmProvider: options.llmProvider as AppSettings['llmProvider'],
    openaiApiKey: String(options.openaiApiKey ?? ''),
    deepseekApiKey: String(options.deepseekApiKey ?? ''),
    ollamaBaseUrl: String(options.ollamaBaseUrl ?? ''),
    ollamaApiKey: String(options.ollamaApiKey ?? ''),
    customApiBaseUrl: String(options.customApiBaseUrl ?? ''),
    customApiKey: String(options.customApiKey ?? ''),
    chatModel: String(options.chatModel ?? ''),
    visionModel: String(options.visionModel ?? ''),
    embedModel: String(options.embedModel ?? ''),
  }
  return aiConfigFromSettings(patch)
}

export async function chatCompletion(
  cfg: AiRuntimeConfig,
  messages: unknown[],
  temperature = 0.7,
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.chatModel,
      temperature,
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Chat API ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  return data.choices[0]?.message?.content?.trim() ?? ''
}

export async function createEmbedding(cfg: AiRuntimeConfig, text: string): Promise<number[]> {
  const res = await fetch(`${cfg.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.embedModel,
      input: text.slice(0, 8000),
    }),
  })
  if (!res.ok) throw new Error(`Embedding API ${res.status}`)
  const data = (await res.json()) as { data: { embedding: number[] }[] }
  return data.data[0]?.embedding ?? []
}
