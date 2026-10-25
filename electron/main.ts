import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron'
import {
  applySettingsToEnv,
  loadSettings,
  mergeSettingsIntoJobOptions,
  publicSettingsView,
  saveSettings,
  type AppSettings,
} from './config/settings'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { runFeatureJob } from './jobs/index'
import type { FeatureJobRequest } from './jobs/types'
import { probeDuration, scanVideosInDir, VIDEO_EXT } from './ffmpeg/util'
import { getLicenseService } from './license/service'
import { checkMediaPreviewPath, serveEautoLocalFile } from './mediaProtocol'
import { createQualityService, parseRightsPatch, validateJobOutputs } from './quality/assetService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'eauto',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0f1114',
    title: '千川裂变神器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html')
    void mainWindow.loadFile(indexHtml)
  }
}

app.whenReady().then(async () => {
  await applySettingsToEnv()

  protocol.handle('eauto', (request) => serveEautoLocalFile(request))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('eauto:pickFolder', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const folderPath = result.filePaths[0]
  const videos = await scanVideosInDir(folderPath)
  const name = path.basename(folderPath)
  return {
    name,
    path: folderPath,
    files: videos.map((p) => ({ name: path.basename(p), path: p })),
  }
})

ipcMain.handle('eauto:pickVideos', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'] }],
  })
  if (result.canceled) return []
  const files = await Promise.all(
    result.filePaths.map(async (p) => {
      let duration = 0
      try {
        duration = await probeDuration(p)
      } catch {
        /* ignore */
      }
      return {
        name: path.basename(p),
        path: p,
        size: (await fs.stat(p)).size,
        duration,
      }
    }),
  )
  return files
})

ipcMain.handle('eauto:pickExportDir', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const dir = result.filePaths[0]
  await saveSettings({ lastExportDir: dir })
  return dir
})

ipcMain.handle('eauto:pickAudio', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac'] }],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
})

ipcMain.handle('eauto:pickImage', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
})

ipcMain.handle('eauto:getSettings', async () => {
  const s = await loadSettings()
  return publicSettingsView(s)
})

ipcMain.handle('eauto:setSettings', async (_event, patch: AppSettings) => {
  const current = await loadSettings()
  const next: AppSettings = { ...current, ...patch }
  if (patch.openaiApiKey !== undefined && !patch.openaiApiKey?.trim()) {
    delete next.openaiApiKey
  }
  const saved = await saveSettings(next)
  return { ok: true, ...publicSettingsView(saved) }
})

