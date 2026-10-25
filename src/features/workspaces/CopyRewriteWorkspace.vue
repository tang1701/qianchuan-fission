<script setup lang="ts">
import { computed } from 'vue'
import type { FeatureItem } from '../../types/feature'
import WorkspaceShell from '../../components/workspace/WorkspaceShell.vue'
import TaskOverlay from '../../components/workspace/TaskOverlay.vue'
import ExportPathField from '../../components/workspace/ExportPathField.vue'
import { useFeatureJob } from '../../composables/useFeatureJob'
import { useFeatureStateStore } from '../../stores/featureState'
import { getDesktopApi } from '../../services/desktop'
import { storeToRefs } from 'pinia'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ home: [] }>()

const store = useFeatureStateStore()
const { scriptText, rewritePrompt, rewriteCopies, rewriteResults } = storeToRefs(store)
const { running, progress, message, run: runJob } = useFeatureJob(props.feature.id)

const canRun = computed(() => scriptText.value.trim().length > 0)

async function onRun() {
  if (!canRun.value) return
  store.resetRewriteResults()
  const res = await runJob()
  if (res.ok && res.outputs?.length) {
    res.outputs.forEach((file) => {
      store.appendRewriteResult(`已导出：${file.split(/[/\\]/).pop() ?? file}`)
    })
    const open = confirm(`改写完成，共 ${res.outputs.length} 个 txt 文件。打开导出目录？`)
    if (open && store.exportPath) await getDesktopApi()?.openPath(store.exportPath)
  }
}

function copyAll() {
  const text = rewriteResults.value.map((r) => r.text).join('\n\n')
  void navigator.clipboard.writeText(text)
}
</script>

<template>
  <WorkspaceShell :title="feature.title" :feature-id="feature.id" @home="emit('home')">
    <div class="copy-tool">
      <section class="panel copy-tool__input">
        <header class="script-panel__head">
          <h3>原始文案</h3>
          <span class="badge badge--ok">支持批量粘贴</span>
        </header>
        <textarea
          v-model="scriptText"
          class="script-panel__textarea copy-tool__area"
          placeholder="粘贴需要改写的文案，多条可用空行分隔…"
        />
      </section>

      <section class="panel copy-tool__settings">
        <h3 class="copy-tool__settings-title">改写设置</h3>
        <label class="field-label">
          自定义提示词
          <textarea v-model="rewritePrompt" class="script-panel__textarea" rows="5" />
        </label>
        <label class="field-label">
          每条生成版本数
          <input v-model.number="rewriteCopies" type="number" min="1" max="20" class="text-input" />
        </label>
        <ExportPathField />
        <button
          type="button"
          class="btn btn--primary btn--block"
          :disabled="!canRun"
          @click="onRun"
        >
          {{ feature.primaryAction }}
        </button>
      </section>

      <section class="panel copy-tool__output">
        <header class="script-panel__head">
          <h3>改写结果</h3>
          <button
            type="button"
            class="btn btn--ghost btn--sm"
            :disabled="!rewriteResults.length"
            @click="copyAll"
          >
            复制全部
          </button>
        </header>
        <div v-if="!rewriteResults.length" class="empty-state empty-state--compact">
          <p class="empty-state__hint">改写结果将显示在这里（桌面版会写入 txt）</p>
        </div>
        <article v-for="r in rewriteResults" :key="r.id" class="rewrite-card">
          <p>{{ r.text }}</p>
        </article>
      </section>
    </div>
    <TaskOverlay :visible="running" :progress="progress" :message="message" />
  </WorkspaceShell>
</template>
