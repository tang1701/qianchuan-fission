import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

export type LlmProvider = 'openai' | 'deepseek' | 'ollama' | 'custom'

export interface AppSettings {
  openaiApiKey?: string
  deepseekApiKey?: string
  ollamaBaseUrl?: string
  ollamaApiKey?: string
  customApiBaseUrl?: string
  customApiKey?: string
  llmProvider?: LlmProvider
  chatModel?: string
  visionModel?: string
  embedModel?: string
  lastExportDir?: string
}

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsFile(), 'utf8')
    return JSON.parse(raw) as AppSettings
  } catch {
    return {}
  }
}

export async function saveSettings(patch: AppSettings): Promise<AppSettings> {
  const current = await loadSettings()
  const next = { ...current, ...patch }
  await fs.mkdir(path.dirname(settingsFile()), { recursive: true })
  await fs.writeFile(settingsFile(), JSON.stringify(next, null, 2), 'utf8')
  if (next.openaiApiKey) process.env.OPENAI_API_KEY = next.openaiApiKey
  return next
}

export async function applySettingsToEnv(): Promise<AppSettings> {
  const s = await loadSettings()
  if (s.openaiApiKey) process.env.OPENAI_API_KEY = s.openaiApiKey
  return s
}

/** 注入任务 options（不含明文 Key 回传前端） */
export function mergeSettingsIntoJobOptions(
  options: Record<string, unknown>,
  settings: AppSettings,
): void {
  if (settings.llmProvider) options.llmProvider = settings.llmProvider
  if (settings.openaiApiKey && !options.openaiApiKey) {
    options.openaiApiKey = settings.openaiApiKey
  }
  if (settings.deepseekApiKey && !options.deepseekApiKey) {
    options.deepseekApiKey = settings.deepseekApiKey
  }
  if (settings.ollamaBaseUrl && !options.ollamaBaseUrl) {
    options.ollamaBaseUrl = settings.ollamaBaseUrl
  }
  if (settings.ollamaApiKey && !options.ollamaApiKey) {
    options.ollamaApiKey = settings.ollamaApiKey
  }
  if (settings.customApiBaseUrl && !options.customApiBaseUrl) {
    options.customApiBaseUrl = settings.customApiBaseUrl
  }
  if (settings.customApiKey && !options.customApiKey) {
    options.customApiKey = settings.customApiKey
  }
  if (settings.chatModel && !options.chatModel) options.chatModel = settings.chatModel
  if (settings.visionModel && !options.visionModel) options.visionModel = settings.visionModel
  if (settings.embedModel && !options.embedModel) options.embedModel = settings.embedModel
}

export function publicSettingsView(s: AppSettings) {
  return {
    hasOpenAiKey: Boolean(s.openaiApiKey?.trim()),
    hasDeepseekKey: Boolean(s.deepseekApiKey?.trim()),
    hasCustomKey: Boolean(s.customApiKey?.trim()),
    llmProvider: s.llmProvider ?? 'openai',
    ollamaBaseUrl: s.ollamaBaseUrl ?? 'http://127.0.0.1:11434',
    chatModel: s.chatModel ?? 'gpt-4o-mini',
    visionModel: s.visionModel ?? 'gpt-4o-mini',
    embedModel: s.embedModel ?? 'text-embedding-3-small',
    lastExportDir: s.lastExportDir ?? '',
  }
}