ipcMain.handle('eauto:licenseStatus', async () => {
  try {
    const status = await getLicenseService().getStatus()
    return { ok: true, status }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('eauto:licenseActivate', async (_event, code: unknown) => {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, error: '请输入激活码' }
  try {
    const result = await getLicenseService().activate(code)
    if (!result.ok) return result
    const status = await getLicenseService().getStatus()
    return { ok: true, expiresAt: result.expiresAt, status }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('eauto:checkMediaPreview', async (_event, filePath: unknown) => {
  if (typeof filePath !== 'string' || !filePath.trim()) return { ok: false, reason: '无本地路径' }
  return checkMediaPreviewPath(filePath)
})

ipcMain.handle('eauto:openPath', async (_event, targetPath: string) => {
  if (!targetPath) return { ok: false }
  const err = await shell.openPath(targetPath)
  return { ok: !err, error: err || undefined }
})

let jobSerial = 0
let qualitySvc: ReturnType<typeof createQualityService> | null = null

function getQuality() {
  if (!qualitySvc) qualitySvc = createQualityService(path.join(app.getPath('userData'), 'quality'))
  return qualitySvc
}

function asPathList(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length > 500) return null
  const paths: string[] = []
  for (const item of input) {
    if (typeof item !== 'string') return null
    const value = item.trim()
    if (!value || value.length > 1024 || value.includes('\0')) return null
    paths.push(value)
  }
  return paths
}

ipcMain.handle('eauto:qualityInspect', async (_event, input: unknown) => {
  try {
    const paths = asPathList(input)
    if (!paths) return { ok: false, error: '素材路径无效', assets: [] }
    const assets = await getQuality().inspect(paths)
    return { ok: true, assets }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), assets: [] }
  }
})

ipcMain.handle('eauto:qualityUpdate', async (_event, filePath: unknown, patch: unknown) => {
  try {
    if (typeof filePath !== 'string' || !filePath.trim()) return { ok: false, error: '素材路径无效' }
    const asset = await getQuality().updateRights(filePath, parseRightsPatch(patch))
    return { ok: true, asset }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})

ipcMain.handle('eauto:qualityApplyOwn', async (_event, input: unknown) => {
  try {
    const paths = asPathList(input)
    if (!paths?.length) return { ok: false, error: '没有可登记的素材', assets: [] }
    const assets = await getQuality().applyOwnFootage(paths)
    return { ok: true, assets }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), assets: [] }
  }
})

ipcMain.handle('eauto:qualitySummary', async () => {
  try {
    const summary = await getQuality().summary()
    return { ok: true, summary }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})

/** 长任务异步执行，避免 invoke 阻塞导致渲染进程收不到 jobProgress */
ipcMain.handle('eauto:runJob', async (event, payload: FeatureJobRequest) => {
  const wc = event.sender
  if (wc.isDestroyed()) return { ok: false, error: '窗口已关闭' }

  const jobId = ++jobSerial
  void (async () => {
    const report = (p: { percent: number; message: string }) => {
      if (!wc.isDestroyed()) wc.send('eauto:jobProgress', { jobId, ...p })
    }
    let taskId = ''
    try {
      report({ percent: 0, message: '任务已接收…' })
      if (payload.outputDir) await saveSettings({ lastExportDir: payload.outputDir })
      const settings = await loadSettings()
      mergeSettingsIntoJobOptions(payload.options, settings)
      const inputs = Array.isArray(payload.inputs) ? payload.inputs.filter((item) => typeof item === 'string' && item.trim()) : []
      const licenseGate = await getLicenseService().assertCanProcess(payload.featureId)
      if (!licenseGate.ok) {
        if (!wc.isDestroyed()) wc.send('eauto:jobDone', { jobId, result: { ok: false, error: licenseGate.error } })
        return
      }
      const enforceRights = payload.options?.fxEnforceRights === true
      if (inputs.length) {
        report({
          percent: 0,
          message: enforceRights ? '正在核验授权、重复文件与导出路径…' : '正在检查导出路径与素材是否可读…',
        })
        const gate = await getQuality().preflight(
          {
            featureId: payload.featureId,
            inputs,
            outputDir: payload.outputDir || '',
            enforceRights,
          },
          (message) => report({ percent: 0, message }),
        )
        taskId = gate.taskId
        if (!gate.ok) {
          if (!wc.isDestroyed()) wc.send('eauto:jobDone', { jobId, result: { ok: false, error: gate.error } })
          return
        }
        await getQuality().markRunning(taskId)
      }
      const result = await runFeatureJob(payload, report)
      if (taskId) {
        if (!result.ok) {
          await getQuality().finish(taskId, '失败', result.error || '任务失败', result.outputs ?? [])
        } else {
          report({ percent: 99, message: '正在校验输出，确认没有覆盖原素材…' })
          const check = await validateJobOutputs(inputs, result.outputs ?? [])
          if (!check.ok) {
            await getQuality().finish(taskId, '失败', check.error, result.outputs ?? [])
            if (!wc.isDestroyed()) wc.send('eauto:jobDone', { jobId, result: { ok: false, error: check.error } })
            return
          }
          await getQuality().finish(taskId, '完成', '', result.outputs ?? [])
          if (result.ok) {
            await getLicenseService().recordSuccessfulJob(payload.featureId)
          }
        }
      } else if (result.ok) {
        await getLicenseService().recordSuccessfulJob(payload.featureId)
      }
      if (!wc.isDestroyed()) wc.send('eauto:jobDone', { jobId, result })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (taskId) await getQuality().finish(taskId, '失败', message, []).catch(() => undefined)
      const result = { ok: false as const, error: message }
      if (!wc.isDestroyed()) wc.send('eauto:jobDone', { jobId, result })
    }
  })().catch((e) => {
    const result = { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    if (!wc.isDestroyed()) wc.send('eauto:jobDone', { jobId, result })
  })

  return { accepted: true as const, jobId }
})

export { VIDEO_EXT }
