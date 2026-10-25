import { onUnmounted, ref } from 'vue'
import type { EautoJobResult } from '../types/eauto'
import { buildJobPayload } from '../services/buildJobPayload'
import { getDesktopApi, isDesktopApp } from '../services/desktop'
import { useMaterialStore } from '../stores/material'
import { useBatchTask } from './useBatchTask'

export function useFeatureJob(featureId: string) {
  const running = ref(false)
  const progress = ref(0)
  const message = ref('')
  const lastOutputs = ref<string[]>([])
  const fallback = useBatchTask()
  let unsubscribe: (() => void) | null = null

  onUnmounted(() => {
    unsubscribe?.()
  })

  async function run() {
    lastOutputs.value = []
    const payload = buildJobPayload(featureId)

    if (!payload.outputDir) {
      window.alert('请先选择或填写导出目录')
      return { ok: false as const }
    }

    const api = getDesktopApi()
    if (!api) {
      if (!payload.inputs.length && featureId !== 'copy-rewrite') {
        window.alert('浏览器模式无法导出到本地，请使用 npm run dev:app 启动桌面版（Electron）')
        return { ok: false as const }
      }
      running.value = true
      await fallback.runTask('演示处理（未导出文件）')
      running.value = false
      progress.value = 100
      return { ok: true as const, demo: true as const }
    }

    if (featureId !== 'copy-rewrite' && !payload.inputs.length) {
      const material = useMaterialStore()
      const onlyBlob = material.looseVideos.some((v) => !v.path && v.objectUrl)
      window.alert(
        onlyBlob
          ? '当前素材没有本地路径（可能是浏览器式导入）。请点击左侧「导入视频」重新选择文件后再处理。'
          : '请先导入素材或视频',
      )
      return { ok: false as const }
    }

    running.value = true
    progress.value = 0
    message.value = '正在启动…'
    unsubscribe?.()
    unsubscribe = null

    let result: EautoJobResult
    try {
      result = await api.runJob(payload, (p) => {
        progress.value = p.percent
        message.value = p.message
      })
    } catch (e) {
      running.value = false
      let msg = e instanceof Error ? e.message : String(e)
      if (/could not be cloned|克隆/i.test(msg)) {
        msg = '任务参数无法序列化，请刷新页面后重试；若仍失败请反馈给开发者。'
      }
      message.value = msg
      window.alert(msg)
      return { ok: false as const }
    }
    running.value = false

    if (!result.ok) {
      message.value = result.error ?? '任务失败'
      window.alert(result.error ?? '任务失败')
      return { ok: false as const }
    }

    lastOutputs.value = result.outputs ?? []
    message.value = `完成，共 ${lastOutputs.value.length} 个文件`
    progress.value = 100
    return { ok: true as const, outputs: lastOutputs.value }
  }

  return {
    running,
    progress,
    message,
    lastOutputs,
    isDesktopApp,
    run,
  }
}
