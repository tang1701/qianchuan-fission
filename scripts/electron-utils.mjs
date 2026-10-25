import { exec, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const execAsync = promisify(exec)

export function findWingetElectronExecutable() {
  if (process.platform !== 'win32') return null
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return null
  const packagesDir = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages')
  if (!fs.existsSync(packagesDir)) return null

  let chosen = null
  for (const name of fs.readdirSync(packagesDir)) {
    if (!/^OpenJS\.Electron\./i.test(name)) continue
    const exe = path.join(packagesDir, name, 'electron.exe')
    if (!fs.existsSync(exe)) continue
    if (!chosen || name.localeCompare(chosen.name, undefined, { numeric: true }) > 0) {
      chosen = { name, exe }
    }
  }
  return chosen?.exe ?? null
}

export function resolveElectronExecutable(rootDir) {
  const override = process.env.EAUTO_ELECTRON_EXE?.trim()
  if (override) {
    if (!fs.existsSync(override)) {
      throw new Error(`EAUTO_ELECTRON_EXE 指向的文件不存在:\n  ${override}`)
    }
    return override
  }

  const electronDir = path.join(rootDir, 'node_modules', 'electron')
  const pathFile = path.join(electronDir, 'path.txt')
  if (!fs.existsSync(pathFile)) {
    throw new Error('未找到 Electron，请执行: npm install && node node_modules/electron/install.js')
  }
  const name = fs.readFileSync(pathFile, 'utf8').trim()
  const exe = path.join(electronDir, 'dist', name)
  if (!fs.existsSync(exe)) {
    throw new Error(`Electron 缺失: ${exe}\n请运行: node node_modules/electron/install.js`)
  }
  return exe
}

/** node_modules 优先；若被 Device Guard 拦截则尝试 WinGet 版 Electron */
export async function resolveRunnableElectron(rootDir) {
  const override = process.env.EAUTO_ELECTRON_EXE?.trim()
  if (override) {
    if (!fs.existsSync(override)) {
      throw new Error(`EAUTO_ELECTRON_EXE 指向的文件不存在:\n  ${override}`)
    }
    const probe = await probeElectronLaunch(override, rootDir)
    if (!probe.ok) {
      return { exe: override, source: 'env', probe }
    }
    return { exe: override, source: 'env', version: probe.version }
  }

  let npmExe
  try {
    npmExe = resolveElectronExecutable(rootDir)
  } catch (e) {
    npmExe = null
  }

  if (npmExe) {
    const probe = await probeElectronLaunch(npmExe, rootDir)
    if (probe.ok) return { exe: npmExe, source: 'npm', version: probe.version }
  }

  const winget = findWingetElectronExecutable()
  if (winget) {
    const probe = await probeElectronLaunch(winget, rootDir)
    if (probe.ok) {
      return { exe: winget, source: 'winget', version: probe.version }
    }
  }

  const failedProbe = npmExe ? await probeElectronLaunch(npmExe, rootDir) : null
  return { exe: npmExe ?? winget, source: 'blocked', probe: failedProbe }
}

function isDeviceGuardMessage(text) {
  return /device guard|应用程序控制|组织|阻止|blocked|智能应用|Smart App/i.test(text)
}

function isSpawnUnknown(err) {
  return err?.code === 'UNKNOWN' || err?.errno === -4094
}

export async function probeElectronLaunch(exe, rootDir) {
  try {
    const { stdout, stderr } = await execFileAsync(exe, ['--version'], {
      cwd: rootDir,
      timeout: 20000,
      windowsHide: true,
    })
    return { ok: true, version: (stdout || stderr).trim() }
  } catch (e) {
    const err = e
    let blob = [err?.message, err?.stderr, err?.stdout].filter(Boolean).join('\n')
    if (!blob.trim() || isSpawnUnknown(err)) {
      try {
        const { stdout, stderr } = await execAsync(`"${exe}" --version`, {
          cwd: rootDir,
          timeout: 20000,
          windowsHide: true,
        })
        return { ok: true, version: (stdout || stderr).trim() }
      } catch (e2) {
        const err2 = e2
        blob += `\n${[err2?.message, err2?.stderr, err2?.stdout].filter(Boolean).join('\n')}`
      }
    }
    if (isDeviceGuardMessage(blob)) return { ok: false, reason: 'device-guard', detail: blob }
    if (isSpawnUnknown(err)) return { ok: false, reason: 'spawn-unknown', detail: blob }
    return { ok: false, reason: 'other', detail: blob || String(err?.message ?? err) }
  }
}

export function printElectronBlockedHelp(exe) {
  console.error(`
无法启动 Electron（spawn UNKNOWN / Device Guard）。

这不是项目 bug：本机策略禁止运行 node_modules 里的 electron.exe。

可尝试（按顺序）：
  1. 诊断: npm run doctor:electron
  2. Windows 设置 → 隐私和安全性 → Windows 安全中心 → 应用控制和智能应用
     关闭「智能应用控制」或为开发目录添加例外（需管理员/IT）
  3. 联系 IT 放行: ${exe}
  4. 在未被策略管控的电脑/目录开发，或仅 UI 预览: npm run dev

可选：若你有已放行的 Electron，可设置环境变量后重试:
  set EAUTO_ELECTRON_EXE=C:\\path\\to\\electron.exe
  npm run dev:app
`)
}
