import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { signActivationCode, type LicensePayload } from '../../electron/license/codec'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const privatePath = path.join(root, 'scripts/license/private.pem')

export function normalizeMachineInput(input: string): string {
  return input.replace(/[\s-]/g, '').toLowerCase()
}

export function formatMachineDisplay(machine32: string): string {
  const u = machine32.toUpperCase()
  return u.match(/.{1,4}/g)?.join('-') ?? u
}

export type IssueResult =
  | {
      ok: true
      code: string
      machine: string
      machineDisplay: string
      days: number
      expiresAt: string
      expiresAtMs: number
    }
  | { ok: false; error: string }

export async function issueActivation(machineRaw: string, days: number): Promise<IssueResult> {
  const machine = normalizeMachineInput(machineRaw)
  if (machine.length !== 32) {
    return { ok: false, error: '机器码应为 32 位（用户软件底部可复制，可带横线）' }
  }
  const validDays = Math.max(1, Math.min(3650, Math.floor(days) || 30))

  let privPem: string
  try {
    privPem = await fs.readFile(privatePath, 'utf8')
  } catch {
    return { ok: false, error: '未找到私钥，请先在项目目录运行: npm run license:keys' }
  }

  const now = Math.floor(Date.now() / 1000)
  const payload: LicensePayload = {
    v: 1,
    m: machine,
    e: now + validDays * 86400,
    i: now,
    n: crypto.randomBytes(6).toString('hex'),
  }
  const code = signActivationCode(payload, privPem)
  const expMs = payload.e * 1000
  return {
    ok: true,
    code,
    machine,
    machineDisplay: formatMachineDisplay(machine),
    days: validDays,
    expiresAt: new Date(expMs).toLocaleString('zh-CN'),
    expiresAtMs: expMs,
  }
}
