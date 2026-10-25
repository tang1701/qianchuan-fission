import crypto from 'node:crypto'
import os from 'node:os'

/** 稳定机器指纹（用于绑定激活码，换电脑需重新发码） */
export function getMachineId(): string {
  const parts = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
    process.env.PROCESSOR_IDENTIFIER ?? '',
    process.env.COMPUTERNAME ?? '',
  ]
  return crypto.createHash('sha256').update(parts.join('|'), 'utf8').digest('hex').slice(0, 32)
}

export function formatMachineCode(id: string): string {
  const u = id.toUpperCase()
  const parts: string[] = []
  for (let i = 0; i < u.length; i += 4) parts.push(u.slice(i, i + 4))
  return parts.join('-')
}

export function normalizeMachineCodeInput(input: string): string {
  return input.replace(/[\s-]/g, '').toLowerCase()
}
