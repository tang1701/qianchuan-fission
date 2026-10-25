import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDesktopApi } from '../services/desktop'

export type LlmProvider = 'openai' | 'deepseek' | 'ollama' | 'custom'

export const useAppSettingsStore = defineStore('appSettings', () => {
  const hasOpenAiKey = ref(false)
  const hasDeepseekKey = ref(false)
  const hasCustomKey = ref(false)
  const lastExportDir = ref('')
  const loaded = ref(false)

  const llmProvider = ref<LlmProvider>('openai')
  const openaiApiKeyDraft = ref('')
  const deepseekApiKeyDraft = ref('')
  const ollamaBaseUrl = ref('http://127.0.0.1:11434')
  const ollamaApiKeyDraft = ref('')
  const customApiBaseUrl = ref('')
  const customApiKeyDraft = ref('')
  const chatModel = ref('gpt-4o-mini')
  const visionModel = ref('gpt-4o-mini')
  const embedModel = ref('text-embedding-3-small')

  async function load() {
    const api = getDesktopApi()
    if (!api) {
      loaded.value = true
      return
    }
    const data = (await api.getSettings()) as Record<string, unknown>
    hasOpenAiKey.value = Boolean(data.hasOpenAiKey)
    hasDeepseekKey.value = Boolean(data.hasDeepseekKey)
    hasCustomKey.value = Boolean(data.hasCustomKey)
    lastExportDir.value = String(data.lastExportDir ?? '')
    llmProvider.value = (data.llmProvider as LlmProvider) ?? 'openai'
    ollamaBaseUrl.value = String(data.ollamaBaseUrl ?? 'http://127.0.0.1:11434')
    chatModel.value = String(data.chatModel ?? 'gpt-4o-mini')
    visionModel.value = String(data.visionModel ?? 'gpt-4o-mini')
    embedModel.value = String(data.embedModel ?? 'text-embedding-3-small')
    loaded.value = true
  }

  async function saveAll() {
    const api = getDesktopApi()
    if (!api?.setSettings) return
    const patch: Record<string, string> = {
      llmProvider: llmProvider.value,
      ollamaBaseUrl: ollamaBaseUrl.value.trim(),
      chatModel: chatModel.value.trim(),
      visionModel: visionModel.value.trim(),
      embedModel: embedModel.value.trim(),
      customApiBaseUrl: customApiBaseUrl.value.trim(),
    }
    if (openaiApiKeyDraft.value.trim()) patch.openaiApiKey = openaiApiKeyDraft.value.trim()
    if (deepseekApiKeyDraft.value.trim()) patch.deepseekApiKey = deepseekApiKeyDraft.value.trim()
    if (ollamaApiKeyDraft.value.trim()) patch.ollamaApiKey = ollamaApiKeyDraft.value.trim()
    if (customApiKeyDraft.value.trim()) patch.customApiKey = customApiKeyDraft.value.trim()

    const res = (await api.setSettings(patch)) as Record<string, unknown>
    hasOpenAiKey.value = Boolean(res.hasOpenAiKey)
    hasDeepseekKey.value = Boolean(res.hasDeepseekKey)
    hasCustomKey.value = Boolean(res.hasCustomKey)
    openaiApiKeyDraft.value = ''
    deepseekApiKeyDraft.value = ''
    ollamaApiKeyDraft.value = ''
    customApiKeyDraft.value = ''
  }

  return {
    hasOpenAiKey,
    hasDeepseekKey,
    hasCustomKey,
    lastExportDir,
    loaded,
    llmProvider,
    openaiApiKeyDraft,
    deepseekApiKeyDraft,
    ollamaBaseUrl,
    ollamaApiKeyDraft,
    customApiBaseUrl,
    customApiKeyDraft,
    chatModel,
    visionModel,
    embedModel,
    load,
    saveAll,
    saveOpenAiKey: saveAll,
  }
})
