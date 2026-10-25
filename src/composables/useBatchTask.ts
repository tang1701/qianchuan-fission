import { ref } from 'vue'

export function useBatchTask() {
  const running = ref(false)
  const progress = ref(0)
  const message = ref('')

  function runTask(label: string, totalSteps = 20): Promise<void> {
    if (running.value) return Promise.resolve()
    running.value = true
    progress.value = 0
    message.value = `${label}…`

    return new Promise((resolve) => {
      let step = 0
      const timer = window.setInterval(() => {
        step += 1
        progress.value = Math.min(100, Math.round((step / totalSteps) * 100))
        if (step >= totalSteps) {
          window.clearInterval(timer)
          message.value = `${label}完成`
          running.value = false
          resolve()
        }
      }, 120)
    })
  }

  return { running, progress, message, runTask }
}
