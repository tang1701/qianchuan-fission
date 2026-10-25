import crypto from 'node:crypto'
import { LICENSE_PREFIX } from './constants'
import { LICENSE_PUBLIC_KEY_SPKI_B64 } from './embeddedPublicKey'

export type LicensePayload = {
  v: 1
  /** 机器码 sha256 前 32 位 hex */
  m: string
  /** 过期时间 Unix 秒 */
  e: number
  /** 签发时间 Unix 秒 */
  i: number
  /** 随机 nonce，防重放复制 */
  n: string
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

export function canonicalPayload(p: LicensePayload): string {
  return JSON.stringify({ v: p.v, m: p.m, e: p.e, i: p.i, n: p.n })
}

function publicKey(): crypto.KeyObject {
  const der = Buffer.from(LICENSE_PUBLIC_KEY_SPKI_B64, 'base64')
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' })
}

export function verifyActivationCode(code: string, machineId: string): { ok: true; expMs: number } | { ok: false; reason: string } {
  const trimmed = code.trim()
  if (!trimmed.startsWith(`${LICENSE_PREFIX}.`)) {
    return { ok: false, reason: '激活码格式不正确' }
  }
  const rest = trimmed.slice(LICENSE_PREFIX.length + 1)
  const dot = rest.lastIndexOf('.')
  if (dot <= 0) return { ok: false, reason: '激活码格式不正确' }
  const payloadB64 = rest.slice(0, dot)
  const sigB64 = rest.slice(dot + 1)
  let payload: LicensePayload
  try {
    payload = JSON.parse(fromB64url(payloadB64).toString('utf8')) as LicensePayload
  } catch {
    return { ok: false, reason: '激活码内容无法解析' }
  }
  if (payload.v !== 1 || !payload.m || !payload.e || !payload.n) {
    return { ok: false, reason: '激活码版本不支持' }
  }
  if (payload.m !== machineId) {
    return { ok: false, reason: '激活码与当前电脑不匹配，请把机器码发给作者重新获取' }
  }
  const nowSec = Math.floor(Date.now() / 1000)
  if (payload.e < nowSec) {
    return { ok: false, reason: '激活码已过期，请联系作者续期' }
  }
  if (LICENSE_PUBLIC_KEY_SPKI_B64.includes('placeholderRunNpmRunLicenseKeys')) {
    return { ok: false, reason: '安装包未配置授权公钥，请联系作者获取正式版' }
  }
  try {
    const ok = crypto.verify(null, Buffer.from(canonicalPayload(payload), 'utf8'), publicKey(), fromB64url(sigB64))
    if (!ok) return { ok: false, reason: '激活码签名校验失败' }
  } catch {
    return { ok: false, reason: '激活码签名校验失败' }
  }
  return { ok: true, expMs: payload.e * 1000 }
}

export function signActivationCode(payload: LicensePayload, privateKeyPem: string): string {
  const sig = crypto.sign(null, Buffer.from(canonicalPayload(payload), 'utf8'), privateKeyPem)
  return `${LICENSE_PREFIX}.${b64url(Buffer.from(canonicalPayload(payload), 'utf8'))}.${b64url(sig)}`
}
