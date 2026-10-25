import { issueActivation } from './issueLib'

const args = process.argv.slice(2)
let machine = ''
let days = 30
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a === '--machine' || a === '-m') machine = args[++i] ?? ''
  else if (a === '--days' || a === '-d') days = Number.parseInt(args[++i] ?? '30', 10) || 30
  else if (a === '--help' || a === '-h') {
    console.log(`用法: npm run license:issue -- --machine <机器码> --days 30
  --machine  用户软件里显示的机器码（可带横线）
  --days     有效天数，默认 30`)
    process.exit(0)
  }
}

const result = await issueActivation(machine, days)
if (!result.ok) {
  console.error(result.error)
  process.exit(1)
}
console.log('\n激活码（发给用户）:\n')
console.log(result.code)
console.log(`\n绑定机器: ${result.machineDisplay}`)
console.log(`到期时间: ${result.expiresAt} (${result.days} 天)\n`)
