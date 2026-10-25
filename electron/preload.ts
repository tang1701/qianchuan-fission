import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

export type JobProgressPayload = { jobId?: number; percent: number; message: string }

type JobDonePayload = { jobId: number; result: { ok: boolean; error?: string; outputs?: string[] } }
type RunJobAck =
  | { accepted: true; jobId: number }
  | { ok: boolean; error?: string; outputs?: string[]; accepted?: false }

function waitJobResult(
  jobId: number,
  onProgress?: (p: JobProgressPayload) => void,
): Promise<{ ok: boolean; error?: string; outputs?: string[] }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        cleanup()
        reject(new Error('任务超时：主进程长时间无响应，请关闭窗口后重新 npm run dev:app'))
      },
      30 * 60 * 1000,
    )

    const onProg = (_: IpcRendererEvent, data: JobProgressPayload) => {
      if (data.jobId != null && data.jobId !== jobId) return
      onProgress?.(data)
    }
    const onDone = (_: IpcRendererEvent, data: JobDonePayload) => {
      if (data.jobId !== jobId) return
      cleanup()
      resolve(data.result)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      ipcRenderer.removeListener('eauto:jobProgress', onProg)
      ipcRenderer.removeListener('eauto:jobDone', onDone)
    }
    ipcRenderer.on('eauto:jobProgress', onProg)
    ipcRenderer.on('eauto:jobDone', onDone)
  })
}

contextBridge.exposeInMainWorld('eauto', {
  isDesktop: true,
  toMediaUrl: (filePath: string) =>
    `eauto://local/${encodeURIComponent(filePath.replace(/\\/g, '/'))}`,
  pickFolder: () => ipcRenderer.invoke('eauto:pickFolder'),
  pickVideos: () => ipcRenderer.invoke('eauto:pickVideos'),
  pickExportDir: () => ipcRenderer.invoke('eauto:pickExportDir'),
  pickAudio: () => ipcRenderer.invoke('eauto:pickAudio'),
  pickImage: () => ipcRenderer.invoke('eauto:pickImage'),
  getSettings: () => ipcRenderer.invoke('eauto:getSettings'),
  setSettings: (patch: unknown) => ipcRenderer.invoke('eauto:setSettings', patch),
  openPath: (targetPath: string) => ipcRenderer.invoke('eauto:openPath', targetPath),
  checkMediaPreview: (filePath: string) =>
    ipcRenderer.invoke('eauto:checkMediaPreview', filePath) as Promise<{ ok: boolean; reason?: string }>,
  licenseStatus: () => ipcRenderer.invoke('eauto:licenseStatus'),
  licenseActivate: (code: string) => ipcRenderer.invoke('eauto:licenseActivate', code),
  qualityInspect: (paths: string[]) => ipcRenderer.invoke('eauto:qualityInspect', paths),
  qualityUpdate: (filePath: string, patch: unknown) => ipcRenderer.invoke('eauto:qualityUpdate', filePath, patch),
  qualityApplyOwn: (paths: string[]) => ipcRenderer.invoke('eauto:qualityApplyOwn', paths),
  qualitySummary: () => ipcRenderer.invoke('eauto:qualitySummary'),
  runJob: (payload: unknown, onProgress?: (p: JobProgressPayload) => void) =>
    ipcRenderer.invoke('eauto:runJob', payload).then((ack: RunJobAck | null | undefined) => {
      if (!ack || typeof ack !== 'object') return { ok: false, error: '主进程无响应' }
      if (ack.accepted === true && typeof ack.jobId === 'number') {
        return waitJobResult(ack.jobId, onProgress)
      }
      if (typeof ack.ok === 'boolean') return ack
      return { ok: false, error: '任务未能启动（请完全退出 Electron 后重新 npm run dev:app）' }
    }),
  onJobProgress: (cb: (p: JobProgressPayload) => void) => {
    const listener = (_: IpcRendererEvent, data: JobProgressPayload) => cb(data)
    ipcRenderer.on('eauto:jobProgress', listener)
    return () => ipcRenderer.removeListener('eauto:jobProgress', listener)
  },
})
