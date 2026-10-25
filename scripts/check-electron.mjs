import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  printElectronBlockedHelp,
  resolveRunnableElectron,
} from './electron-utils.mjs'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

let resolved
try {
  resolved = await resolveRunnableElectron(rootDir)
} catch (e) {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
}

const { exe, source, version, probe } = resolved
console.log('Electron 路径:', exe)
if (process.env.EAUTO_ELECTRON_EXE) console.log('(使用 EAUTO_ELECTRON_EXE 覆盖)')
console.log('正在尝试启动（--version）…')

if (version) {
  console.log('✅ Electron 可正常启动，版本:', version)
  if (source === 'winget') {
    console.log('   来源: WinGet（node_modules 版被 Smart App Control 拦截时的替代）')
  }
  process.exit(0)
}

console.error('❌ 无法启动 Electron\n')
if (probe?.reason === 'device-guard' || probe?.reason === 'spawn-unknown') {
  printElectronBlockedHelp(exe)
} else if (probe?.detail) {
  console.error(probe.detail)
}
console.error('\n请执行: npm run setup:electron-win')
process.exit(1)
