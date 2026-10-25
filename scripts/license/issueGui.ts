import { execSync } from 'node:child_process'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { issueActivation } from './issueLib'

function copyToClipboard(text: string) {
  const payload = JSON.stringify(text)
  execSync(`powershell -NoProfile -Command "Set-Clipboard -Value ${payload}"`, { stdio: 'ignore' })
}

async function main() {
  const rl = readline.createInterface({ input, output })
  console.log('\n=== 千川裂变神器 · 生成激活码 ===\n')

  try {
    const machine = (await rl.question('粘贴用户机器码（可带横线）: ')).trim()
    const daysRaw = (await rl.question('有效天数 [30]: ')).trim()
    const days = daysRaw ? Number.parseInt(daysRaw, 10) || 30 : 30

    const result = await issueActivation(machine, days)
    if (!result.ok) {
      console.error('\n失败:', result.error)
      process.exit(1)
    }

    copyToClipboard(result.code)
    console.log('\n激活码（已复制到剪贴板）:\n')
    console.log(result.code)
    console.log(`\n绑定机器: ${result.machineDisplay}`)
    console.log(`到期时间: ${result.expiresAt}（${result.days} 天）\n`)
  } finally {
    rl.close()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
