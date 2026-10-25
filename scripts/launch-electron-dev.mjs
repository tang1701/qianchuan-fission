import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  printElectronBlockedHelp,
  resolveRunnableElectron,
} from './electron-utils.mjs'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

async function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.end()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
  })
}

/** 与 vite.config.ts DEV_SERVER_PORT 一致 */
const DEV_PORT = 17319
const url = process.env.VITE_DEV_SERVER_URL || `http://127.0.0.1:${DEV_PORT}`

if (!(await portOpen(DEV_PORT))) {
  console.error(
    `未检测到 EAuto 开发服务 (${url})。\n请先在本项目执行: npm run dev:app\n` +
      `若端口被占用，请关闭占用 ${DEV_PORT} 的进程后重试。`,
  )
  process.exit(1)
}

process.env.VITE_DEV_SERVER_URL = url
console.log(`启动 Electron，加载 ${url}`)

let resolved
try {
  resolved = await resolveRunnableElectron(rootDir)
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}

const { exe: electronExe, source, version, probe } = resolved

if (!version) {
  printElectronBlockedHelp(electronExe ?? '')
  console.error('\n若尚未安装 WinGet 版 Electron，请执行: npm run setup:electron-win')
  process.exit(1)
}

if (source === 'winget') {
  console.log(
    '提示: node_modules 内 Electron 被系统拦截，已自动改用 WinGet 安装的 Electron（开发可用，版本可能与 package 略有差异）。',
  )
}
console.log(`Electron ${version} (${source})`)
console.log('提示: 若刚改过 electron/ 或 preload，请先关掉本窗口再重新 npm run dev:app')

const child = spawn(electronExe, ['.'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
  windowsHide: false,
})

child.on('error', (err) => {
  console.error('无法启动 Electron:', err.message)
  if (probe && !probe.ok) printElectronBlockedHelp(electronExe)
  process.exit(1)
})

child.on('exit', (code) => process.exit(code ?? 0))
