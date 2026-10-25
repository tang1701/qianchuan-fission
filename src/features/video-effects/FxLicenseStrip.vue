<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { EautoLicenseStatus } from '../../types/eauto'
import { getDesktopApi } from '../../services/desktop'

const status = ref<EautoLicenseStatus | null>(null)
const code = ref('')
const busy = ref(false)
const hint = ref('')

const label = computed(() => {
  const s = status.value
  if (!s) return '授权加载中…'
  if (!s.enforce) return '开发模式（裂变不限次，下方仍可测激活）'
  if (s.mode === 'licensed' && s.expiresAt) {
    const d = new Date(s.expiresAt).toLocaleDateString('zh-CN')
    return `已激活 · 有效期至 ${d}`
  }
  if (s.mode === 'expired') return '激活已过期，请输入新激活码'
  return `试用 · 还可裂变 ${s.trialRemaining}/${s.trialLimit} 次任务`
})

async function refresh() {
  const api = getDesktopApi()
  if (!api?.licenseStatus) return
  const res = await api.licenseStatus()
  if (res.ok && res.status) status.value = res.status
}

async function copyMachine() {
  const mc = status.value?.machineCode
  if (!mc) return
  try {
    await navigator.clipboard.writeText(mc)
    hint.value = '机器码已复制'
  } catch {
    hint.value = mc
  }
}

async function activate() {
  const api = getDesktopApi()
  if (!api?.licenseActivate || !code.value.trim()) return
  busy.value = true
  hint.value = ''
  try {
    const res = await api.licenseActivate(code.value.trim())
    if (res.ok) {
      code.value = ''
      status.value = res.status ?? status.value
      hint.value = '激活成功'
    } else {
      hint.value = res.error ?? '激活失败'
    }
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  void refresh()
})

defineExpose({ refresh })
</script>

<template>
  <div v-if="status" class="fx-license">
    <span class="fx-license__label">{{ label }}</span>
    <button
      v-if="status.mode !== 'licensed'"
      type="button"
      class="fx-license__link"
      title="复制机器码发给作者"
      @click="copyMachine"
    >
      复制机器码 {{ status.machineCode }}
    </button>
    <template v-if="status.mode !== 'licensed'">
      <input
        v-model="code"
        class="fx-license__input"
        type="text"
        placeholder="粘贴激活码"
        autocomplete="off"
      />
      <button type="button" class="fx-license__btn" :disabled="busy || !code.trim()" @click="activate">
        激活
      </button>
    </template>
    <span v-if="hint" class="fx-license__hint">{{ hint }}</span>
  </div>
</template>
