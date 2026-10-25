import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const privatePath = path.join(root, 'scripts/license/private.pem')
const publicTs = path.join(root, 'electron/license/embeddedPublicKey.ts')

async function main() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string

  await fs.mkdir(path.dirname(privatePath), { recursive: true })
  await fs.writeFile(privatePath, privPem, 'utf8')

  const ts = `/** 由 scripts/license/generate-keys.ts 生成；安装包内只含公钥，私钥切勿提交仓库 */
export const LICENSE_PUBLIC_KEY_SPKI_B64 = '${spki.toString('base64')}'
`
  await fs.writeFile(publicTs, ts, 'utf8')

  console.log('已生成 Ed25519 密钥对：')
  console.log('  私钥（仅你本地保管）:', privatePath)
  console.log('  公钥已写入:', publicTs)
  console.log('发码命令: npm run license:issue -- --machine <用户机器码去横线> --days 30')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
