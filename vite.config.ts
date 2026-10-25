// @ts-nocheck — 动态 import electron-utils.mjs
import vue from '@vitejs/plugin-vue'
import { spawn, type ChildProcess } from 'node:child_process'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
const rootDir = import.meta.dirname

/** 专用端口，避免与 5173 上其它项目（如前端研习）冲突 */
export const DEV_SERVER_PORT = 17319

let electronProc: ChildProcess | null = null
let electronBooting = false

/** 开发时主进程/preload 变更后重启 Electron（否则 IPC 与界面版本不一致会卡死） */
async function restartElectronApp() {
  if (electronBooting) return
  electronBooting = true
  try {
    if (electronProc) {
      electronProc.removeAllListeners()
      electronProc.kill()
      electronProc = null
    }
    const { resolveRunnableElectron } = await import('./scripts/electron-utils.mjs')
    const { exe, source } = await resolveRunnableElectron(rootDir)
    const devUrl =
      process.env.VITE_DEV_SERVER_URL || `http://127.0.0.1:${DEV_SERVER_PORT}`
    console.log(`\n[dev:app] 启动 Electron (${source})`)
    console.log(`[dev:app] 加载 ${devUrl}\n`)
    electronProc = spawn(exe, ['.'], {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, VITE_DEV_SERVER_URL: devUrl },
    })
    electronProc.on('exit', () => {
      electronProc = null
    })
  } catch (e) {
    console.error('[dev:app] 无法启动 Electron:', e instanceof Error ? e.message : e)
    console.error('请先执行: npm run doctor:electron 或 npm run setup:electron-win\n')
  } finally {
    electronBooting = false
  }
}

const onElectronStart = () => {
  void restartElectronApp()
}

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
  },
  server: {
    host: '127.0.0.1',
    port: DEV_SERVER_PORT,
    strictPort: true,
  },
  plugins: [
    vue(),
    {
      name: 'eauto-electron-html',
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin(="anonymous")?/g, '')
      },
    },
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart: onElectronStart,
        vite: {
          build: {
            rolldownOptions: {
              external: ['@xenova/transformers', 'ffmpeg-static', 'ffprobe-static'],
            },
          },
        },
      },
      preload: {
        input: `${rootDir}/electron/preload.ts`,
        onstart: onElectronStart,
      },
    }),
  ],
})
