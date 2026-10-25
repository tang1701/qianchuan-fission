<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAppSettingsStore, type LlmProvider } from '../stores/appSettings'
import { useFeatureStateStore } from '../stores/featureState'
import { isDesktopApp } from '../services/desktop'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const appSettings = useAppSettingsStore()
const featureState = useFeatureStateStore()
const {
  hasOpenAiKey,
  hasDeepseekKey,
  hasCustomKey,
  lastExportDir,
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
} = storeToRefs(appSettings)

const providers: { id: LlmProvider; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'ollama', label: 'Ollama 本地' },
  { id: 'custom', label: '自定义 OpenAI 兼容' },
]

async function save() {
  await appSettings.saveAll()
  if (lastExportDir.value && !featureState.exportPath) {
    featureState.exportPath = lastExportDir.value
  }
  emit('close')
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-card modal-card--wide" role="dialog" aria-labelledby="settings-title">
      <header class="modal-card__head">
        <h2 id="settings-title">全局设置 · 多 Provider</h2>
        <button type="button" class="folder-item__remove" @click="emit('close')">×</button>
      </header>

      <p v-if="!isDesktopApp()" class="settings-block__muted">
        浏览器模式下无法保存密钥，请使用桌面版。
      </p>

      <section class="settings-block">
        <h4 class="settings-block__title">默认 LLM 提供商</h4>
        <div class="tag-row">
          <button
            v-for="p in providers"
            :key="p.id"
            type="button"
            class="tag-btn"
            :class="{ 'tag-btn--active': llmProvider === p.id }"
            @click="llmProvider = p.id"
          >
            {{ p.label }}
          </button>
        </div>
      </section>

      <label class="field-label">
        OpenAI API Key
        <input
          v-model="openaiApiKeyDraft"
          type="password"
          class="text-input"
          :placeholder="hasOpenAiKey ? '已配置，输入可覆盖' : 'sk-…'"
        />
      </label>
      <label class="field-label">
        DeepSeek API Key
        <input
          v-model="deepseekApiKeyDraft"
          type="password"
          class="text-input"
          :placeholder="hasDeepseekKey ? '已配置' : 'sk-…'"
        />
      </label>
      <label class="field-label">
        Ollama 地址
        <input v-model="ollamaBaseUrl" class="text-input" placeholder="http://127.0.0.1:11434" />
      </label>
      <label class="field-label">
        Ollama API Key（可选）
        <input v-model="ollamaApiKeyDraft" type="password" class="text-input" />
      </label>
      <label class="field-label">
        自定义 API Base URL
        <input v-model="customApiBaseUrl" class="text-input" placeholder="https://…/v1" />
      </label>
      <label class="field-label">
        自定义 API Key
        <input
          v-model="customApiKeyDraft"
          type="password"
          class="text-input"
          :placeholder="hasCustomKey ? '已配置' : ''"
        />
      </label>

      <section class="settings-block">
        <h4 class="settings-block__title">模型名称</h4>
        <label class="field-label">
          对话 / 改写
          <input v-model="chatModel" class="text-input" />
        </label>
        <label class="field-label">
          Vision 选镜
          <input v-model="visionModel" class="text-input" />
        </label>
        <label class="field-label">
          文本嵌入（云端选镜）
          <input v-model="embedModel" class="text-input" />
        </label>
      </section>

      <p class="settings-block__muted">
        匹配模式：<strong>CLIP 本地</strong> 首次会下载 Xenova 模型；<strong>Vision API</strong> 使用上方 Vision
        模型；<strong>云端</strong> 使用嵌入模型。
      </p>

      <p v-if="lastExportDir" class="settings-block__muted">上次导出：{{ lastExportDir }}</p>

      <footer class="modal-card__foot">
        <button type="button" class="btn btn--ghost" @click="emit('close')">取消</button>
        <button type="button" class="btn btn--primary" @click="save">保存</button>
      </footer>
    </div>
  </div>
</template>
